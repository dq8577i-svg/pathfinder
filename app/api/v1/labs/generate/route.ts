/**
 * 知径 Pathfinder — POST /api/v1/labs/generate（P1/P2 情境练习场）
 *
 * 为当前用户路径的某个节点（默认首个无场景节点）生成练习场景。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { generateScenarioForPath } from "@/lib/labs/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const schema = z.object({
  pathId: z.string().min(1),
  nodeId: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const scenario = await generateScenarioForPath(user.id, parsed.data.pathId, parsed.data.nodeId);
    return ok({ scenario });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径或节点不存在", { status: 404 });
    }
    console.error("[P2] labs/generate", e);
    return err.internal();
  }
}
