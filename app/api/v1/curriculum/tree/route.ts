/**
 * 知径 Pathfinder — GET /api/v1/curriculum/tree（M3）
 *
 * 返回当前 published 课程完整知识树（章节分组 + 节点摘要），
 * 数据来自 PostgreSQL pathfinder（真实数据链：API → service → Drizzle → PG）。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getCurriculumTree } from "@/lib/curriculum/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  try {
    const tree = await getCurriculumTree();
    if (!tree) return fail("CURRICULUM_NOT_FOUND", "暂无已发布课程", { status: 404 });
    return ok(tree);
  } catch (e) {
    console.error("[M3] curriculum/tree", e);
    return err.internal();
  }
}
