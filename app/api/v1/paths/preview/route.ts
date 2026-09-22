/**
 * 知径 Pathfinder — POST /api/v1/paths/preview
 *
 * 产品经理主题可复用经审核的 19 节点教材骨架；其他主题使用 AI/Mock 编排。
 * 无状态生成待确认的学习路径预览。
 * 不创建任何 learning_paths，不写库。编排交给 generatePlan
 * （DEEPSEEK_ENABLED=true 时为 DeepSeek，否则 / 失败时为 Mock）。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { computePreview } from "@/lib/path/service";
import { learningGoalSchema } from "@/lib/plan/goal";
import { consumeRateLimit, positiveEnvInt } from "@/lib/infra/rate-limit";
import { savePathPreview } from "@/lib/path/preview-cache";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  const rate = await consumeRateLimit({
    namespace: "path-preview",
    subject: user.id,
    limit: positiveEnvInt("RATE_LIMIT_PATH_PREVIEW_MAX", 10, 500),
    windowSeconds: positiveEnvInt("RATE_LIMIT_PATH_PREVIEW_WINDOW_SECONDS", 60, 3_600),
  });
  if (!rate.allowed) {
    return fail(
      rate.reason === "backend_unavailable" ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
      rate.reason === "backend_unavailable" ? "限流服务暂不可用" : "路径生成请求过于频繁，请稍后重试",
      { status: rate.reason === "backend_unavailable" ? 503 : 429, retryable: true },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = learningGoalSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const preview = await computePreview(parsed.data);
    try {
      await savePathPreview(user.id, preview);
    } catch {
      // Redis 快照失败不阻断预览；确认时会回退为服务端重新编排。
    }
    return ok({ preview });
  } catch (e) {
    console.error("[M3] paths/preview", e);
    return err.internal();
  }
}
