/**
 * 知径 Pathfinder — 学习路径服务（通用学习规划阶段）
 *
 * 归属：所有按用户查询都从会话解析的 userId 出发，绝不接受客户端传入 user_id。
 * 任意主题：preview 无状态返回预览路径（provisional id，不写库）；confirm 单事务把
 * AI 规划物化为用户自己的 learning_paths + knowledge_nodes + curriculum（draft）。
 *
 * 节点 id 一律服务端确定性映射：先按规范化标题匹配现有知识库节点（复用，不新建），
 * 未命中则生成 gen-<topic>-<skill> 稳定 id（onConflictDoNothing 幂等，跨用户共享同一
 * 知识库条目）。模型输出只给 skills/weeks，绝不直接决定节点 id（见 lib/plan/planner.ts）。
 * 生成节点以「第 N 周」为 chapter、确定性前置链（node i ← node i-1）保证锁定/解锁逻辑。
 */
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  curricula,
  knowledgeNodes,
  learningPathNodes,
  learningPaths,
  onboardingAnswers,
  pathSnapshots,
  recommendationRuns,
  users,
} from "@/lib/db/schema";
import { serializeNode, serializePath, serializePathSummary } from "@/lib/api/serialize";
import { loadResourcesByNodeIds } from "@/lib/curriculum/service";
import { generatePlan, type GeneratedPlan } from "@/lib/plan/planner";
import { discoverPreviewEvidence } from "@/lib/resource/preview";
import type { GeneratedSkill } from "@/lib/ai/types";
import type { LearningGoalInput } from "@/lib/plan/goal";
import type {
  KnowledgeNode,
  LearningPath,
  NodeStatus,
  PathRationale,
  PlanVersion,
} from "@/lib/types";

type NodeRow = typeof knowledgeNodes.$inferSelect;
type NodeInsert = typeof knowledgeNodes.$inferInsert;

/** 当前用户路径列表（GET /api/v1/paths） */
export async function listPathsByUser(userId: string) {
  const rows = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.userId, userId))
    .orderBy(desc(learningPaths.isPrimary), desc(learningPaths.lastActivityAt));
  return rows.map((r) => serializePathSummary(r));
}

/** 单条路径（归属校验在 SQL 层：id + user_id 双条件），未命中/非本人 → null */
export async function getPathForUser(pathId: string, userId: string) {
  const path = (
    await db
      .select()
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .limit(1)
  )[0];
  if (!path) return null;

  const nodes = await getPathNodes(pathId);
  const snapshots = await db
    .select()
    .from(pathSnapshots)
    .where(eq(pathSnapshots.pathId, pathId))
    .orderBy(asc(pathSnapshots.version));

  const planVersions: PlanVersion[] = snapshots.map((s) => ({
    id: `${path.id}-v${s.version}`,
    version: s.version,
    weeklyHours: path.weeklyHours,
    deadline: path.deadline?.toISOString() ?? "",
    reason: s.version === 1 ? "初始规划" : `版本 v${s.version}`,
    createdAt: s.createdAt.toISOString(),
    source: s.version === 1 ? "initial" : "ai_proposal",
  }));

  return serializePath(path, nodes, path.rationale as PathRationale, planVersions);
}

export interface UpdateLearningPathInput {
  title?: string;
  weeklyHours?: number;
  deadline?: Date;
  status?: "in_progress" | "paused" | "completed" | "archived";
  setPrimary?: boolean;
}

/**
 * 更新个人路径。主路径切换与归档在同一事务内完成，避免出现两个主路径。
 * 归档主路径时会把最近使用的非归档路径提升为主路径；没有候选项则允许暂时无主路径。
 */
