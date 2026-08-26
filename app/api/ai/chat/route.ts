/**
 * AI 对话服务端 Route Handler。
 * 密钥仅在此服务端进程读取环境变量；客户端请求不携带、不感知密钥。
 * 演示态 state=ai_error 由前端短路处理，不会走到真实请求。
 */
import { NextRequest, NextResponse } from "next/server";
import { aiChat } from "@/lib/ai";
import type { AiChatRequest } from "@/lib/ai/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: AiChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  try {
    // 模拟真实模型思考延迟，让前端「AI 思考中」状态可被演示
    const delay = 400 + Math.random() * 700;
    await new Promise((r) => setTimeout(r, delay));
    const result = await aiChat(body);
    return NextResponse.json({ data: result });
  } catch (err) {
    // 仅记录脱敏错误信息，绝不打印密钥/连接串
    const msg = err instanceof Error ? err.message.slice(0, 160) : "unknown";
    console.error("[ai] chat failed (safe):", msg);
    return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
  }
}
