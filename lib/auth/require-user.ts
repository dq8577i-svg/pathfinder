/**
 * 知径 Pathfinder — 当前用户解析（M2）
 *
 * middleware（Edge）只能做「有无 cookie」的廉价门禁；
 * 这里在 Node 侧做权威校验：SHA-256(token) → auth_sessions 命中 →
 * 未吊销 + 未过期 → 返回关联用户。
 */
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { authSessions, users } from "@/lib/db/schema";
import { SESSION_COOKIE, hashToken } from "@/lib/auth/session";

/**
 * 校验当前请求会话并返回用户；无 cookie / 会话不存在 / 已吊销 / 已过期 → null。
 */
export async function getCurrentUser(): Promise<typeof users.$inferSelect | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.id, hashToken(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0]?.user ?? null;
}
