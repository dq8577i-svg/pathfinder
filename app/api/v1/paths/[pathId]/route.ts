/**
 * 知径 Pathfinder — GET /api/v1/paths/:pathId（M3）
 *
 * 只允许当前用户访问自己的路径；他人路径与不存在统一 404，
 * 不泄露路径是否存在。返回完整路径（nodes / rationale / planVersions）。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getPathForUser } from "@/lib/path/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pathId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { pathId } = await params;
  try {
    const path = await getPathForUser(pathId, user.id);
    if (!path) return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    return ok({ path });
  } catch (e) {
    console.error("[M3] paths/:pathId", e);
    return err.internal();
  }
}