export async function updatePathForUser(
  pathId: string,
  userId: string,
  input: UpdateLearningPathInput,
): Promise<LearningPath | null> {
  const changed = await db.transaction(async (tx) => {
    const current = (
      await tx
        .select()
        .from(learningPaths)
        .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
        .limit(1)
    )[0];
    if (!current) return false;

    const now = new Date();
    const patch: Partial<typeof learningPaths.$inferInsert> = {
      updatedAt: now,
      lastActivityAt: now,
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.weeklyHours !== undefined) patch.weeklyHours = input.weeklyHours;
    if (input.deadline !== undefined) patch.deadline = input.deadline;
    if (input.status !== undefined) patch.status = input.status;

    if (input.setPrimary) {
      await tx
        .update(learningPaths)
        .set({ isPrimary: false, updatedAt: now })
        .where(eq(learningPaths.userId, userId));
      patch.isPrimary = true;
      if (current.status === "archived" && input.status === undefined) patch.status = "in_progress";
    }

    if (input.status === "archived" && current.isPrimary && !input.setPrimary) {
      patch.isPrimary = false;
      const replacement = (
        await tx
          .select({ id: learningPaths.id })
          .from(learningPaths)
          .where(
            and(
              eq(learningPaths.userId, userId),
              ne(learningPaths.id, pathId),
              ne(learningPaths.status, "archived"),
            ),
          )
          .orderBy(desc(learningPaths.lastActivityAt))
          .limit(1)
      )[0];
      if (replacement) {
        await tx
          .update(learningPaths)
          .set({ isPrimary: true, updatedAt: now })
          .where(eq(learningPaths.id, replacement.id));
      }
    }

    await tx.update(learningPaths).set(patch).where(eq(learningPaths.id, pathId));
    return true;
  });

  return changed ? getPathForUser(pathId, userId) : null;
}

