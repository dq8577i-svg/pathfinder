/**
 * 知径 Pathfinder — GET /api/v1/review/cards?pathId=&status=（P1/P2 复习中心）
 *
 * 列出当前用户某路径的复习卡片；status 可选（默认全部）。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { listReviewCards, REVIEW_CARD_STATUSES } from "@/lib/review/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const sp = new URL(req.url).searchParams;
  const pathId = sp.get("pathId") ?? "";
  if (!pathId) return fail("INVALID_INPUT", "缺少 pathId 参数", { status: 422 });
  const statusRaw = sp.get("status");
  const status = statusRaw && (REVIEW_CARD_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as (typeof REVIEW_CARD_STATUSES)[number])
    : undefined;
  try {
    const cards = await listReviewCards(user.id, pathId, status);
    return ok({ cards });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] review/cards", e);
    return err.internal();
  }
}
