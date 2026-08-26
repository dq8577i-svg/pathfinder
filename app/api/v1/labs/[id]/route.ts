/**
 * 知径 Pathfinder — GET /api/v1/labs/:id（P1/P2 情境练习场详情）
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getScenario } from "@/lib/labs/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { id } = await params;
  try {
    const scenario = await getScenario(user.id, id);
    return ok({ scenario });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("SCENARIO_NOT_FOUND", "练习场景不存在", { status: 404 });
    }
    console.error("[P2] labs/:id", e);
    return err.internal();
  }
}
