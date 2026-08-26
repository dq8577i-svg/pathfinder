/**
 * 知径 Pathfinder — POST /api/v1/review/cards/generate（P1/P2 复习中心）
 *
 * 为当前用户路径中尚无卡片的节点生成复习卡片（AI 或模板兜底；source 如实区分）。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { generateReviewCardsForPath } from "@/lib/review/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const schema = z.object({
  pathId: z.string().min(1),
  count: z.number().int().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const result = await generateReviewCardsForPath(user.id, parsed.data.pathId, parsed.data.count ?? 5);
    return ok(result);
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] review/cards/generate", e);
    return err.internal();
  }
}
