/**
 * 知径 Pathfinder — 练习系统服务（M4）
 *
 * 归属：所有查询/写入都以会话解析出的 userId 出发，绝不接受客户端传入 user_id。
 * 会话必须属于当前用户：SQL 层 id + user_id 双条件，未命中/非本人统一 404。
 * 幂等：messages 携带 client_id，唯一索引 (session_id, client_id) 兜底并发重复提交。
 * 状态机：in_progress → completed / abandoned；completed 后不再接受消息。
 * AI 兜底：generatePractice* 自带 Mock 兜底，练习流程不因 AI 失败而中断。
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  knowledgeNodes,
  practiceEvaluations,
  practiceMessages,
  practiceSessions,
} from "@/lib/db/schema";
import { serializePracticeFeedback, serializePracticeMessage, serializePracticeSession } from "@/lib/api/serialize";
import {
  generatePracticeEvaluation,
  generatePracticeFollowUp,
  generatePracticeOpening,
  type PracticeNodeContext,
} from "@/lib/practice/ai";
import { PRACTICE_TOTAL_ROUNDS } from "@/lib/practice/input";
import type {
  AddMessageInput,
  CreateSessionInput,
  PatchSessionInput,
} from "@/lib/practice/input";
import type { PracticeFeedback, PracticeMessage, PracticeSession } from "@/lib/types";

export interface PracticeSessionDetail {
  session: PracticeSession;
  feedback: PracticeFeedback | null;
}

/** 创建会话（POST /api/v1/practice/sessions）：单事务建会话 + AI 开场追问 */
export async function createPracticeSession(userId: string, input: CreateSessionInput) {
  const node = await loadNode(input.nodeId);
  if (!node) throw new PracticeError("NODE_NOT_FOUND", 404);

  const now = new Date();
  const sessionId = `sess-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const opening = await generatePracticeOpening(nodeContext(node));

  await db.transaction(async (tx) => {
    await tx.insert(practiceSessions).values({
      id: sessionId,
      userId,
      nodeId: node.id,
      pathId: input.pathId ?? null,
      status: "in_progress",
      currentRound: 1,
      totalRounds: PRACTICE_TOTAL_ROUNDS,
      startedAt: now,
      updatedAt: now,
      draft: "",
      syncState: "saved",
      isDemo: false,
    });
    await tx.insert(practiceMessages).values({
      id: `msg-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      sessionId,
      role: "ai",
      content: opening,
      turnIndex: 1,
      createdAt: now,
      status: "sent",
      isDemo: false,
    });
  });

  const detail = await getPracticeSession(userId, sessionId);
  if (!detail) throw new PracticeError("SESSION_NOT_FOUND", 500);
  return detail;
}

/** 会话详情（GET）：归属校验 + 消息 + 评价 */
export async function getPracticeSession(
  userId: string,
  sessionId: string,
): Promise<PracticeSessionDetail | null> {
  const session = await loadOwnedSession(sessionId, userId);
  if (!session) return null;

  const [msgs, evals] = await Promise.all([
    loadMessages(sessionId),
    db
      .select()
      .from(practiceEvaluations)
      .where(eq(practiceEvaluations.sessionId, sessionId))
      .limit(1),
  ]);

  return {
    session: serializePracticeSession(
      session,
      msgs.map((m) => serializePracticeMessage(m)),
    ),
    feedback: evals[0] ? serializePracticeFeedback(evals[0]) : null,
  };
}

export interface AddMessageResult {
  session: PracticeSession;
  userMessage: PracticeMessage;
  aiMessage: PracticeMessage;
  idempotent: boolean;
}

