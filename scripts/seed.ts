/**
 * 知径 Pathfinder — M1 seed（本地开发）
 *
 * 数据来源必须且仅来自 site/lib/demo/*（不重新发明 demo 数据）。
 * 全部行 is_demo=true。
 *
 * 安全：
 *  - 运行前校验 DATABASE_URL 实际指向 pathfinder 库（严禁 mydb）
 *  - 幂等：以主键 onConflictDoNothing，可重复执行
 *  - 结束后打印每张表实际插入数量与 demo 期望数量对拍
 *
 * 运行： cd pathfinder/site && npx tsx scripts/seed.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";

import {
  CURRICULUM_TITLE,
  CURRICULUM_VERSION,
  KNOWLEDGE_NODES,
  PATH_PM,
  PATH_PAUSED,
  PRACTICE_DONE,
  PRACTICE_UNFINISHED,
  PRACTICE_ACTIVE,
  PRACTICE_FEEDBACK_DONE,
  NOTES,
} from "../lib/demo/data";
import { USER_PROFILES, ALL_ROLES } from "../lib/demo/users";

const EXPECTED = {
  users: ALL_ROLES.length, // 5（guest 不列入）
  curricula: 1,
  knowledge_nodes: KNOWLEDGE_NODES.length, // 19
  resources: 7, // res-a1/a2/b1/b2/b3/c1/c2 唯一资源
  node_resources: 30, // 各节点资源引用之和
  learning_paths: 2, // path-pm + path-research
  learning_path_nodes: PATH_PM.nodes.length, // 19（path-research 无节点）
  practice_sessions: 3,
  practice_messages:
    PRACTICE_DONE.messages.length +
    PRACTICE_UNFINISHED.messages.length +
    PRACTICE_ACTIVE.messages.length, // 7+4+2 = 13
  practice_evaluations: 1,
  feynman_notes: NOTES.length, // 4
} as const;

function assertExpected(name: string, actual: number): void {
  const exp = EXPECTED[name as keyof typeof EXPECTED];
  // Seed 可能在已有真实用户/路径的数据库上重复运行；只要求演示基线完整，
  // 不再因业务数据多于基线而阻断容器重启。
  if (actual < exp) {
    throw new Error(
      `[对拍失败] ${name} 实际 ${actual} < demo 最低基线 ${exp}。已停止，不自行修正数据。`,
    );
  }
  console.log(`  ✓ ${name}: ${actual}（演示最低基线 ${exp}）`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 未配置");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // 0) 安全护栏：确认指向 pathfinder，严禁 mydb
  const { rows } = await pool.query<{ db: string }>("SELECT current_database() AS db");
  const curDb = rows[0].db;
  if (curDb !== "pathfinder") {
    throw new Error(`[中止] 当前连接数据库为 ${curDb}，不是 pathfinder。拒绝 seed。`);
  }
  console.log(`连接数据库确认：${curDb}（user=${(await pool.query<{ u: string }>("SELECT current_user AS u")).rows[0].u}）`);

  // 1) users —— 5 个演示角色
  const userRows = ALL_ROLES.map((r) => {
    const p = USER_PROFILES[r];
    return {
      id: p.id,
      email: p.email || null,
      displayName: p.displayName,
      role: p.role,
      weeklyHours: p.weeklyHours,
      goalSummary: p.goalSummary || null,
      isDemo: true,
    };
  });
  await db.insert(schema.users).values(userRows).onConflictDoNothing();
  assertExpected("users", (await db.select({ c: schema.users.id }).from(schema.users)).length);

  // 2) curricula —— 1 条主课程
  await db
    .insert(schema.curricula)
    .values({
      id: "curriculum-v1",
      title: CURRICULUM_TITLE,
      version: CURRICULUM_VERSION,
      status: "published",
      isDemo: true,
    })
    .onConflictDoNothing();
  assertExpected("curricula", (await db.select({ c: schema.curricula.id }).from(schema.curricula)).length);

  // 3) knowledge_nodes —— 19
  await db
    .insert(schema.knowledgeNodes)
    .values(
      KNOWLEDGE_NODES.map((n) => ({
        id: n.id,
        curriculumId: "curriculum-v1",
        title: n.title,
        chapter: n.chapter,
        sequence: n.sequence,
        status: n.status,
        prerequisites: n.prerequisiteIds,
        estimatedMinutes: n.estimatedMinutes,
        capabilityGoal: n.capabilityGoal,
        completionCriteria: n.completionCriteria,
        evidenceCoverage: n.evidenceCoverage,
        scenario: n.scenario ?? null,
        curriculumSection: n.curriculumSection ?? null,
        isDemo: true,
      })),
    )
    .onConflictDoNothing();
  assertExpected("knowledge_nodes", (await db.select({ c: schema.knowledgeNodes.id }).from(schema.knowledgeNodes)).length);

  // 4) resources —— 7 个唯一资源（跨节点共享）
  const uniqueResources = new Map<string, (typeof KNOWLEDGE_NODES)[number]["resources"][number]>();
  for (const n of KNOWLEDGE_NODES) {
    for (const r of n.resources) {
      if (!uniqueResources.has(r.id)) uniqueResources.set(r.id, r);
    }
  }
  await db
    .insert(schema.resources)
    .values(
      [...uniqueResources.values()].map((r) => ({
        id: r.id,
        title: r.title,
        domain: r.domain,
        grade: r.grade,
        sourceType: r.sourceType,
        sourceName: r.sourceName,
        checkedAt: new Date(r.checkedAt),
        retrievedAt: new Date(r.retrievedAt),
        reason: r.reason,
        url: r.url,
        accessibilityStatus: r.accessibilityStatus,
        licenseNote: r.licenseNote,
        isDemo: true,
      })),
    )
    .onConflictDoNothing();
  assertExpected("resources", (await db.select({ c: schema.resources.id }).from(schema.resources)).length);

  // 5) node_resources —— 节点↔资源 多对多链接
  const nodeResourceRows: { nodeId: string; resourceId: string; sortOrder: number }[] = [];
  for (const n of KNOWLEDGE_NODES) {
    n.resources.forEach((r, i) => nodeResourceRows.push({ nodeId: n.id, resourceId: r.id, sortOrder: i }));
  }
  await db.insert(schema.nodeResources).values(nodeResourceRows).onConflictDoNothing();
  assertExpected("node_resources", (await db.select({ c: schema.nodeResources.nodeId }).from(schema.nodeResources)).length);

  // 6) learning_paths —— path-pm + path-research（均归属陈思 u-chensi，与 demo 一致）
  await db
    .insert(schema.learningPaths)
    .values([
      {
        id: PATH_PM.id,
        userId: "u-chensi",
        title: PATH_PM.title,
        status: PATH_PM.status,
        curriculumVersion: PATH_PM.curriculumVersion,
        goalSummary: PATH_PM.goalSummary,
        weeklyHours: PATH_PM.weeklyHours,
        deadline: new Date(PATH_PM.deadline),
        estimatedWeeks: PATH_PM.estimatedWeeks,
        completedCount: PATH_PM.progress.completed,
        totalCount: PATH_PM.progress.total,
        currentNodeId: PATH_PM.currentNodeId,
        rationale: PATH_PM.rationale,
        createdAt: new Date(PATH_PM.createdAt),
        lastActivityAt: new Date(PATH_PM.lastActivityAt),
        isPrimary: true,
        isDemo: true,
      },
      {
        id: PATH_PAUSED.id,
        userId: "u-chensi",
        title: PATH_PAUSED.title,
        status: PATH_PAUSED.status,
        curriculumVersion: PATH_PAUSED.curriculumVersion,
        goalSummary: PATH_PAUSED.goalSummary,
        weeklyHours: PATH_PAUSED.weeklyHours,
        deadline: new Date(PATH_PAUSED.deadline),
        estimatedWeeks: PATH_PAUSED.estimatedWeeks,
        completedCount: PATH_PAUSED.progress.completed,
        totalCount: PATH_PAUSED.progress.total,
        currentNodeId: PATH_PAUSED.currentNodeId,
        rationale: PATH_PAUSED.rationale,
        createdAt: new Date(PATH_PAUSED.createdAt),
        lastActivityAt: new Date(PATH_PAUSED.lastActivityAt),
        isPrimary: false,
        isDemo: true,
      },
    ])
    .onConflictDoNothing();
  assertExpected("learning_paths", (await db.select({ c: schema.learningPaths.id }).from(schema.learningPaths)).length);

  // 7) learning_path_nodes —— path-pm 的 19 个节点（含路径内状态）
  await db
    .insert(schema.learningPathNodes)
    .values(
      PATH_PM.nodes.map((n, i) => ({
        pathId: PATH_PM.id,
        nodeId: n.id,
        status: n.status,
        sortOrder: i,
        isDemo: true,
      })),
    )
    .onConflictDoNothing();
  assertExpected("learning_path_nodes", (await db.select({ c: schema.learningPathNodes.nodeId }).from(schema.learningPathNodes)).length);

  // 8) practice_sessions —— 3 个
  await db
    .insert(schema.practiceSessions)
    .values([
      {
        id: PRACTICE_DONE.id,
        userId: "u-chensi",
        nodeId: PRACTICE_DONE.nodeId,
        pathId: PATH_PM.id,
        status: PRACTICE_DONE.status,
        currentRound: PRACTICE_DONE.currentRound,
        totalRounds: PRACTICE_DONE.totalRounds,
        startedAt: new Date(PRACTICE_DONE.startedAt),
        updatedAt: new Date(PRACTICE_DONE.updatedAt),
        draft: PRACTICE_DONE.draft,
        draftSavedAt: PRACTICE_DONE.draftSavedAt ? new Date(PRACTICE_DONE.draftSavedAt) : null,
        syncState: PRACTICE_DONE.syncState,
        isDemo: true,
      },
      {
        id: PRACTICE_UNFINISHED.id,
        userId: "u-zhouning",
        nodeId: PRACTICE_UNFINISHED.nodeId,
        pathId: PATH_PM.id,
        status: PRACTICE_UNFINISHED.status,
        currentRound: PRACTICE_UNFINISHED.currentRound,
        totalRounds: PRACTICE_UNFINISHED.totalRounds,
        startedAt: new Date(PRACTICE_UNFINISHED.startedAt),
        updatedAt: new Date(PRACTICE_UNFINISHED.updatedAt),
        draft: PRACTICE_UNFINISHED.draft,
        draftSavedAt: PRACTICE_UNFINISHED.draftSavedAt ? new Date(PRACTICE_UNFINISHED.draftSavedAt) : null,
        syncState: PRACTICE_UNFINISHED.syncState,
        isDemo: true,
      },
      {
        id: PRACTICE_ACTIVE.id,
        userId: "u-chensi",
        nodeId: PRACTICE_ACTIVE.nodeId,
        pathId: PATH_PM.id,
        status: PRACTICE_ACTIVE.status,
        currentRound: PRACTICE_ACTIVE.currentRound,
        totalRounds: PRACTICE_ACTIVE.totalRounds,
        startedAt: new Date(PRACTICE_ACTIVE.startedAt),
        updatedAt: new Date(PRACTICE_ACTIVE.updatedAt),
        draft: PRACTICE_ACTIVE.draft,
        draftSavedAt: PRACTICE_ACTIVE.draftSavedAt ? new Date(PRACTICE_ACTIVE.draftSavedAt) : null,
        syncState: PRACTICE_ACTIVE.syncState,
        isDemo: true,
      },
    ])
    .onConflictDoNothing();
  assertExpected("practice_sessions", (await db.select({ c: schema.practiceSessions.id }).from(schema.practiceSessions)).length);

  // 9) practice_messages —— 13
  const sessionMsgMap: Record<string, typeof PRACTICE_DONE.messages> = {
    [PRACTICE_DONE.id]: PRACTICE_DONE.messages,
    [PRACTICE_UNFINISHED.id]: PRACTICE_UNFINISHED.messages,
    [PRACTICE_ACTIVE.id]: PRACTICE_ACTIVE.messages,
  };
  const msgRows: {
    id: string;
    sessionId: string;
    role: "user" | "ai";
    content: string;
    turnIndex: number;
    createdAt: Date;
    status: string;
    isDemo: boolean;
  }[] = [];
  for (const [sid, msgs] of Object.entries(sessionMsgMap)) {
    for (const m of msgs) {
      msgRows.push({
        id: m.id,
        sessionId: sid,
        role: m.role,
        content: m.content,
        turnIndex: m.turnIndex,
        createdAt: new Date(m.createdAt),
        status: m.status,
        isDemo: true,
      });
    }
  }
  await db.insert(schema.practiceMessages).values(msgRows).onConflictDoNothing();
  assertExpected("practice_messages", (await db.select({ c: schema.practiceMessages.id }).from(schema.practiceMessages)).length);

  // 10) practice_evaluations —— 1
  await db
    .insert(schema.practiceEvaluations)
    .values({
      id: PRACTICE_FEEDBACK_DONE.id,
      sessionId: PRACTICE_FEEDBACK_DONE.sessionId,
      clear: PRACTICE_FEEDBACK_DONE.clear,
      toAdd: PRACTICE_FEEDBACK_DONE.toAdd,
      notCovered: PRACTICE_FEEDBACK_DONE.notCovered,
      dimensions: PRACTICE_FEEDBACK_DONE.dimensions,
      evidenceRounds: PRACTICE_FEEDBACK_DONE.evidenceRounds,
      providerLabel: PRACTICE_FEEDBACK_DONE.providerLabel,
      promptVersion: PRACTICE_FEEDBACK_DONE.promptVersion,
      generatedAt: new Date(PRACTICE_FEEDBACK_DONE.generatedAt),
      confidenceNotice: PRACTICE_FEEDBACK_DONE.confidenceNotice,
      nextStep: PRACTICE_FEEDBACK_DONE.nextStep,
      isDemo: true,
    })
    .onConflictDoNothing();
  assertExpected("practice_evaluations", (await db.select({ c: schema.practiceEvaluations.id }).from(schema.practiceEvaluations)).length);

  // 11) feynman_notes —— 4（归属陈思；session_id 允许为未 seed 的历史会话）
  await db
    .insert(schema.feynmanNotes)
    .values(
      NOTES.map((n) => ({
        id: n.id,
        sessionId: n.sessionId,
        nodeId: n.nodeId,
        userId: "u-chensi",
        title: n.title,
        content: n.content,
        keyTerms: n.keyTerms,
        pendingQuestions: n.pendingQuestions,
        selfAssessed: n.selfAssessed,
        updatedAt: new Date(n.updatedAt),
        statusFilter: n.statusFilter,
        sourceTag: n.sourceTag,
        isDemo: true,
      })),
    )
    .onConflictDoNothing();
  assertExpected("feynman_notes", (await db.select({ c: schema.feynmanNotes.id }).from(schema.feynmanNotes)).length);

  // 12) 演示账号口令（M2 认证用；LOCAL DEV ONLY）
  //     口令来自本地 .env.local 的 DEMO_PASSWORD（gitignored，不落 Git），bcrypt cost 10。
  //     未配置则跳过并提示 —— 演示账号暂时不能口令登录，不影响其它 seed 数据。
  const demoPassword = process.env.DEMO_PASSWORD;
  if (demoPassword) {
    const demoHash = await hashPassword(demoPassword);
    const demoIds = ALL_ROLES.map((r) => USER_PROFILES[r].id);
    await db
      .update(schema.users)
      .set({ passwordHash: demoHash })
      .where(inArray(schema.users.id, demoIds));
    console.log(`  ✓ 已为 ${demoIds.length} 个演示账号设置本地开发口令（bcrypt cost 10，来源 DEMO_PASSWORD，LOCAL DEV ONLY）`);
  } else {
    console.warn("  ! 未配置 DEMO_PASSWORD，跳过演示账号口令设置（演示账号暂不能口令登录）");
  }

  await pool.end();
  console.log("\n[seed 完成] 全部数量对拍通过（is_demo=true）。");
}

main().catch(async (e) => {
  console.error("\n[seed 失败]", e instanceof Error ? e.message : e);
  process.exit(1);
});
