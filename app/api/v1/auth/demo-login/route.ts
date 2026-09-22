import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  createSession,
  revokeSessionByToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { buildPublicProfile } from "@/lib/auth/user";

const demoRoles = [
  "new_learner",
  "learner",
  "practice_learner",
  "content_admin",
  "org_admin",
] as const;

const demoUserIds: Record<(typeof demoRoles)[number], string> = {
  new_learner: "u-linran",
  learner: "u-chensi",
  practice_learner: "u-zhouning",
  content_admin: "u-chenlan",
  org_admin: "u-zhanglei",
};

const bodySchema = z.object({ role: z.enum(demoRoles) }).strict();

export async function POST(request: Request) {
  if (process.env.ALLOW_DEMO_LOGIN !== "true") {
    return fail("DEMO_LOGIN_DISABLED", "演示身份登录未开放", { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail("INVALID_INPUT", "演示角色不合法", { status: 422 });
  }

  try {
    const expectedId = demoUserIds[parsed.data.role];
    const user = (
      await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, expectedId),
            eq(users.role, parsed.data.role),
            eq(users.isDemo, true),
          ),
        )
        .limit(1)
    )[0];
    if (!user) return fail("DEMO_USER_NOT_FOUND", "演示账号尚未初始化", { status: 503, retryable: true });

    const cookieStore = await cookies();
    await revokeSessionByToken(cookieStore.get(SESSION_COOKIE)?.value);
    const token = await createSession(user.id);
    cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions());
    return ok({ user: await buildPublicProfile(user) });
  } catch {
    return fail("DEMO_LOGIN_UNAVAILABLE", "演示登录暂不可用", { status: 503, retryable: true });
  }
}
