/**
 * 知径 Pathfinder — GET /api/v1/labs?pathId=（P1/P2 情境练习场）
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { listScenarios } from "@/lib/labs/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const pathId = new URL(req.url).searchParams.get("pathId") ?? "";
  if (!pathId) return fail("INVALID_INPUT", "缺少 pathId 参数", { status: 422 });
  try {
    const scenarios = await listScenarios(user.id, pathId);
    return ok({ scenarios });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] labs", e);
    return err.internal();
  }
}
