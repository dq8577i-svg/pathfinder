/**
 * Tavily Search 适配器（真实 Web Search）。
 * 密钥只来自构造函数（服务端 env TAVILY_API_KEY），绝不落入客户端。
 * 分类/分级启发式只做「公开来源的初步判断」，reviewStatus 恒为 pending，
 * 待 check() 或人工复核后再定 accessibility/权威性。
 */
import type { Grade, ResourceType } from "@/lib/types";
import type { ResourceCheck, SearchOptions, SearchResult } from "./types";
import type { SearchProvider } from "./provider";

const API_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string | null;
}

interface TavilyResponse {
  query: string;
  answer?: string | null;
  response_time?: number;
  results?: TavilyResult[];
}

/** 权威域 → A 级（官方文档 / 权威机构） */
const OFFICIAL_DOMAINS = new Set([
  "python.org",
  "docs.python.org",
  "developer.mozilla.org",
  "w3.org",
  "readthedocs.io",
  "readthedocs.org",
  "learn.microsoft.com",
  "docs.docker.com",
  "kubernetes.io",
  "react.dev",
  "nextjs.org",
  "go.dev",
  "golang.org",
  "developers.google.com",
  "developer.apple.com",
  "khanacademy.org",
]);

/** 主流视频 / 教程 / 课程平台 → 至少 B 级 */
const TUTORIAL_DOMAINS = new Set([
  "youtube.com",
  "youtu.be",
  "bilibili.com",
  "b23.tv",
  "udemy.com",
  "coursera.org",
  "freecodecamp.org",
  "w3schools.com",
  "geeksforgeeks.org",
  "stackoverflow.com",
  "juejin.cn",
  "csdn.net",
  "zhihu.com",
  "segmentfault.com",
]);

const VIDEO_HOSTS = new Set(["youtube.com", "youtu.be", "bilibili.com", "b23.tv", "iqiyi.com", "v.qq.com"]);

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifyType(url: string): ResourceType {
  const h = hostnameOf(url);
  if (VIDEO_HOSTS.has(h) || h.endsWith(".bilibili.com")) return "video";
  if (h === "github.com" || h.endsWith(".github.io") || h.endsWith(".github.com")) return "tool";
  if (OFFICIAL_DOMAINS.has(h)) return "official_docs";
  if (h.includes("udemy") || h.includes("coursera") || h.includes("classcentral")) return "course";
  return "article";
}

function gradeFor(url: string, score: number): Grade {
  const h = hostnameOf(url);
  if (OFFICIAL_DOMAINS.has(h)) return "A";
  if (TUTORIAL_DOMAINS.has(h)) return "B";
  if (score >= 0.45) return "B";
  return "C";
}

function dedupeKeyOf(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return `${u.hostname.toLowerCase()}${u.pathname}`;
  } catch {
    return url;
  }
}

export class TavilyProvider implements SearchProvider {
  readonly name = "tavily";
  readonly isReal = true;

  constructor(private readonly apiKey: string) {}

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const maxResults = opts.maxResults ?? 8;
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // 401/402/429/5xx：抛出，由资源层决定降级（节点保持「待补充」而非伪造）
      throw new Error(`Tavily search failed: ${res.status}`);
    }
    const data = (await res.json()) as TavilyResponse;
    const now = new Date().toISOString();
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const r of data.results ?? []) {
      if (!r.url) continue;
      const dk = dedupeKeyOf(r.url);
      if (seen.has(dk)) continue;
      seen.add(dk);
      out.push({
        title: (r.title || r.url).slice(0, 200),
        url: r.url,
        domain: hostnameOf(r.url),
        snippet: (r.content || "").replace(/\s+/g, " ").trim().slice(0, 300),
        ...(r.published_date ? { publishedAt: r.published_date } : {}),
        retrievedAt: now,
        provider: "tavily",
        score: r.score,
        sourceTier: gradeFor(r.url, r.score),
        dedupeKey: dk,
        reviewStatus: "pending",
        sourceType: classifyType(r.url),
        reason: `Tavily 实时检索 · 相关度 ${(r.score ?? 0).toFixed(2)}`,
      });
    }
    return out;
  }

  async check(url: string): Promise<ResourceCheck> {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(8_000),
      });
      const accessible = res.status >= 200 && res.status < 400;
      return {
        url,
        accessible,
        status: res.status,
        accessibilityStatus: accessible ? "verified" : "unavailable",
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        url,
        accessible: false,
        status: 0,
        accessibilityStatus: "unavailable",
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
