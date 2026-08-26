/**
 * 知径 Pathfinder — GET /api/v1/auth/me（M2）
 *
 * 有效会话 → 当前用户；无会话 / 过期 / 已吊销 → 401 UNAUTHENTICATED。
 */
import { err, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { buildPublicProfile } from "@/lib/auth/user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  return ok({ user: await buildPublicProfile(user) });
}
