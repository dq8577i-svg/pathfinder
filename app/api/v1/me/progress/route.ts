/**
 * 知径 Pathfinder — GET /api/v1/me/progress（M6）
 *
 * 当前用户学习进度聚合：主路径进度 + 练习会话/评价 + 费曼笔记统计，
 * 全部从 PostgreSQL pathfinder 实时统计（DB 为唯一 source of truth）。
 * 仅统计当前用户数据，不做跨用户泄露。
 */
import { err, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getProgressForUser } from "@/lib/notes/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  try {
    const progress = await getProgressForUser(user.id);
    return ok({ progress });
  } catch (e) {
    console.error("[M6] me/progress", e);
    return err.internal();
  }
}
