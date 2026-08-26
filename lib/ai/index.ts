/**
 * AI Provider 选择器（服务端使用）。
 * 规则：DEEPSEEK_ENABLED=true 且服务端存在端点与令牌 → 真实 DeepSeek；
 * 否则回退到 MockProvider。演示默认即可运行，无需任何密钥。
 */
import { DeepSeekProvider } from "./deepseek";
import { MockProvider } from "./mock";
import type { AiChatRequest, AiChatResult, AiProvider } from "./types";

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const enabled = process.env.DEEPSEEK_ENABLED === "true";
  const baseUrl = process.env.DEEPSEEK_BASE_URL;
  const authToken = process.env.DEEPSEEK_API_KEY;
  // demo 模式（DATA_SOURCE ≠ api）必须是纯本地演示：不调真实 AI、不产生任何外发请求与费用。
  // 真实引擎只在 api 模式下启用，与前端「演示数据 / 真实数据」边界保持一致。
  const isApiMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";

  if (isApiMode && enabled && baseUrl && authToken) {
    cached = new DeepSeekProvider({
      baseUrl,
      authToken,
      model: process.env.DEEPSEEK_MODEL,
    });
    return cached;
  }

  cached = new MockProvider();
  return cached;
}

/** 仅返回可公开的状态信息（不含密钥），供前端展示 AI 引擎来源。 */
export function getAiStatus(): { provider: "demo" | "deepseek"; model?: string; isDemo: boolean } {
  const provider = getAiProvider();
  return {
    provider: provider.kind,
    model: provider.kind === "deepseek" ? process.env.DEEPSEEK_MODEL || "deepseek-chat" : "mock",
    isDemo: provider.kind === "demo",
  };
}

export async function aiChat(req: AiChatRequest): Promise<AiChatResult> {
  return getAiProvider().chat(req);
}
