/**
 * 知径 Pathfinder — POST /api/v1/labs/:id/reply（P1/P2 情境练习场）
 *
 * 单轮 AI 角色扮演回复（不持久化会话），让场景最小可玩。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { replyInScenario } from "@/lib/labs/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const schema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(
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
    const result = await replyInScenario(user.id, id, parsed.data.message);
    return ok(result);
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("SCENARIO_NOT_FOUND", "练习场景不存在", { status: 404 });
    }
    console.error("[P2] labs/:id/reply", e);
    return err.internal();
  }
}
