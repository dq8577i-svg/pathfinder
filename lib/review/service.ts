/**
 * 知径 Pathfinder — 复习中心（P1/P2）
 *
 * review_cards 表（user_id + path_id 绑定，绝不读 demo）。
 * 生成：对尚无卡片的节点逐个调 AiProvider.generateReviewCards（AI 或模板兜底，
 * sourceType 如实区分 ai/template）。status 流转：new → reviewing → mastered。
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { reviewCards } from "@/lib/db/schema";
import { getAiProvider } from "@/lib/ai";
import { assertPathOwned, getPathNodes, newId, PathNotFoundError } from "@/lib/modules/shared";

export const REVIEW_CARD_STATUSES = ["new", "reviewing", "mastered"] as const;
export type ReviewCardStatus = (typeof REVIEW_CARD_STATUSES)[number];

export interface ReviewCardDto {
  id: string;
  pathId: string;
  nodeId: string | null;
  nodeTitle: string;
  question: string;
  answer: string;
  source: "ai" | "evaluation" | "template";
  status: ReviewCardStatus;
  createdAt: string;
}

export interface GenerateCardsResultDto {
  created: number;
  provider: "demo" | "deepseek";
  cards: ReviewCardDto[];
}

export async function listReviewCards(
  userId: string,
  pathId: string,
  status?: ReviewCardStatus,
): Promise<ReviewCardDto[]> {
  await assertPathOwned(userId, pathId);
  const rows = await db
    .select()
    .from(reviewCards)
    .where(
      and(
        eq(reviewCards.userId, userId),
        eq(reviewCards.pathId, pathId),
        ...(status ? [eq(reviewCards.status, status)] : []),
      ),
    )
    .orderBy(asc(reviewCards.createdAt));
  return rows.map((r) => toDto(r, ""));
}

/** 为尚无卡片的节点生成复习卡片（每节点 2 张，AI 或模板兜底） */
export async function generateReviewCardsForPath(
  userId: string,
  pathId: string,
  count: number = 5,
): Promise<GenerateCardsResultDto> {
  await assertPathOwned(userId, pathId);
  const nodes = await getPathNodes(pathId);

  const existing = await db
    .select({ nodeId: reviewCards.nodeId })
    .from(reviewCards)
    .where(and(eq(reviewCards.userId, userId), eq(reviewCards.pathId, pathId)));
  const existingNodeIds = new Set(existing.map((e) => e.nodeId));

  const candidates = nodes.filter((n) => !existingNodeIds.has(n.id)).slice(0, 4);
  if (candidates.length === 0) {
    return { created: 0, provider: getAiProvider().kind, cards: [] };
  }

  const provider = getAiProvider();
  const source = provider.kind === "deepseek" ? "ai" : "template";
  const perNode = Math.max(1, Math.min(2, Math.ceil(count / candidates.length)));

  const created: typeof reviewCards.$inferSelect[] = [];
  for (const node of candidates) {
    const out = await provider.generateReviewCards({
      nodes: [{ title: node.title, capabilityGoal: node.capabilityGoal, completionCriteria: node.completionCriteria as string[] }],
      count: perNode,
    });
    for (const c of out.cards.slice(0, perNode)) {
      const id = newId("rc");
      await db.insert(reviewCards).values({
        id,
        userId,
        pathId,
        nodeId: node.id,
        question: c.question,
        answer: c.answer,
        source,
        status: "new",
      });
      created.push({
        id,
        userId,
        pathId,
        nodeId: node.id,
        question: c.question,
        answer: c.answer,
        source,
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const titleMap = new Map(nodes.map((n) => [n.id, n.title]));
  return {
    created: created.length,
    provider: provider.kind,
    cards: created.map((r) => toDto(r, titleMap.get(r.nodeId ?? "") ?? "")),
  };
}

/** 更新卡片复习状态（归属校验：id + userId） */
export async function updateReviewCardStatus(
  userId: string,
  cardId: string,
  status: ReviewCardStatus,
): Promise<ReviewCardDto> {
  const rows = await db
    .update(reviewCards)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(reviewCards.id, cardId), eq(reviewCards.userId, userId)))
    .returning();
  if (rows.length === 0) throw new PathNotFoundError();
  const r = rows[0];
  return toDto(r, "");
}

function toDto(r: typeof reviewCards.$inferSelect, nodeTitle: string): ReviewCardDto {
  return {
    id: r.id,
    pathId: r.pathId,
    nodeId: r.nodeId,
    nodeTitle,
    question: r.question,
    answer: r.answer,
    source: (r.source as ReviewCardDto["source"]) ?? "template",
    status: (r.status as ReviewCardStatus) ?? "new",
    createdAt: r.createdAt.toISOString(),
  };
}
