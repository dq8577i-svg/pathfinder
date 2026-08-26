/**
 * 知径 Pathfinder — GET/PATCH /api/v1/practice/sessions/:sessionId（M4）
 *
 * GET：会话详情（消息 + 评价），归属校验（本人 → 404 不泄露存在性）。
 * PATCH：草稿 / 同步状态 / 放弃会话；仅允许当前用户操作自己的会话。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getPracticeSession, patchPracticeSession, PracticeError } from "@/lib/practice/service";
import { patchSessionSchema } from "@/lib/practice/input";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { sessionId } = await params;
  try {
    const detail = await getPracticeSession(user.id, sessionId);
    if (!detail) return fail("SESSION_NOT_FOUND", "练习会话不存在", { status: 404 });
    return ok({ session: detail.session, feedback: detail.feedback });
  } catch (e) {
    console.error("[M4] practice/sessions/:id GET", e);
    return err.internal();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { sessionId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSessionSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const detail = await patchPracticeSession(user.id, sessionId, parsed.data);
    if (!detail) return fail("SESSION_NOT_FOUND", "练习会话不存在", { status: 404 });
    return ok({ session: detail.session });
  } catch (e) {
    if (e instanceof PracticeError) {
      return fail(e.code, "无法更新练习会话", { status: e.status });
    }
    console.error("[M4] practice/sessions/:id PATCH", e);
    return err.internal();
  }
}
