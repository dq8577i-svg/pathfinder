/**
 * 知径 Pathfinder — GET /api/v1/search?q=（P1/P2 语义搜索）
 *
 * 仅检索当前用户有权访问的数据（owner 过滤 + ILIKE）。
 */
import { err, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { searchUserData } from "@/lib/discover/service";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const results = await searchUserData(user.id, q);
    return ok({ results, query: q });
  } catch (e) {
    console.error("[P2] search", e);
    return err.internal();
  }
}
