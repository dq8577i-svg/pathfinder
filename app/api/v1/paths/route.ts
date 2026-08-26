/**
 * 知径 Pathfinder — GET /api/v1/paths（M3）
 *
 * 只返回当前登录用户自己的学习路径（主路径在前）。
 */
import { err, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { listPathsByUser } from "@/lib/path/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  try {
    const paths = await listPathsByUser(user.id);
    return ok({ paths });
  } catch (e) {
    console.error("[M3] paths", e);
    return err.internal();
  }
}
