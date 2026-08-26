/**
 * 知径 Pathfinder — POST /api/v1/practice/sessions/:sessionId/evaluate（M4）
 *
 * 依据会话对话生成练习评价并将会话置为 completed。幂等：已生成过评价直接返回。
 * 会话必须属于当前用户；无用户讲解时 409。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { evaluatePracticeSession, PracticeError } from "@/lib/practice/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { sessionId } = await params;

  try {
    const result = await evaluatePracticeSession(user.id, sessionId);
    return ok({ feedback: result.feedback, idempotent: result.idempotent });
  } catch (e) {
    if (e instanceof PracticeError) {
      return fail(
        e.code,
        e.code === "SESSION_NOT_FOUND" ? "练习会话不存在" : "还没有可评价的讲解内容",
        { status: e.status },
      );
    }
    console.error("[M4] practice/sessions/:id/evaluate POST", e);
    return err.internal();
  }
}
