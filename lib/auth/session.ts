/**
 * 知径 Pathfinder — Opaque Session Token（M2）
 *
 * 认证方案（用户已拍板）：不透明会话令牌，不用 JWT in cookie。
 *  - token = crypto.randomBytes(32) → base64url（43 字符，高熵不可预测）
 *  - 数据库 auth_sessions.id 只存 token 的 SHA-256 哈希（绝不明文持久化）
 *  - 明文 token 只出现在 HttpOnly Cookie 中
 *  - 7 天过期；revoked_at 用于吊销；logout 直接删除会话行
 *
 * Cookie 属性：
 *  - HttpOnly / SameSite=Lax / Path=/ / Max-Age=7d
 *  - Secure：仅当 COOKIE_SECURE=true（本地 HTTP 默认关闭，避免浏览器拒绝登录态）
 */
import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authSessions } from "@/lib/db/schema";

export const SESSION_COOKIE = "pf_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

/** 计算会话令牌的 SHA-256 十六进制哈希（存入 auth_sessions.id） */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 生成高熵不透明令牌（32 字节 → base64url） */
export function issueSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Cookie 设置选项（本地 HTTP 环境默认不开 Secure，避免破坏本地登录） */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** 为用户创建会话，返回明文令牌（立即写入 HttpOnly Cookie，DB 只存哈希） */
export async function createSession(userId: string): Promise<string> {
  const token = issueSessionToken();
  await db.insert(authSessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

/** 按明文令牌删除会话（logout）；token 为空时是幂等空操作 */
export async function revokeSessionByToken(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(authSessions).where(eq(authSessions.id, hashToken(token)));
}
