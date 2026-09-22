/**
 * AI 对话服务端 Route Handler。
 * 密钥仅在此服务端进程读取环境变量；客户端请求不携带、不感知密钥。
 * 演示态 state=ai_error 由前端短路处理，不会走到真实请求。
 */
import { NextRequest } from "next/server";
import { aiChat } from "@/lib/ai";
import type { AiChatRequest } from "@/lib/ai/types";
import { consumeRateLimit, positiveEnvInt, requestSubject } from "@/lib/infra/rate-limit";
import { getCurrentUser } from "@/lib/auth/require-user";
import { fail, ok } from "@/lib/api/response";

export const runtime = "nodejs";

function validAiInput(body: AiChatRequest): boolean {
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 50) return false;
  if (body.system !== undefined && (typeof body.system !== "string" || body.system.length > 12_000)) return false;
  if (body.maxTokens !== undefined && (!Number.isInteger(body.maxTokens) || body.maxTokens < 1 || body.maxTokens > 4_096)) return false;
  if (body.temperature !== undefined && (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) return false;
  return body.messages.every(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.length > 0 &&
      message.content.length <= 12_000,
  );
}

export async function POST(req: NextRequest) {
  const isApiMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
  let subject = requestSubject(req);
  if (isApiMode) {
    try {
      const user = await getCurrentUser();
      if (!user) return fail("UNAUTHENTICATED", "未登录或会话已失效", { status: 401 });
      subject = user.id;
    } catch {
      return fail("AUTHENTICATION_UNAVAILABLE", "认证服务暂不可用", { status: 503, retryable: true });
    }
  }
  const rate = await consumeRateLimit({
    namespace: "ai-chat",
    subject,
    limit: positiveEnvInt("RATE_LIMIT_AI_MAX", 20, 1_000),
    windowSeconds: positiveEnvInt("RATE_LIMIT_AI_WINDOW_SECONDS", 60, 3_600),
  });
  if (!rate.allowed) {
    const unavailable = rate.reason === "backend_unavailable";
    return fail(
      unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
      unavailable ? "限流服务暂不可用" : "请求过于频繁，请稍后重试",
      { status: unavailable ? 503 : 429, retryable: true },
    );
  }
  let body: AiChatRequest;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_BODY", "请求体必须是合法 JSON", { status: 400 });
  }

  if (JSON.stringify(body).length > 64_000 || !validAiInput(body)) {
    return fail("INVALID_INPUT", "消息内容为空、过长或参数超出允许范围", { status: 422 });
  }

  try {
    // 模拟真实模型思考延迟，让前端「AI 思考中」状态可被演示
    const delay = 400 + Math.random() * 700;
    await new Promise((r) => setTimeout(r, delay));
    const result = await aiChat(body);
    return ok(result);
  } catch (err) {
    // 仅记录脱敏错误信息，绝不打印密钥/连接串
    const msg = err instanceof Error ? err.message.slice(0, 160) : "unknown";
    console.error("[ai] chat failed (safe):", msg);
    return fail("AI_UNAVAILABLE", "AI 服务暂不可用，请稍后重试", { status: 502, retryable: true });
  }
}
