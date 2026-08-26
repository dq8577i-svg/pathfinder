/**
 * 知径 Pathfinder — GET /api/v1/knowledge/nodes/:nodeId/resources（M3）
 *
 * 节点资源证据（A/B/C grade、来源、url、reason、accessibilityStatus 等领域字段），
 * 从 PostgreSQL resources 经 node_resources 关联查询，按 sort_order 排序。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getNodeWithResources } from "@/lib/curriculum/service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { nodeId } = await params;
  try {
    const hit = await getNodeWithResources(nodeId);
    if (!hit) return fail("NODE_NOT_FOUND", "知识节点不存在", { status: 404 });
    return ok({ nodeId, resources: hit.resources });
  } catch (e) {
    console.error("[M3] knowledge/nodes/:nodeId/resources", e);
    return err.internal();
  }
}
