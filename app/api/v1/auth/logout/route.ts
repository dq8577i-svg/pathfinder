/**
 * 知径 Pathfinder — POST /api/v1/auth/logout（M2）
 *
 * 读取 Cookie → 删除 auth_sessions 行（吊销）→ 清除 Cookie。
 * 幂等：重复 logout / 无 Cookie 也返回成功。
 */
import { cookies } from "next/headers";
import { ok } from "@/lib/api/response";
import { SESSION_COOKIE, revokeSessionByToken, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  // 删除会话行（token 为空时为空操作）
  await revokeSessionByToken(token);

  // 清除 Cookie
  store.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });

  return ok({});
}
