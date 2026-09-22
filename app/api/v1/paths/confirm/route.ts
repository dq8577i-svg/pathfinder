/**
 * 知径 Pathfinder — POST /api/v1/paths/confirm
 *
 * 产品经理主题可复用经审核的 19 节点教材骨架；其他主题使用 AI/Mock 编排。
 * 单事务创建用户自己的真实 learning_paths +
 * learning_path_nodes + 生成节点/curriculum（含 path_snapshots v1 /
 * onboarding_answers / recommendation_runs / users 同步）。
 * 绑定当前登录用户；不允许通过 request body 指定 user_id。
 * 第一条路径自动成为主路径，后续路径作为并行路径创建；部分唯一索引负责并发兜底。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { confirmPath } from "@/lib/path/service";
import { learningGoalSchema } from "@/lib/plan/goal";
import { consumePathPreview } from "@/lib/path/preview-cache";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  const body = await req.json().catch(() => null);
  const goalInput = body && typeof body === "object" && "goal" in body ? body.goal : body;
  const previewId =
    body && typeof body === "object" && "previewId" in body && typeof body.previewId === "string"
      ? body.previewId
      : null;
  const parsed = learningGoalSchema.safeParse(goalInput);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const preview = previewId ? await consumePathPreview(user.id, previewId).catch(() => null) : null;
    const result = await confirmPath(user.id, parsed.data, preview);
    if (result.kind === "conflict") {
      return fail(
        "PRIMARY_PATH_EXISTS",
        "你已有一条进行中的主学习路径，请先完成或调整它",
        { status: 409 },
      );
    }
    return ok({ path: result.path });
  } catch (e) {
    console.error("[M3] paths/confirm", e);
    return err.internal();
  }
}
