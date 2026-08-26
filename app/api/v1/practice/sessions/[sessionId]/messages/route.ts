/**
 * 知径 Pathfinder — POST /api/v1/practice/sessions/:sessionId/messages（M4）
 *
 * 提交一条用户讲解，返回 AI 追问。幂等：携带相同 clientId 重复提交返回既有
 * 消息对（不产生重复消息、不重复调用 AI）。会话必须属于当前用户。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { addPracticeMessage, PracticeError } from "@/lib/practice/service";
import { addMessageSchema } from "@/lib/practice/input";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { sessionId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = addMessageSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const result = await addPracticeMessage(user.id, sessionId, parsed.data);
    return ok({
      session: result.session,
      userMessage: result.userMessage,
      aiMessage: result.aiMessage,
      idempotent: result.idempotent,
    });
  } catch (e) {
    if (e instanceof PracticeError) {
      const status = e.status;
      return fail(
        e.code,
        status === 404 ? "练习会话不存在" : status === 409 ? "本轮练习已结束" : "无法发送消息",
        { status },
      );
    }
    console.error("[M4] practice/sessions/:id/messages POST", e);
    return err.internal();
  }
}
