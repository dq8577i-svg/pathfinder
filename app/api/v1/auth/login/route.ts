/**
 * 知径 Pathfinder — POST /api/v1/auth/login（M2）
 *
 * 统一失败语义：无论「用户不存在」还是「密码错误」，都返回相同的
 * 401 INVALID_CREDENTIALS —— 绝不泄露哪个账号存在。
 */
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { fail, ok } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth/session";
import { buildPublicProfile } from "@/lib/auth/user";

const loginSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BAD_REQUEST", "请求体必须是合法 JSON", { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return fail("BAD_REQUEST", "登录信息不合法", { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];

  // 统一失败：用户不存在 / 无口令 / 口令不匹配 → 相同响应
  const invalid = () =>
    fail("INVALID_CREDENTIALS", "邮箱或密码不正确", { status: 401 });

  if (!user || !user.passwordHash) return invalid();
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalid();

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const token = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok({ user: await buildPublicProfile(user) });
}
