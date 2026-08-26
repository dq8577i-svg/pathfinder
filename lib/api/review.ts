/** 复习中心 API 客户端（P1/P2） */
import { api } from "./client";

export type ReviewCardStatus = "new" | "reviewing" | "mastered";

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

export function listReviewCards(
  pathId: string,
  status?: ReviewCardStatus,
): Promise<ReviewCardDto[]> {
  const sp = status ? `&status=${status}` : "";
  return api<{ cards: ReviewCardDto[] }>(
    `/review/cards?pathId=${encodeURIComponent(pathId)}${sp}`,
  ).then((d) => d.cards);
}

export function generateReviewCards(
  pathId: string,
  count?: number,
): Promise<{ created: number; provider: "demo" | "deepseek"; cards: ReviewCardDto[] }> {
  return api(`/review/cards/generate`, { method: "POST", body: { pathId, count } });
}

export function updateReviewCardStatus(
  cardId: string,
  status: ReviewCardStatus,
): Promise<ReviewCardDto> {
  return api<{ card: ReviewCardDto }>(`/review/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    body: { status },
  }).then((d) => d.card);
}
