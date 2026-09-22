/**
 * 知径 Pathfinder — 作品集（P1/P2）
 *
 * portfolio_items 表（user_id + path_id 绑定，绝不读 demo）。
 * 用户主动沉淀学习资产：类型 project/note/link，可见性 private/shared/public_link。
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { portfolioItems } from "@/lib/db/schema";
import { assertPathOwned, newId, PathNotFoundError } from "@/lib/modules/shared";

export const PORTFOLIO_TYPES = ["project", "note", "link"] as const;
export type PortfolioType = (typeof PORTFOLIO_TYPES)[number];
export const PORTFOLIO_VISIBILITIES = ["private", "shared", "public_link"] as const;
export type PortfolioVisibility = (typeof PORTFOLIO_VISIBILITIES)[number];

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

export interface CreatePortfolioInput {
  pathId: string;
  title: string;
  type: PortfolioType;
  url?: string | null;
  description?: string;
  visibility?: PortfolioVisibility;
}

export async function listPortfolioItems(userId: string, pathId: string): Promise<PortfolioItemDto[]> {
  await assertPathOwned(userId, pathId);
  const rows = await db
    .select()
    .from(portfolioItems)
    .where(and(eq(portfolioItems.userId, userId), eq(portfolioItems.pathId, pathId)))
    .orderBy(desc(portfolioItems.createdAt));
  return rows.map(toDto);
}

export async function createPortfolioItem(
  userId: string,
  input: CreatePortfolioInput,
): Promise<PortfolioItemDto> {
  await assertPathOwned(userId, input.pathId);
  const id = newId("pf");
  const now = new Date();
  await db.insert(portfolioItems).values({
    id,
    userId,
    pathId: input.pathId,
    title: input.title,
    type: input.type,
    url: input.url ?? null,
    description: input.description ?? "",
    visibility: input.visibility ?? "private",
  });
  return {
    id,
    pathId: input.pathId,
    title: input.title,
    type: input.type,
    url: input.url ?? null,
    description: input.description ?? "",
    visibility: input.visibility ?? "private",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export interface UpdatePortfolioInput {
  title?: string;
  type?: PortfolioType;
  url?: string | null;
  description?: string;
  visibility?: PortfolioVisibility;
}

export async function updatePortfolioItem(
  userId: string,
  itemId: string,
  patch: UpdatePortfolioInput,
): Promise<PortfolioItemDto> {
  const rows = await db
    .update(portfolioItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.userId, userId)))
    .returning();
  if (rows.length === 0) throw new PathNotFoundError();
  return toDto(rows[0]);
}

export async function deletePortfolioItem(userId: string, itemId: string): Promise<void> {
  const rows = await db
    .delete(portfolioItems)
    .where(and(eq(portfolioItems.id, itemId), eq(portfolioItems.userId, userId)))
    .returning({ id: portfolioItems.id });
  if (rows.length === 0) throw new PathNotFoundError();
}

function toDto(r: typeof portfolioItems.$inferSelect): PortfolioItemDto {
  return {
    id: r.id,
    pathId: r.pathId,
    title: r.title,
    type: (r.type as PortfolioType) ?? "note",
    url: r.url,
    description: r.description,
    visibility: (r.visibility as PortfolioVisibility) ?? "private",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
