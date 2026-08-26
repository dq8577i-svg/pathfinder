/**
 * SearchProvider 抽象层类型契约（PRD §4.2）。
 * 只做公开资源发现：返回标题 / 链接 / 必要摘要，不批量抓取、不存储或再发布
 * 未授权全文 / 音视频 / 付费课程。供应商 Key 只存在于服务端环境变量，绝不下发到客户端。
 */
import type { AccessibilityStatus, Grade, ResourceType } from "@/lib/types";

/** 规范化后的单条搜索结果（未落库；落库时映射为 resources 行） */
export interface SearchResult {
  title: string;
  url: string;
  /** 归属域名（hostname，去 www） */
  domain: string;
  /** 摘要（不超过 ~300 字） */
  snippet: string;
  publishedAt?: string;
  /** 检索时间 ISO */
  retrievedAt: string;
  /** 供应商名：tavily / mock */
  provider: string;
  /** 供应商相关度分（0–1；供分级/排序参考） */
  score?: number;
  /** 初始可信度分级：A=官方/权威，B=优质教程/主流平台，C=默认/博客/论坛 */
  sourceTier: Grade;
  /** 去重键：URL 归一化（去 query/hash） */
  dedupeKey: string;
  /** 供应商只返回元数据，未做可访问性核验 */
  reviewStatus: "pending";
  /** 映射到现有 ResourceType（video/official_docs/course/article/tool…） */
  sourceType: ResourceType;
  /** 推荐理由（含相关度分） */
  reason: string;
}

export interface ResourceCheck {
  url: string;
  accessible: boolean;
  status: number;
  accessibilityStatus: AccessibilityStatus;
  checkedAt: string;
}

export interface SearchOptions {
  maxResults?: number;
}
