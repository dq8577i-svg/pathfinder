/**
 * SearchProvider 接口（PRD §4.2）。
 * 业务模块只能调用内部接口，不能直接调用供应商 SDK。
 * - search: 公开资源发现 → 规范化结果（标题/链接/摘要/分级）
 * - check: 单条 URL 可访问性核验（用于 A/B 级依据的复核）
 */
import type { ResourceCheck, SearchOptions, SearchResult } from "./types";

export interface SearchProvider {
  readonly name: string;
  /** 真实搜索（消耗供应商配额）还是 Mock 占位 */
  readonly isReal: boolean;

  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;

  check(url: string): Promise<ResourceCheck>;
}
