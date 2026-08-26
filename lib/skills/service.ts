/**
 * 知径 Pathfinder — 技能雷达（P1/P2）
 *
 * 无新表：从当前用户路径真实派生——
 *   - 每个路径节点 = 一个技能维度（节点标题为维度名）；
 *   - 等级 = 节点状态 + 证据数量（资料 / 费曼评价）；
 *   - 证据 = 节点关联的真实资源 + 该路径下的练习评价；
 *   - 置信度 = 证据条数（high ≥3 / medium ≥1 / low 0）；
 *   - 优先级 = 证据最薄弱且未完成的维度。
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  nodeResources,
  practiceEvaluations,
  practiceSessions,
  resources,
} from "@/lib/db/schema";
import { assertPathOwned, getPathNodes } from "@/lib/modules/shared";
import type { Grade, NodeStatus } from "@/lib/types";

export interface SkillEvidenceDto {
  sourceType: string;
  claim: string;
  sourceId: string;
  createdAt: string;
}

export interface SkillDimensionDto {
  id: string;
  name: string;
  chapter: string;
  sequence: number;
  level: "待开始" | "学习中" | "已有基础" | "证据不足";
  evidenceCount: number;
  confidence: "high" | "medium" | "low";
  evidences: SkillEvidenceDto[];
  recommendation?: { gapType: string; nextAction: string; reason: string };
}

export interface SkillsOverviewDto {
  pathId: string;
  totalEvidence: number;
  maxEvidence: number;
  priority: SkillDimensionDto | null;
  dimensions: SkillDimensionDto[];
}

export async function getSkillsOverview(userId: string, pathId: string): Promise<SkillsOverviewDto> {
  await assertPathOwned(userId, pathId);
  const nodes = await getPathNodes(pathId);

  // 每节点资源证据（节点 → ResourceEvidence 列表；两步查询避免 callback join 类型问题）
  const nodeIds = nodes.map((n) => n.id);
  const nrRows = await db
    .select()
    .from(nodeResources)
    .where(inArray(nodeResources.nodeId, nodeIds));
  const resIds = [...new Set(nrRows.map((r) => r.resourceId))];
  const resRows = resIds.length
    ? await db.select().from(resources).where(inArray(resources.id, resIds))
    : [];
  const resMap = new Map(resRows.map((r) => [r.id, r]));
  const resByNode = new Map<string, typeof resources.$inferSelect[]>();
  for (const nr of nrRows) {
    const r = resMap.get(nr.resourceId);
    if (!r) continue;
    const list = resByNode.get(nr.nodeId) ?? [];
    list.push(r);
    resByNode.set(nr.nodeId, list);
  }

  // 该路径下的练习会话 → 评价证据
  const sessions = await db
    .select({ id: practiceSessions.id, nodeId: practiceSessions.nodeId })
    .from(practiceSessions)
    .where(and(eq(practiceSessions.pathId, pathId), eq(practiceSessions.userId, userId)));
  const sessionIds = sessions.map((s) => s.id);
  const sessionNode = new Map(sessions.map((s) => [s.id, s.nodeId]));
  const evals = sessionIds.length
    ? await db.select().from(practiceEvaluations).where(inArray(practiceEvaluations.sessionId, sessionIds))
    : [];
  const evalsByNode = new Map<string | null, typeof evals>();
  for (const ev of evals) {
    const nodeId = sessionNode.get(ev.sessionId) ?? null;
    const list = evalsByNode.get(nodeId) ?? [];
    list.push(ev);
    evalsByNode.set(nodeId, list);
  }

  const dimensions: SkillDimensionDto[] = nodes.map((n) => {
    const resEvidences = (resByNode.get(n.id) ?? []).map((r) => ({
      sourceType: `资料·${(r.grade as Grade)}级`,
      claim: r.title,
      sourceId: r.id,
      createdAt: (r.retrievedAt ?? r.createdAt).toISOString(),
    }));
    const practiceEvidences = (evalsByNode.get(n.id) ?? []).map((ev) => ({
      sourceType: "费曼评价",
      claim: (ev.clear as string[])?.[0] || `完成 ${ev.evidenceRounds} 轮讲解`,
      sourceId: ev.id,
      createdAt: (ev.generatedAt ?? ev.createdAt).toISOString(),
    }));
    const evidences = [...resEvidences, ...practiceEvidences];
    const evidenceCount = evidences.length;
    const confidence: SkillDimensionDto["confidence"] =
      evidenceCount >= 3 ? "high" : evidenceCount >= 1 ? "medium" : "low";

    const level = levelFor(n.status as NodeStatus, evidenceCount);
    const recommendation = recommendationFor(n.status as NodeStatus, n.title, evidenceCount, confidence);
    return {
      id: n.id,
      name: n.title,
      chapter: n.chapter,
      sequence: n.sequence,
      level,
      evidenceCount,
      confidence,
      evidences,
      ...(recommendation ? { recommendation } : {}),
    };
  });

  const totalEvidence = dimensions.reduce((s, d) => s + d.evidenceCount, 0);
  const maxEvidence = Math.max(1, ...dimensions.map((d) => d.evidenceCount));
  const priority =
    dimensions.find((d) => d.recommendation) ??
    null;

  return { pathId, totalEvidence, maxEvidence, priority, dimensions };
}

function levelFor(status: NodeStatus, evidenceCount: number): SkillDimensionDto["level"] {
  if (status === "completed") return "已有基础";
  if (status === "locked") return "待开始";
  if (evidenceCount === 0) return "证据不足";
  return "学习中";
}

function recommendationFor(
  status: NodeStatus,
  name: string,
  evidenceCount: number,
  confidence: SkillDimensionDto["confidence"],
): SkillDimensionDto["recommendation"] | undefined {
  if (evidenceCount === 0 && status !== "completed") {
    return {
      gapType: "证据不足",
      nextAction: `回到节点「${name}」补充 A/B 级资料并完成练习`,
      reason: "该技能暂无资料或练习证据，画像置信度低。",
    };
  }
  if (status === "locked") {
    return {
      gapType: "待开始",
      nextAction: `完成前置节点后解锁「${name}」`,
      reason: "该技能尚未开始学习。",
    };
  }
  if (confidence === "low" && status !== "completed") {
    return {
      gapType: "证据不足",
      nextAction: `再完成「${name}」的费曼练习或复习`,
      reason: `仅有 ${evidenceCount} 条证据，置信度低。`,
    };
  }
  return undefined;
}