/** 预览（POST /api/v1/paths/preview）：无状态，不写库 */
export async function computePreview(goal: LearningGoalInput): Promise<LearningPath> {
  const existing = await loadPlanningNodes();
  const now = new Date();
  const plan = await generatePlan(
    goal,
    existing.map((n) => n.title),
  );
  const items = buildSkillItems(goal, plan, existing);
  const nodes = await serializePreviewNodes(items);
  const evidence = await discoverPreviewEvidence(
    { topic: goal.topic, goal: goal.goal, currentLevel: goal.currentLevel },
    nodes,
  );
  const rationale = { ...genericRationale(goal, plan, now), ...evidence.rationalePatch };

  return serializePath(
    {
      id: `preview-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
      title: plan.title,
      status: "draft",
      curriculumVersion: "1.0",
      goalSummary: plan.rationale,
      weeklyHours: goal.weeklyHours,
      deadline: addWeeks(now, goal.deadlineWeeks),
      estimatedWeeks: goal.deadlineWeeks,
      completedCount: 0,
      totalCount: nodes.length,
      currentNodeId: nodes[0]?.id ?? null,
      rationale,
      createdAt: now,
      lastActivityAt: now,
      isPrimary: false,
    },
    evidence.nodes,
    rationale,
  );
}

export type ConfirmPathResult =
  | { kind: "created"; path: LearningPath }
  | { kind: "conflict"; existingPathId: string };

/** 确认（POST /api/v1/paths/confirm）：单事务创建用户自己的真实路径 */
export async function confirmPath(
  userId: string,
  goal: LearningGoalInput,
  acceptedPreview?: LearningPath | null,
): Promise<ConfirmPathResult> {
  const existing = await loadPlanningNodes();
  const now = new Date();
  const plan = planFromAcceptedPreview(goal, acceptedPreview) ??
    await generatePlan(goal, existing.map((n) => n.title));
  const items = buildSkillItems(goal, plan, existing);
  const topicSlug = slugify(goal.topic);
  const curriculumId = `curriculum-gen-${topicSlug}`;
  const pathId = `path-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const deadline = addWeeks(now, goal.deadlineWeeks);
  const start = Date.now();
  const existingPrimary = await db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(and(eq(learningPaths.userId, userId), eq(learningPaths.isPrimary, true)))
    .limit(1);

  const pathInput = {
    id: pathId,
    userId,
    title: plan.title,
    status: "in_progress" as const,
    curriculumVersion: "1.0",
    goalSummary: plan.rationale,
    weeklyHours: goal.weeklyHours,
    deadline,
    estimatedWeeks: goal.deadlineWeeks,
    completedCount: 0,
    totalCount: items.length,
    currentNodeId: items[0]?.nodeId ?? null,
    rationale: genericRationale(goal, plan, now),
    createdAt: now,
    lastActivityAt: now,
    // 第一条路径自动成为主路径；后续路径作为可切换的并行路径保留。
    isPrimary: existingPrimary.length === 0,
    isDemo: false,
  };

  try {
    await db.transaction(async (tx) => {
      // 生成 curriculum（draft；同主题跨用户复用，onConflictDoNothing 幂等）
      await tx
        .insert(curricula)
        .values({
          id: curriculumId,
          title: plan.title,
          description: plan.rationale,
          version: "1.0",
          status: "draft",
          isDemo: false,
        })
        .onConflictDoNothing();

      // 生成节点（未命中现有知识库时；稳定 id + 确定性前置链）
      const genRows = items.filter((it) => it.generatedRow).map((it) => it.generatedRow!);
      if (genRows.length > 0) {
        await tx.insert(knowledgeNodes).values(genRows).onConflictDoNothing();
      }

      await tx.insert(learningPaths).values(pathInput);

      await tx.insert(learningPathNodes).values(
        items.map((it, i) => ({
          pathId,
          nodeId: it.nodeId,
          status: i === 0 ? "available" : "locked",
          sortOrder: i,
          isDemo: false,
        })),
      );

      const previewNodes = await serializePreviewNodes(items);
      await tx.insert(pathSnapshots).values({
        pathId,
        snapshot: serializePath(pathInput, previewNodes, pathInput.rationale, [
          initialVersion(pathId, goal, deadline, now),
        ]),
        version: 1,
      });

      await tx.insert(onboardingAnswers).values({ userId, answers: goal });
      await tx.insert(recommendationRuns).values({
        userId,
        input: goal,
        output: { pathId, totalCount: items.length },
        model: plan.providerLabel,
        latencyMs: Math.max(1, Date.now() - start),
      });
      await tx
        .update(users)
        .set({ goalSummary: plan.rationale, weeklyHours: goal.weeklyHours, onboardedAt: now })
        .where(eq(users.id, userId));

    });

    const previewNodes = await serializePreviewNodes(items);
    return {
      kind: "created",
      path: serializePath(pathInput, previewNodes, pathInput.rationale, [
        initialVersion(pathId, goal, deadline, now),
      ]),
    };
  } catch (e) {
    // 部分唯一索引 learning_paths_one_primary_user_idx 兜底并发双写
    if (isUniqueViolation(e)) {
      const existingPrimary = await db
        .select({ id: learningPaths.id })
        .from(learningPaths)
        .where(and(eq(learningPaths.userId, userId), eq(learningPaths.isPrimary, true)))
        .limit(1);
      return { kind: "conflict", existingPathId: existingPrimary[0]?.id ?? pathId };
    }
    throw e;
  }
}

/* ---------------- 内部辅助 ---------------- */

async function loadPlanningNodes(): Promise<NodeRow[]> {
  const rows = await db.select().from(knowledgeNodes).orderBy(asc(knowledgeNodes.sequence));
  // 已审核的产品经理模板排在 AI 生成节点之前，避免数据库已有其他主题后
  // `existingNodeTitles.slice(0, 19)` 误取通用节点。
  return rows.sort((a, b) => {
    const aPriority = a.curriculumId === "curriculum-v1" ? 0 : 1;
    const bPriority = b.curriculumId === "curriculum-v1" ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.sequence - b.sequence;
  });
}

async function getPathNodes(pathId: string): Promise<KnowledgeNode[]> {
  const rows = await db
    .select({ node: knowledgeNodes, pathStatus: learningPathNodes.status })
    .from(learningPathNodes)
    .innerJoin(knowledgeNodes, eq(learningPathNodes.nodeId, knowledgeNodes.id))
    .where(eq(learningPathNodes.pathId, pathId))
    .orderBy(asc(learningPathNodes.sortOrder));
  const resByNode = await loadResourcesByNodeIds(rows.map((r) => r.node.id));
  return rows.map((r) =>
    serializeNode(r.node, resByNode.get(r.node.id) ?? [], r.pathStatus as NodeStatus),
  );
}

/** 一次规划的技能项：每个 skill → 一个节点（复用现有 / 生成），含确定性 id 与前置链 */
interface SkillItem {
  skill: GeneratedSkill;
  week: number;
  nodeId: string;
  sequence: number;
  prerequisiteIds: string[];
  estimatedMinutes: number;
  /** 命中现有知识库节点（复用，不新建） */
  existingNode?: NodeRow;
  /** 生成节点 insert 行（existingNode 为空时） */
  generatedRow?: NodeInsert;
}

function buildSkillItems(
  goal: LearningGoalInput,
  plan: GeneratedPlan,
  existing: NodeRow[],
): SkillItem[] {
  const topicSlug = slugify(goal.topic);
  const weekOf = new Map<string, number>();
  for (const w of plan.weeks) for (const s of w.skills) if (!weekOf.has(s)) weekOf.set(s, w.week);
  const skillsInWeek = new Map<number, number>();
  for (const w of plan.weeks)
    skillsInWeek.set(w.week, (skillsInWeek.get(w.week) ?? 0) + w.skills.length);
  const weeklyMinutes = Math.max(1, goal.weeklyHours) * 60;

  const usedExisting = new Set<string>();
  const usedSlugs = new Set<string>();
  const items: SkillItem[] = [];

  plan.skills.forEach((skill, i) => {
    const week = weekOf.get(skill.name) ?? Math.min(i + 1, Math.max(1, plan.weeks.length));
    const estimatedMinutes = Math.max(
      20,
      Math.round(weeklyMinutes / (skillsInWeek.get(week) ?? 1)),
    );
    const prerequisiteIds = i === 0 ? [] : [items[i - 1].nodeId];

    const matched = matchExistingNode(skill.name, existing, usedExisting);
    if (matched) {
      usedExisting.add(matched.id);
      items.push({
        skill,
        week,
        nodeId: matched.id,
        sequence: i + 1,
        prerequisiteIds,
        estimatedMinutes,
        existingNode: matched,
      });
      return;
    }

    let slug = `${topicSlug}-${slugify(skill.name)}`;
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${topicSlug}-${slugify(skill.name)}-${n++}`;
    usedSlugs.add(slug);
    const nodeId = `gen-${slug}`;
    items.push({
      skill,
      week,
      nodeId,
      sequence: i + 1,
      prerequisiteIds,
      estimatedMinutes,
      generatedRow: {
        id: nodeId,
        curriculumId: `curriculum-gen-${topicSlug}`,
        title: skill.name,
        chapter: `第 ${week} 周`,
        sequence: i + 1,
        status: i === 0 ? "available" : "locked",
        prerequisites: prerequisiteIds,
        estimatedMinutes,
        capabilityGoal: skill.reason,
        completionCriteria: [`能用自己的话讲清「${skill.name}」的核心概念`, "完成对应练习并自评"],
        evidenceCoverage: { hasAB: false, aCount: 0, bCount: 0, cCount: 0, insufficient: true },
        isDemo: false,
      },
    });
  });

  return items;
}

/** 把 SkillItem 序列化为前端 KnowledgeNode（预览 / 快照 / confirm 返回共用） */
async function serializePreviewNodes(items: SkillItem[]): Promise<KnowledgeNode[]> {
  const matchedIds = items.filter((it) => it.existingNode).map((it) => it.existingNode!.id);
  const resByNode = await loadResourcesByNodeIds(matchedIds);
  return items.map((it, i) => {
    const status: NodeStatus = i === 0 ? "available" : "locked";
    if (it.existingNode) {
      return serializeNode(it.existingNode, resByNode.get(it.existingNode.id) ?? [], status);
    }
    return serializeNode(it.generatedRow as NodeRow, [], status);
  });
}

function genericRationale(goal: LearningGoalInput, plan: GeneratedPlan, now: Date): PathRationale {
  return {
    kind: "generic",
    topic: goal.topic,
    goal: goal.goal,
    currentLevel: goal.currentLevel,
    weeklyHours: goal.weeklyHours,
    deadlineWeeks: goal.deadlineWeeks,
    preferences: goal.preferences,
    title: plan.title,
    rationale: plan.rationale,
    skills: plan.skills,
    weeks: plan.weeks,
    goalProfile: plan.goalProfile,
    providerLabel: plan.providerLabel,
    searchProviderLabel: plan.searchProviderLabel,
    generatedAt: now.toISOString(),
  };
}

/**
 * 用户确认的预览来自当前用户 Redis 短期快照；校验目标参数完全一致后复用，
 * 避免确认时二次调用模型造成节点、顺序和用户刚看到的方案不一致。
 */
function planFromAcceptedPreview(
  goal: LearningGoalInput,
  preview?: LearningPath | null,
): GeneratedPlan | null {
  const rationale = preview?.rationale;
  if (!preview || rationale?.kind !== "generic") return null;
  const sameGoal =
    rationale.topic?.trim() === goal.topic.trim() &&
    (rationale.goal ?? "").trim() === goal.goal.trim() &&
    rationale.currentLevel?.trim() === goal.currentLevel.trim() &&
    rationale.weeklyHours === goal.weeklyHours &&
    rationale.deadlineWeeks === goal.deadlineWeeks;
  if (!sameGoal || !rationale.title || !rationale.rationale || !rationale.skills?.length || !rationale.weeks?.length) {
    return null;
  }
  return {
    goalProfile: rationale.goalProfile,
    title: rationale.title,
    rationale: rationale.rationale,
    skills: rationale.skills,
    weeks: rationale.weeks,
    providerLabel: rationale.providerLabel,
    searchProviderLabel: rationale.searchProviderLabel,
  };
}

/**
 * 现有知识库节点匹配：规范化标题的 精确(1.0) > 包含(0.8) > 二元组 Jaccard(阈值 0.55)。
 * used 防止同一规划内两个 skill 复用到同一个现有节点。
 */
function matchExistingNode(
  skillName: string,
  existing: NodeRow[],
  used: Set<string>,
): NodeRow | null {
  const target = normTitle(skillName);
  if (!target) return null;
  let best: NodeRow | null = null;
  let bestScore = 0;
  for (const n of existing) {
    if (used.has(n.id)) continue;
    const t = normTitle(n.title);
    if (!t) continue;
    const score = titleScore(target, t);
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return bestScore >= 0.55 ? best : null;
}

function titleScore(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;
  return jaccard(a, b);
}

function jaccard(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function bigrams(s: string): Set<string> {
  const chars = [...s];
  const out = new Set<string>();
  for (let i = 0; i + 1 < chars.length; i++) out.add(chars[i] + chars[i + 1]);
  return out;
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s，。、·\-_（）()【】[]{}:：;；]/g, "")
    .trim();
}

/** 稳定 id 用 slug：保留字母/数字/中日韩文字，其余转中划线 */
function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "topic"
  );
}

function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + weeks * 7 * 86400000);
}

function initialVersion(
  pathId: string,
  goal: LearningGoalInput,
  deadline: Date,
  now: Date,
): PlanVersion {
  return {
    id: `${pathId}-v1`,
    version: 1,
    weeklyHours: goal.weeklyHours,
    deadline: deadline.toISOString(),
    reason: "初始规划",
    createdAt: now.toISOString(),
    source: "initial",
  };
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}
