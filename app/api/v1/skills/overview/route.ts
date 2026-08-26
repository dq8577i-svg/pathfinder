/**
 * 知径 Pathfinder — GET /api/v1/skills/overview?pathId=（P1/P2 技能雷达）
 *
 * 从当前用户路径真实派生技能画像：节点 = 维度，等级/置信度 = 节点状态 + 资料/评价证据。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getSkillsOverview } from "@/lib/skills/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const pathId = new URL(req.url).searchParams.get("pathId") ?? "";
  if (!pathId) return fail("INVALID_INPUT", "缺少 pathId 参数", { status: 422 });
  try {
    const overview = await getSkillsOverview(user.id, pathId);
    return ok(overview);
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] skills/overview", e);
    return err.internal();
  }
}
