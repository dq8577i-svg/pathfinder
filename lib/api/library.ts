/** 个人资料库 API 客户端（P1/P2） */
import { api } from "./client";

export type LibrarySourceType = "resource" | "upload" | "note" | "link";

export interface LibraryItemDto {
  id: string;
  pathId: string;
  nodeId: string | null;
  sourceType: LibrarySourceType;
  title: string;
  url: string | null;
  sourceName: string;
  tags: string[];
  memo: string;
  status: "verified" | "pending";
  objectKey: string | null;
  size: string | null;
  licenseNote: string;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listLibraryItems(pathId: string): Promise<LibraryItemDto[]> {
  return api<{ items: LibraryItemDto[] }>(
    `/library?pathId=${encodeURIComponent(pathId)}`,
  ).then((d) => d.items);
}

export function createLibraryItem(input: {
  pathId: string;
  kind: "link" | "upload" | "note";
  title: string;
  url?: string | null;
  sourceName?: string;
  tags?: string[];
  memo?: string;
  objectKey?: string | null;
  size?: string | null;
}): Promise<LibraryItemDto> {
  return api<{ item: LibraryItemDto }>("/library", { method: "POST", body: input }).then(
    (d) => d.item,
  );
}

/** 收藏当前路径上的真实资源进资料库 */
export function favoriteResource(pathId: string, resourceId: string): Promise<LibraryItemDto> {
  return api<{ item: LibraryItemDto }>("/library/favorite", {
    method: "POST",
    body: { pathId, resourceId },
  }).then((d) => d.item);
}

export function deleteLibraryItem(id: string): Promise<{ deleted: boolean }> {
  return api(`/library/${encodeURIComponent(id)}`, { method: "DELETE" });
}
