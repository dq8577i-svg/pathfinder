/** 作品集 API 客户端（P1/P2） */
import { api } from "./client";

export type PortfolioType = "project" | "note" | "link";
export type PortfolioVisibility = "private" | "shared" | "public_link";

export interface PortfolioItemDto {
  id: string;
  pathId: string;
  title: string;
  type: PortfolioType;
  url: string | null;
  description: string;
  visibility: PortfolioVisibility;
  createdAt: string;
  updatedAt: string;
}

export function listPortfolioItems(pathId: string): Promise<PortfolioItemDto[]> {
  return api<{ items: PortfolioItemDto[] }>(`/portfolio?pathId=${encodeURIComponent(pathId)}`).then(
    (d) => d.items,
  );
}

export function createPortfolioItem(input: {
  pathId: string;
  title: string;
  type: PortfolioType;
  url?: string | null;
  description?: string;
  visibility?: PortfolioVisibility;
}): Promise<PortfolioItemDto> {
  return api<{ item: PortfolioItemDto }>("/portfolio", { method: "POST", body: input }).then(
    (d) => d.item,
  );
}

export function updatePortfolioItem(
  id: string,
  patch: Partial<{
    title: string;
    type: PortfolioType;
    url: string | null;
    description: string;
    visibility: PortfolioVisibility;
  }>,
): Promise<PortfolioItemDto> {
  return api<{ item: PortfolioItemDto }>(`/portfolio/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  }).then((d) => d.item);
}

export function deletePortfolioItem(id: string): Promise<{ deleted: boolean }> {
  return api(`/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
}
