/**
 * 知径 Pathfinder — POST /api/v1/paths/:pathId/resources/refresh（P1/P2 资源检索层）
 *
 * 当前用户对自己路径的节点做一次「资料补充」：真实 Web 搜索（Tavily）→
 * 规范化/去重/分级 → 写 resources + node_resources + 更新 evidence_coverage。
 * 幂等：已有资源的节点自动跳过。他人/不存在路径统一 404。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { refreshPathResources } from "@/lib/resource/service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ pathId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { pathId } = await params;
  try {
    const result = await refreshPathResources(user.id, pathId);
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "PATH_NOT_FOUND") {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] paths/:pathId/resources/refresh", e);
    return err.internal();
  }
}
