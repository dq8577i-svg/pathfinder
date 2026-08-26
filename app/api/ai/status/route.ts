/**
 * AI 引擎状态（公开信息，不含任何密钥）。
 * 供原型控制台与页面展示当前 AI 来源：演示 Mock / DeepSeek。
 */
import { NextResponse } from "next/server";
import { getAiStatus } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ data: getAiStatus() });
}
