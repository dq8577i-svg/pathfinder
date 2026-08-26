/**
 * 知径 Pathfinder — POST /api/v1/paths/preview（通用学习规划阶段）
 *
 * 接收用户学习目标（任意主题），无状态生成待确认的学习路径预览。
 * 不创建任何 learning_paths，不写库。编排交给 generatePlan
 * （DEEPSEEK_ENABLED=true 时为 DeepSeek，否则 / 失败时为 Mock）。
 */
import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { computePreview } from "@/lib/path/service";
import { learningGoalSchema } from "@/lib/plan/goal";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = learningGoalSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const preview = await computePreview(parsed.data);
    return ok({ preview });
  } catch (e) {
    console.error("[M3] paths/preview", e);
    return err.internal();
  }
}
