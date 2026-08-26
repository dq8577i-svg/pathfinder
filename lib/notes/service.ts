/**
 * 知径 Pathfinder — 费曼笔记服务（M6）
 *
 * 归属：所有查询/写入都以会话解析出的 userId 出发，绝不接受客户端传入 user_id。
 * 单条笔记用 SQL 层 id + user_id 双条件，未命中/非本人统一返回 null（路由 404）。
 * DB（feynman_notes 表）为唯一 source of truth；不读 lib/demo、不读 localStorage。
 * 进度聚合 GET /api/v1/me/progress：从 learning_paths / practice_sessions /
 * practice_evaluations / feynman_notes 实时统计，DB 为真实数据源。
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  feynmanNotes,
  knowledgeNodes,
  learningPaths,
  practiceEvaluations,
  practiceSessions,
} from "@/lib/db/schema";
import { serializeFeynmanNote } from "@/lib/api/serialize";
import type { CreateNoteInput, PatchNoteInput } from "./input";

export class NotesError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** 当前用户笔记列表（GET /api/v1/notes），按更新时间倒序 */
export async function listNotesByUser(userId: string) {
  const rows = await db
    .select()
    .from(feynmanNotes)
    .where(eq(feynmanNotes.userId, userId))
    .orderBy(desc(feynmanNotes.updatedAt));
  return rows.map((r) => serializeFeynmanNote(r));
}

/** 单条笔记（GET /api/v1/notes/:noteId），未命中/非本人 → null */
export async function getNoteForUser(noteId: string, userId: string) {
  const row = (
    await db
      .select()
      .from(feynmanNotes)
      .where(and(eq(feynmanNotes.id, noteId), eq(feynmanNotes.userId, userId)))
      .limit(1)
  )[0];
  return row ? serializeFeynmanNote(row) : null;
}

/** 新建笔记（POST /api/v1/notes）：nodeId 若提供必须存在（避免 FK 违规 500） */
export async function createNote(userId: string, input: CreateNoteInput) {
  if (input.nodeId) {
    const exists = await db
      .select({ id: knowledgeNodes.id })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, input.nodeId))
      .limit(1);
    if (!exists[0]) throw new NotesError("NODE_NOT_FOUND", 404);
  }

  const now = new Date();
  const id = `note-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  await db.insert(feynmanNotes).values({
    id,
    userId,
    sessionId: input.sessionId ?? null,
    nodeId: input.nodeId ?? null,
    title: input.title,
    content: input.content,
    keyTerms: input.keyTerms ?? [],
    pendingQuestions: input.pendingQuestions ?? [],
    selfAssessed: input.selfAssessed ?? false,
    updatedAt: now,
    statusFilter: input.statusFilter ?? "all",
    sourceTag: input.sourceTag ?? "ai_draft",
    isDemo: false,
  });

  const row = (await db.select().from(feynmanNotes).where(eq(feynmanNotes.id, id)).limit(1))[0];
  if (!row) throw new NotesError("NOTE_CREATE_FAILED", 500);
  return serializeFeynmanNote(row);
}

/** 更新笔记（PATCH /api/v1/notes/:noteId），未命中/非本人 → null */
export async function updateNote(noteId: string, userId: string, patch: PatchNoteInput) {
  const existing = (
    await db
      .select({ id: feynmanNotes.id })
      .from(feynmanNotes)
      .where(and(eq(feynmanNotes.id, noteId), eq(feynmanNotes.userId, userId)))
      .limit(1)
  )[0];
  if (!existing) return null;

  if (patch.nodeId !== undefined && patch.nodeId !== null) {
    const node = await db
      .select({ id: knowledgeNodes.id })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, patch.nodeId))
      .limit(1);
    if (!node[0]) throw new NotesError("NODE_NOT_FOUND", 404);
  }

  const set: Partial<typeof feynmanNotes.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.content !== undefined) set.content = patch.content;
  if (patch.sessionId !== undefined) set.sessionId = patch.sessionId;
  if (patch.nodeId !== undefined) set.nodeId = patch.nodeId;
  if (patch.keyTerms !== undefined) set.keyTerms = patch.keyTerms;
  if (patch.pendingQuestions !== undefined) set.pendingQuestions = patch.pendingQuestions;
  if (patch.selfAssessed !== undefined) set.selfAssessed = patch.selfAssessed;
  if (patch.statusFilter !== undefined) set.statusFilter = patch.statusFilter;
  if (patch.sourceTag !== undefined) set.sourceTag = patch.sourceTag;

  await db
    .update(feynmanNotes)
    .set(set)
    .where(and(eq(feynmanNotes.id, noteId), eq(feynmanNotes.userId, userId)));

  const row = (await db.select().from(feynmanNotes).where(eq(feynmanNotes.id, noteId)).limit(1))[0];
  return row ? serializeFeynmanNote(row) : null;
}

/** 删除笔记（DELETE /api/v1/notes/:noteId），未命中/非本人 → false */
export async function deleteNote(noteId: string, userId: string): Promise<boolean> {
  const res = await db
    .delete(feynmanNotes)
    .where(and(eq(feynmanNotes.id, noteId), eq(feynmanNotes.userId, userId)));
  return (res.rowCount ?? 0) > 0;
}

/** 学习进度聚合（GET /api/v1/me/progress）：DB 实时统计，仅当前用户数据 */
export async function getProgressForUser(userId: string) {
  // 主路径（is_primary 优先，其次最近活动）
  const [path] = await db
    .select()
    .from(learningPaths)
    .where(eq(learningPaths.userId, userId))
    .orderBy(desc(learningPaths.isPrimary), desc(learningPaths.lastActivityAt))
    .limit(1);

  // 练习会话按状态分组（count(*) 返回 bigint 字符串，统一 Number 强转）
  const practiceRows = await db
    .select({ status: practiceSessions.status, count: sql<number>`count(*)` })
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, userId))
    .groupBy(practiceSessions.status);
  const practiceCount = (s: string) =>
    Number(practiceRows.find((r) => r.status === s)?.count ?? 0);

  // 已完成评价数（仅本人会话）
  const [evalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(practiceEvaluations)
    .innerJoin(practiceSessions, eq(practiceEvaluations.sessionId, practiceSessions.id))
    .where(eq(practiceSessions.userId, userId));

  // 笔记统计
  const noteRows = await db
    .select({ selfAssessed: feynmanNotes.selfAssessed })
    .from(feynmanNotes)
    .where(eq(feynmanNotes.userId, userId));

  const notesTotal = noteRows.length;
  const notesSelfAssessed = noteRows.filter((r) => r.selfAssessed).length;

  return {
    path: path
      ? {
          exists: true,
          id: path.id,
          title: path.title,
          status: path.status,
          completed: path.completedCount,
          total: path.totalCount,
          currentNodeId: path.currentNodeId,
          lastActivityAt: path.lastActivityAt.toISOString(),
        }
      : { exists: false },
    practice: {
      total:
        practiceCount("in_progress") +
        practiceCount("completed") +
        practiceCount("abandoned"),
      inProgress: practiceCount("in_progress"),
      completed: practiceCount("completed"),
      evaluations: Number(evalRow?.count ?? 0),
    },
    notes: {
      total: notesTotal,
      selfAssessed: notesSelfAssessed,
      pending: notesTotal - notesSelfAssessed,
    },
  };
}
