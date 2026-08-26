/**
 * 知径 Pathfinder — POST /api/v1/auth/register（M2）
 *
 * 邮箱归一化（trim + 小写）→ 唯一性校验 → bcrypt 哈希 → 建用户 → 自动登录。
 * 绝不存储明文口令；成功即下发 HttpOnly 会话 Cookie。
 */
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { err, ok } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth/session";
import { buildPublicProfile } from "@/lib/auth/user";

const registerSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(8).max(100),
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err.badRequest("请求体必须是合法 JSON");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "body");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return err.badRequest("注册信息不合法");
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password, displayName } = parsed.data;

  // 邮箱唯一性（命中即提示已注册，不泄露更多信息）
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return err.conflict("该邮箱已注册，请直接登录", { email: "该邮箱已注册" });
  }

  const passwordHash = await hashPassword(password);
  const id = `u-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

  let inserted;
  try {
    inserted = (
      await db
        .insert(users)
        .values({
          id,
          email,
          passwordHash,
          displayName,
          role: "new_learner",
          isDemo: false,
        })
        .returning()
    )[0];
  } catch (e) {
    // 并发唯一约束兜底（email 唯一索引）
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      return err.conflict("该邮箱已注册，请直接登录", { email: "该邮箱已注册" });
    }
    throw e;
  }

  // 自动登录：创建会话 + 下发 HttpOnly Cookie
  const token = await createSession(inserted.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  return ok({ user: await buildPublicProfile(inserted) });
}
