"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell";
import { Badge, Card } from "@/components/ui";
import { useAppStore } from "@/lib/store";
import type { SearchHitDto } from "@/lib/api/search";
import { searchUserData } from "@/lib/api/search";

const TYPE_LABEL: Record<SearchHitDto["type"], string> = {
  path: "路径",
  node: "节点",
  note: "笔记",
  resource: "资料",
  review_card: "复习卡",
};

const TYPE_TONE: Record<SearchHitDto["type"], "info" | "neutral" | "success" | "warning"> = {
  path: "info",
  node: "info",
  note: "success",
  resource: "neutral",
  review_card: "warning",
};

/** 语义搜索（api 模式）：检索当前用户真实数据 */
export function SearchApiView() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchHitDto[] | null>(null);
  const [searched, setSearched] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const hits = await searchUserData(q);
      setResults(hits);
      setSearched(q);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "搜索失败，请重试", "error");
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <PageHeader
        title="语义搜索"
        description="检索你自己的学习路径、节点、笔记、资料与复习卡片。只搜索你本人有权访问的内容。"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：pandas 数据处理 或 白平衡"
          aria-label="搜索内容"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="shrink-0 rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {searching ? "搜索中…" : "搜索"}
        </button>
      </form>

      {results && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink-3">
            找到 {results.length} 条关于「{searched}」的结果
          </p>
          {results.length === 0 ? (
            <Card className="px-5 py-8 text-center text-sm text-ink-3">
              没有找到匹配内容。换个关键词，或先完成节点学习、写几篇笔记再试。
            </Card>
          ) : (
            <ul className="space-y-2">
              {results.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <ResultRow hit={hit} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function ResultRow({ hit }: { hit: SearchHitDto }) {
  const inner = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={TYPE_TONE[hit.type]}>{TYPE_LABEL[hit.type]}</Badge>
      <span className="text-sm font-medium text-ink">{hit.title}</span>
      <span className="text-xs text-ink-3">{hit.source}</span>
      <span className="text-xs text-ink-3">· {hit.accessReason}</span>
    </div>
  );
  const body = (
    <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">{hit.snippet}</p>
  );
  const href = hit.url ?? (hit.type === "node" && hit.nodeId ? `/path/nodes/${hit.nodeId}` : hit.pathId ? `/path/${hit.pathId}` : null);

  return (
    <Card className="p-4 transition-colors hover:bg-subtle">
      {href ? (
        <a href={href} className="block" target={hit.url ? "_blank" : undefined} rel={hit.url ? "noreferrer" : undefined}>
          {inner}
          {body}
        </a>
      ) : (
        <>
          {inner}
          {body}
        </>
      )}
    </Card>
  );
}
