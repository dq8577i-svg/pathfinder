/**
 * 知径 Pathfinder — GET /api/v1/knowledge/nodes/:nodeId（M3）
 *
 * 单节点详情（含资源），形状与 lib/types.ts KnowledgeNode 契约兼容。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getNodeWithResources } from "@/lib/curriculum/service";
import { serializeNode } from "@/lib/api/serialize";

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
    return ok({ node: serializeNode(hit.node, hit.resources) });
  } catch (e) {
    console.error("[M3] knowledge/nodes/:nodeId", e);
    return err.internal();
  }
}
