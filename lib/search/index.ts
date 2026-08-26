/**
 * SearchProvider 选择器（服务端使用，PRD §4.2）。
 * 规则：api 模式且服务端存在 TAVILY_API_KEY → 真实 Tavily；否则 Mock 占位（不伪造资料）。
 * Key 只存在于服务端环境变量，绝不下发到客户端。
 */
import { TavilyProvider } from "./tavily";
import { MockProvider } from "./mock";
import type { SearchProvider } from "./provider";

let cached: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  const key = process.env.TAVILY_API_KEY;
  const isApiMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
  if (isApiMode && key) {
    cached = new TavilyProvider(key);
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** 语义：searchProviderLabel 标注真实检索来源；未配置时诚实标注占位。 */
export function searchProviderLabel(): string {
  const p = getSearchProvider();
  return p.isReal ? "Tavily 实时检索" : "搜索未配置（Mock 占位）";
}
