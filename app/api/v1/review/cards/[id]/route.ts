/**
 * 知径 Pathfinder — PATCH /api/v1/review/cards/:id（P1/P2 复习中心）
 *
 * 更新卡片复习状态（new/reviewing/mastered）；仅本人卡片可改。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { REVIEW_CARD_STATUSES, updateReviewCardStatus } from "@/lib/review/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const schema = z.object({
  status: z.enum(REVIEW_CARD_STATUSES),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const card = await updateReviewCardStatus(user.id, id, parsed.data.status);
    return ok({ card });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("CARD_NOT_FOUND", "复习卡片不存在", { status: 404 });
    }
    console.error("[P2] review/cards/:id PATCH", e);
    return err.internal();
  }
}