/** 发送讲解 + AI 追问（POST .../messages）：幂等 client_id，轮次推进，单事务 */
export async function addPracticeMessage(
  userId: string,
  sessionId: string,
  input: AddMessageInput,
): Promise<AddMessageResult> {
  const session = await loadOwnedSession(sessionId, userId);
  if (!session) throw new PracticeError("SESSION_NOT_FOUND", 404);
  if (session.status === "completed" || session.status === "abandoned") {
    throw new PracticeError("SESSION_CLOSED", 409);
  }

  const node = await loadNode(session.nodeId ?? "");
  const ctx = nodeContext(node ?? { id: session.nodeId ?? "" });

  const result = await db.transaction(async (tx) => {
    // 幂等：同 (session, clientId) 已存在 → 返回既有消息对，不重复创建
    if (input.clientId) {
      const existing = await tx
        .select()
        .from(practiceMessages)
        .where(
          and(
            eq(practiceMessages.sessionId, sessionId),
            eq(practiceMessages.clientId, input.clientId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        const aiMsg = await tx
          .select()
          .from(practiceMessages)
          .where(
            and(
              eq(practiceMessages.sessionId, sessionId),
              eq(practiceMessages.role, "ai"),
              eq(practiceMessages.turnIndex, existing[0].turnIndex),
            ),
          )
          .orderBy(asc(practiceMessages.createdAt))
          .limit(1);
        if (!aiMsg[0]) throw new PracticeError("SESSION_INCONSISTENT", 500);
        const fresh = await reloadSessionInTx(tx, sessionId);
        return {
          session: serializePracticeSession(fresh, (await loadMessagesInTx(tx, sessionId)).map(serializePracticeMessage)),
          userMessage: serializePracticeMessage(existing[0]),
          aiMessage: serializePracticeMessage(aiMsg[0]),
          idempotent: true,
        } as const;
      }
    }

    const nextTurn = Math.min(session.currentRound + 1, session.totalRounds);
    if (nextTurn > session.totalRounds) {
      throw new PracticeError("ROUNDS_COMPLETE", 409);
    }

    const now = new Date();
    const userMsgId = `msg-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const aiMsgId = `msg-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

    await tx.insert(practiceMessages).values({
      id: userMsgId,
      sessionId,
      role: "user",
      content: input.content,
      turnIndex: nextTurn,
      createdAt: now,
      status: "sent",
      clientId: input.clientId ?? null,
      isDemo: false,
    });

    // AI 追问在事务内生成（自带 Mock 兜底，不抛错）
    const history = await loadMessagesInTx(tx, sessionId);
    const followUp = await generatePracticeFollowUp(ctx, [
      ...history.map(toDomainMessage),
      {
        id: userMsgId,
        role: "user" as const,
        content: input.content,
        turnIndex: nextTurn,
        createdAt: now.toISOString(),
        status: "sent" as const,
      },
    ]);

    await tx.insert(practiceMessages).values({
      id: aiMsgId,
      sessionId,
      role: "ai",
      content: followUp,
      turnIndex: nextTurn,
      createdAt: new Date(),
      status: "sent",
      isDemo: false,
    });

    await tx
      .update(practiceSessions)
      .set({ currentRound: nextTurn, updatedAt: new Date() })
      .where(eq(practiceSessions.id, sessionId));

    const fresh = await reloadSessionInTx(tx, sessionId);
    const allMsgs = await loadMessagesInTx(tx, sessionId);
    const userRow = allMsgs.find((m) => m.id === userMsgId);
    const aiRow = allMsgs.find((m) => m.id === aiMsgId);
    if (!userRow || !aiRow) throw new PracticeError("SESSION_INCONSISTENT", 500);
    return {
      session: serializePracticeSession(fresh, allMsgs.map(serializePracticeMessage)),
      userMessage: serializePracticeMessage(userRow),
      aiMessage: serializePracticeMessage(aiRow),
      idempotent: false,
    } as const;
  });

  return result;
}

/** 生成评价（POST .../evaluate）：幂等（已存在直接返回），完成会话 */
export async function evaluatePracticeSession(
  userId: string,
  sessionId: string,
): Promise<{ feedback: PracticeFeedback; idempotent: boolean }> {
  const session = await loadOwnedSession(sessionId, userId);
  if (!session) throw new PracticeError("SESSION_NOT_FOUND", 404);

  const evals = await db
    .select()
    .from(practiceEvaluations)
    .where(eq(practiceEvaluations.sessionId, sessionId))
    .limit(1);
  if (evals[0]) {
    return { feedback: serializePracticeFeedback(evals[0]), idempotent: true };
  }

  const msgs = await loadMessages(sessionId);
  const userMsgs = msgs.filter((m) => m.role === "user");
  if (userMsgs.length === 0) {
    throw new PracticeError("NOTHING_TO_EVALUATE", 409);
  }

  const node = await loadNode(session.nodeId ?? "");
  const nodeCtx = nodeContext(node ?? { id: session.nodeId ?? "" });
  const evalInput = await generatePracticeEvaluation(nodeCtx, msgs.map(toDomainMessage));

  const evalId = `eval-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await db.transaction(async (tx) => {
    await tx.insert(practiceEvaluations).values({
      id: evalId,
      sessionId,
      clear: evalInput.clear,
      toAdd: evalInput.toAdd,
      notCovered: evalInput.notCovered,
      dimensions: evalInput.dimensions,
      evidenceRounds: evalInput.evidenceRounds,
      providerLabel: evalInput.providerLabel,
      promptVersion: evalInput.promptVersion,
      generatedAt: new Date(),
      confidenceNotice: evalInput.confidenceNotice,
      nextStep: evalInput.nextStep,
      isDemo: false,
    });
    await tx
      .update(practiceSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(practiceSessions.id, sessionId));
  });

  const row = (
    await db
      .select()
      .from(practiceEvaluations)
      .where(eq(practiceEvaluations.id, evalId))
      .limit(1)
  )[0];
  return { feedback: serializePracticeFeedback(row), idempotent: false };
}

/** 部分更新（PATCH）：草稿 / 同步状态 / 放弃会话 */
export async function patchPracticeSession(
  userId: string,
  sessionId: string,
  patch: PatchSessionInput,
) {
  const session = await loadOwnedSession(sessionId, userId);
  if (!session) throw new PracticeError("SESSION_NOT_FOUND", 404);

  const now = new Date();
  await db
    .update(practiceSessions)
    .set({
      ...(patch.draft !== undefined ? { draft: patch.draft } : {}),
      ...(patch.draftSavedAt !== undefined
        ? { draftSavedAt: new Date(patch.draftSavedAt) }
        : {}),
      ...(patch.syncState !== undefined ? { syncState: patch.syncState } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: now,
    })
    .where(eq(practiceSessions.id, sessionId));

  return getPracticeSession(userId, sessionId);
}

/* ---------------- 内部辅助 ---------------- */

export class PracticeError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** db.transaction 回调里的 tx 类型（drizzle 不直接暴露，从函数参数提取） */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** DB 行 → 领域 PracticeMessage（供 AI 上下文消费） */
function toDomainMessage(m: typeof practiceMessages.$inferSelect): PracticeMessage {
  return {
    id: m.id,
    role: m.role as "user" | "ai",
    content: m.content,
    turnIndex: m.turnIndex,
    createdAt: m.createdAt.toISOString(),
    status: m.status as PracticeMessage["status"],
  };
}

async function loadOwnedSession(sessionId: string, userId: string) {
  return (
    await db
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)))
      .limit(1)
  )[0];
}

async function loadMessages(sessionId: string) {
  return db
    .select()
    .from(practiceMessages)
    .where(eq(practiceMessages.sessionId, sessionId))
    .orderBy(asc(practiceMessages.turnIndex), asc(practiceMessages.createdAt));
}

async function loadMessagesInTx(tx: Tx, sessionId: string) {
  return tx
    .select()
    .from(practiceMessages)
    .where(eq(practiceMessages.sessionId, sessionId))
    .orderBy(asc(practiceMessages.turnIndex), asc(practiceMessages.createdAt));
}

async function reloadSessionInTx(tx: Tx, sessionId: string) {
  return (
    await tx
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, sessionId))
      .limit(1)
  )[0];
}

async function loadNode(nodeId: string) {
  if (!nodeId) return null;
  return (
    await db
      .select({
        id: knowledgeNodes.id,
        title: knowledgeNodes.title,
        capabilityGoal: knowledgeNodes.capabilityGoal,
      })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, nodeId))
      .limit(1)
  )[0];
}

function nodeContext(node: { id: string; title?: string | null; capabilityGoal?: string | null }): PracticeNodeContext {
  return { id: node.id, title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" };
}
