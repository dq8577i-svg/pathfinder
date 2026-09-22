/** 个人资料库 API 客户端（P1/P2） */
import { api, ApiError } from "./client";

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

/** 把真实文件作为 multipart 上传到服务端；浏览器不得直接接触 MinIO 凭据。 */
export async function uploadLibraryFile(input: {
  pathId: string;
  file: File;
  title?: string;
  sourceName?: string;
  tags?: string[];
  memo?: string;
}): Promise<LibraryItemDto> {
  const form = new FormData();
  form.set("pathId", input.pathId);
  form.set("file", input.file);
  if (input.title?.trim()) form.set("title", input.title.trim());
  if (input.sourceName?.trim()) form.set("sourceName", input.sourceName.trim());
  if (input.tags?.length) form.set("tags", JSON.stringify(input.tags));
  if (input.memo?.trim()) form.set("memo", input.memo.trim());

  const res = await fetch("/api/v1/library/upload", {
    method: "POST",
    body: form,
  });
  const payload = (await res.json().catch(() => null)) as
    | { data?: { item: LibraryItemDto }; error?: { code?: string; message?: string } }
    | null;
  if (!res.ok || !payload?.data?.item) {
    throw new ApiError(
      payload?.error?.code ?? "UPLOAD_FAILED",
      res.status,
      payload?.error?.message ?? "文件上传失败，请稍后重试",
    );
  }
  return payload.data.item;
}

/** 获取短时下载地址；对象存储地址不永久暴露在资料记录中。 */
export async function getLibraryDownloadUrl(id: string): Promise<string> {
  const d = await api<{ url: string }>(`/library/${encodeURIComponent(id)}/download`);
  if (!d.url) throw new Error("服务端未返回可用的下载地址");
  return d.url;
}
