/**
 * P1/P2 学习模块共享辅助：路径归属校验 + 节点读取。
 * 归属一律以会话 userId 校验（SQL 级），绝不接受客户端传入 user_id。
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { knowledgeNodes, learningPathNodes, learningPaths } from "@/lib/db/schema";

export class PathNotFoundError extends Error {
  constructor() {
    super("PATH_NOT_FOUND");
  }
}

/** 校验路径存在且属于该用户；否则抛 PathNotFoundError（路由统一映射 404） */
export async function assertPathOwned(userId: string, pathId: string): Promise<void> {
  const rows = await db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new PathNotFoundError();
}

/** 路径节点（按 sortOrder 排序）。调用前应已确认路径归属。 */
export async function getPathNodes(
  pathId: string,
): Promise<typeof knowledgeNodes.$inferSelect[]> {
  const rows = await db
    .select({ node: knowledgeNodes })
    .from(learningPathNodes)
    .innerJoin(knowledgeNodes, eq(learningPathNodes.nodeId, knowledgeNodes.id))
    .where(eq(learningPathNodes.pathId, pathId))
    .orderBy(asc(learningPathNodes.sortOrder));
  return rows.map((r) => r.node);
}

/** 生成业务主键（与 demo id 风格一致：前缀-随机段） */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
}
