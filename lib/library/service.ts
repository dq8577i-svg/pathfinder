/**
 * 知径 Pathfinder — 个人资料库（P1/P2）
 *
 * library_items 表（user_id + path_id 绑定，绝不读 demo）。
 * 用户私有数据：收藏的路径资源（resource）、手动添加的链接/文件元数据/笔记
 * （link / upload / note）。切主题即切 path_id，资料库随之隔离。
 * 收藏校验：资源必须真实存在于该路径（node_resources ⋈ learning_path_nodes），
 * 同用户收藏同一资源幂等（数据库唯一索引兜底）。
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learningPathNodes, libraryItems, nodeResources, resources } from "@/lib/db/schema";
import { assertPathOwned, newId, PathNotFoundError } from "@/lib/modules/shared";

export const LIBRARY_SOURCE_TYPES = ["resource", "upload", "note", "link"] as const;
export type LibrarySourceType = (typeof LIBRARY_SOURCE_TYPES)[number];

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

export interface CreateLibraryInput {
  pathId: string;
  kind: "link" | "upload" | "note";
  title: string;
  url?: string | null;
  sourceName?: string;
  tags?: string[];
  memo?: string;
  objectKey?: string | null;
  size?: string | null;
}

/** 收藏的资源不在该用户当前路径上（路由映射 404） */
export class ResourceNotOnPathError extends Error {
  constructor() {
    super("RESOURCE_NOT_ON_PATH");
  }
}

export async function listLibraryItems(userId: string, pathId: string): Promise<LibraryItemDto[]> {
  await assertPathOwned(userId, pathId);
  const rows = await db
    .select()
    .from(libraryItems)
    .where(and(eq(libraryItems.userId, userId), eq(libraryItems.pathId, pathId)))
    .orderBy(desc(libraryItems.createdAt));
  return rows.map(toDto);
}

/** 用户手动添加资料：链接（url 必填）/ 文件元数据 / 笔记，均落库 */
export async function createLibraryItem(
  userId: string,
  input: CreateLibraryInput,
): Promise<LibraryItemDto> {
  await assertPathOwned(userId, input.pathId);
  const kind = input.kind;
  if (kind === "link" && !input.url?.trim()) {
    throw new Error("链接类型需要填写 URL");
  }
  if (!input.title.trim()) {
    throw new Error("请填写资料标题");
  }

  const now = new Date();
  const tags = (input.tags ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);

  let status: LibraryItemDto["status"] = "verified";
  let licenseNote = "由用户添加；请确保你拥有保存与分享的权利。";
  let url: string | null = null;
  let objectKey: string | null = null;
  let size: string | null = null;

  if (kind === "link") {
    status = "pending";
    url = input.url!.trim();
  }
  if (kind === "upload") {
    // 本轮不真上传：仅保存元数据（object_key / size），与演示一致
    objectKey = input.objectKey ?? null;
    size = input.size ?? null;
    licenseNote = "本人上传，仅自己可见。";
  }

  const id = newId("lib");
  await db.insert(libraryItems).values({
    id,
    userId,
    pathId: input.pathId,
    sourceType: kind,
    title: input.title.trim(),
    url,
    sourceName: input.sourceName?.trim() || "手动添加",
    tags,
    memo: input.memo ?? "",
    status,
    objectKey,
    size,
    licenseNote,
    checkedAt: now,
  });

  return {
    id,
    pathId: input.pathId,
    nodeId: null,
    sourceType: kind,
    title: input.title.trim(),
    url,
    sourceName: input.sourceName?.trim() || "手动添加",
    tags,
    memo: input.memo ?? "",
    status,
    objectKey,
    size,
    licenseNote,
    checkedAt: now.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** 收藏路径上的真实资源进资料库：校验资源确在该路径，同用户收藏幂等 */
export async function favoriteResource(
  userId: string,
  pathId: string,
  resourceId: string,
): Promise<LibraryItemDto> {
  await assertPathOwned(userId, pathId);

  const existing = await db
    .select()
    .from(libraryItems)
    .where(and(eq(libraryItems.userId, userId), eq(libraryItems.resourceId, resourceId)))
    .limit(1);
  if (existing.length > 0) return toDto(existing[0]);

  // 资源必须真实挂在该路径的某个节点上（跨用户共享资源，但路径成员资格归属当前用户）
  const rows = await db
    .select({ resource: resources, nodeId: nodeResources.nodeId })
    .from(nodeResources)
    .innerJoin(resources, eq(nodeResources.resourceId, resources.id))
    .innerJoin(learningPathNodes, eq(nodeResources.nodeId, learningPathNodes.nodeId))
    .where(and(eq(learningPathNodes.pathId, pathId), eq(nodeResources.resourceId, resourceId)))
    .limit(1);
  if (rows.length === 0) throw new ResourceNotOnPathError();

  const id = newId("lib");
  const now = new Date();
  await db.insert(libraryItems).values({
    id,
    userId,
    pathId,
    sourceType: "resource",
    resourceId,
    nodeId: rows[0].nodeId,
    title: rows[0].resource.title,
    url: rows[0].resource.url,
    sourceName: rows[0].resource.sourceName,
    tags: [],
    memo: "",
    status: "verified",
    licenseNote: rows[0].resource.licenseNote ?? "公开来源；仅保存链接与摘要。",
    checkedAt: rows[0].resource.checkedAt,
  });

  return {
    id,
    pathId,
    nodeId: rows[0].nodeId,
    sourceType: "resource",
    title: rows[0].resource.title,
    url: rows[0].resource.url,
    sourceName: rows[0].resource.sourceName,
    tags: [],
    memo: "",
    status: "verified",
    objectKey: null,
    size: null,
    licenseNote: rows[0].resource.licenseNote ?? "公开来源；仅保存链接与摘要。",
    checkedAt: rows[0].resource.checkedAt ? rows[0].resource.checkedAt.toISOString() : null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function deleteLibraryItem(userId: string, itemId: string): Promise<void> {
  const rows = await db
    .delete(libraryItems)
    .where(and(eq(libraryItems.id, itemId), eq(libraryItems.userId, userId)))
    .returning({ id: libraryItems.id });
  if (rows.length === 0) throw new PathNotFoundError();
}

function toDto(r: typeof libraryItems.$inferSelect): LibraryItemDto {
  return {
    id: r.id,
    pathId: r.pathId,
    nodeId: r.nodeId,
    sourceType: (r.sourceType as LibrarySourceType) ?? "link",
    title: r.title,
    url: r.url,
    sourceName: r.sourceName,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    memo: r.memo,
    status: (r.status as LibraryItemDto["status"]) ?? "verified",
    objectKey: r.objectKey,
    size: r.size,
    licenseNote: r.licenseNote,
    checkedAt: r.checkedAt ? r.checkedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
