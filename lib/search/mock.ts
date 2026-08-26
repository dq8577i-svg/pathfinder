/**
 * Mock SearchProvider —— 仅当服务端未配置 TAVILY_API_KEY 时的诚实占位（非最终方案）。
 * 不返回伪造资源（PRD §4.2：不得伪造权威性；重点节点无 A/B 来源时显示「待补充」）。
 */
import type { ResourceCheck, SearchResult } from "./types";
import type { SearchProvider } from "./provider";

export class MockProvider implements SearchProvider {
  readonly name = "mock";
  readonly isReal = false;

  async search(): Promise<SearchResult[]> {
    return [];
  }

  async check(url: string): Promise<ResourceCheck> {
    return {
      url,
      accessible: true,
      status: 0,
      accessibilityStatus: "pending",
      checkedAt: new Date().toISOString(),
    };
  }
}
