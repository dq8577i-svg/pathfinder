"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui";
import { AiNote, DemoTag, EmptyState, LoadingState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { isApiMode } from "@/lib/data-source";
import { SEARCH_RESULTS } from "@/lib/demo";
import { SearchApiView } from "./api-view";
import type { SearchResult } from "@/lib/types";

const TYPE_LABEL: Record<string, { text: string; tone: "info" | "neutral" | "success" | "warning" }> = {
  node: { text: "节点", tone: "info" },
  note: { text: "笔记", tone: "neutral" },
  resource: { text: "资料", tone: "success" },
  crew_work: { text: "小队作品", tone: "warning" },
};

const NODE_TARGET = "/path/nodes/need-signal";
const NOTE_TARGET = "/notes?focus=note-01";
const CREW_WORK_TARGET = "/reviews/review-need-01";
const RESOURCE_URL = "https://www.nngroup.com/articles/asking-users-questions/";

function resultHref(r: SearchResult): string {
  switch (r.type) {
    case "node":
      return NODE_TARGET;
    case "note":
      return NOTE_TARGET;
    case "crew_work":
      return CREW_WORK_TARGET;
    case "resource":
      return RESOURCE_URL;
  }
}

export default function SearchPage() {
  if (isApiMode) return <SearchApiView />;
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="semantic_search"
      title="语义搜索暂未开放"
      description="在你有权访问的数据中检索节点、资料、笔记与已授权小队作品。"
    >
      <PageHeader
        title="语义搜索"
        description="检索你的路径、笔记、公开资料与已授权协作内容；每项结果都说明从哪里来、为什么匹配、你为何有权限。"
        meta={
          <>
            <DemoTag />
            <AiNote>语义排序由 AI 生成（演示），排序不等于权威性。</AiNote>
          </>
        }
      />
      <StateBanner state={demoState} />
      <SearchBody />
    </FeatureGate>
  );
}

function SearchBody() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  function runSearch(q: string) {
    setSearching(true);
    setSubmitted(q.trim());
    window.setTimeout(() => setSearching(false), 500);
  }

  const results = SEARCH_RESULTS.filter(
    (r) => !submitted || r.title.includes(submitted) || r.snippet.includes(submitted),
  );

  if (initialLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="加载搜索结果中">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 1) runSearch(query);
        }}
      >
        <label className="sr-only" htmlFor="search-input">
          搜索关键词
        </label>
        <Input
          id="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：如何区分用户痛点与解决方案假设"
          className="sm:max-w-md"
        />
        <div className="flex shrink-0 gap-2">
          <Button type="submit" loading={searching}>
            搜索
          </Button>
          {submitted ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setSubmitted("");
              }}
            >
              清除
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm text-ink-3">
        搜索前先做权限过滤，再语义召回与重排；不读取未分享笔记。{submitted ? `“${submitted}” 的结果：` : "默认显示全部结果："}
      </p>

      {searching ? (
        <LoadingState label="正在检索与排序…" />
      ) : results.length === 0 ? (
        <EmptyState
          icon="◎"
          title="没有匹配结果"
          description="尝试改写关键词，或扩大检索范围（节点、笔记、资料、小队作品）。"
        />
      ) : (
        <ul className="space-y-3">
          {results.map((r) => {
            const t = TYPE_LABEL[r.type] ?? TYPE_LABEL.node;
            const href = resultHref(r);
            const inner = (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={t.tone}>{t.text}</Badge>
                  {r.tier ? <Badge tone="neutral">资料等级 {r.tier}</Badge> : null}
                  <Badge tone="success">{r.scoreLabel}</Badge>
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink">{r.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{r.snippet}</p>

                <div className="mt-2">
                  <p className="text-xs font-medium text-ink-3">为什么匹配</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                    {r.matchReasons.map((m) => (
                      <li key={m} className="flex items-start gap-1.5">
                        <span aria-hidden="true">·</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                  <span>来源：{r.source}</span>
                  <span>访问原因：{r.accessReason}</span>
                </div>
              </>
            );
            const cls =
              "block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2";
            return (
              <li key={r.id}>
                {r.type === "resource" ? (
                  <a href={href} target="_blank" rel="noreferrer" className={cls}>
                    {inner}
                    <span className="mt-1 inline-block text-xs text-ink-3">站外资料 · 在新窗口打开 →</span>
                  </a>
                ) : (
                  <Link href={href} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Card className="p-3">
        <p className="text-xs text-ink-3">
          <AiNote>搜索不读取未分享笔记；公开资料仅索引授权元数据与摘要，不缓存受版权保护全文。</AiNote>
        </p>
      </Card>
    </div>
  );
}
