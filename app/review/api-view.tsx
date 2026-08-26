"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, ProgressBar, Skeleton } from "@/components/ui";
import { AiNote } from "@/components/states";
import { PathSwitcher } from "@/components/path-switcher";
import { useAppStore } from "@/lib/store";
import { useAsync, useCurrentPathId } from "@/lib/api/hooks";
import type { ReviewCardDto } from "@/lib/api/review";
import {
  generateReviewCards,
  listReviewCards,
  updateReviewCardStatus,
} from "@/lib/api/review";

const RATING_META = {
  again: { label: "重来", hint: "想不起来" },
  hard: { label: "困难", hint: "有印象但不稳" },
  good: { label: "良好", hint: "能解释" },
  easy: { label: "轻松", hint: "非常熟悉" },
} as const;

const RATING_ORDER = ["again", "hard", "good", "easy"] as const;
type Rating = (typeof RATING_ORDER)[number];

const SOURCE_LABEL: Record<ReviewCardDto["source"], string> = {
  ai: "AI 生成",
  evaluation: "练习评价",
  template: "模板",
};

/** 复习中心（api 模式）：当前路径真实复习卡片 + 间隔复习自评 */
export function ReviewApiView() {
  const { pathId, paths, reload: reloadPath } = useCurrentPathId();
  const pushToast = useAppStore((s) => s.pushToast);

  const { data: cards, loading, reload } = useAsync<ReviewCardDto[]>(
    async () => (pathId ? listReviewCards(pathId) : []),
    [pathId],
    { enabled: !!pathId },
  );

  const [queue, setQueue] = useState<ReviewCardDto[]>([]);
  const [answered, setAnswered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 卡片变化 → 重建待复习队列（未 mastered）
  useEffect(() => {
    setQueue((cards ?? []).filter((c) => c.status !== "mastered"));
  }, [cards]);

  const card = queue[0];
  const dueCount = queue.length;

  async function handleGenerate() {
    if (!pathId || generating) return;
    setGenerating(true);
    try {
      const r = await generateReviewCards(pathId);
      pushToast(
        r.created > 0
          ? `已生成 ${r.created} 张复习卡片（${r.provider === "deepseek" ? "AI 生成" : "模板生成"}）`
          : "当前路径节点都已生成过卡片",
        r.created > 0 ? "success" : "info",
      );
      await reload();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "卡片生成失败，请稍后重试", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRate(rating: Rating) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      const target = rating === "easy" ? "mastered" : rating === "again" ? "new" : "reviewing";
      await updateReviewCardStatus(card.id, target);
      setQueue((q) => q.slice(1));
      setAnswered((a) => a + 1);
      setFlipped(false);
      pushToast(`已记录「${RATING_META[rating].label}」`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败，请重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto max-w-2xl p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-2 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="复习中心"
        description="围绕你的学习路径节点生成复习卡片；自评会流转卡片状态（新卡片 → 已掌握）。"
        meta={
          <>
            <Badge tone="info">待复习 {dueCount} 张</Badge>
            <AiNote>卡片由 AI 或模板基于你的真实节点生成。</AiNote>
          </>
        }
      />

      <PathSwitcher
        pathId={pathId}
        paths={paths}
        onChange={(id) => {
          try {
            window.localStorage.setItem("pf-active-path", id);
          } catch {
            /* ignore */
          }
          reloadPath();
        }}
      />

      {dueCount === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-base font-medium text-ink">今天没有待复习的卡片</p>
          <p className="max-w-sm text-sm text-ink-2">
            为当前路径节点生成复习卡片，或先完成节点学习与费曼练习。
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button onClick={handleGenerate} loading={generating}>
              生成复习卡片
            </Button>
            <ButtonLink href="/labs" variant="secondary">
              去情境练习巩固
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ReviewSession
          card={card}
          dueCount={dueCount}
          answered={answered}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          submitting={submitting}
          onRate={handleRate}
          onGenerateMore={handleGenerate}
          generating={generating}
        />
      )}
    </>
  );
}

function ReviewSession({
  card,
  dueCount,
  answered,
  flipped,
  onFlip,
  submitting,
  onRate,
  onGenerateMore,
  generating,
}: {
  card: ReviewCardDto;
  dueCount: number;
  answered: number;
  flipped: boolean;
  onFlip: () => void;
  submitting: boolean;
  onRate: (r: Rating) => void;
  onGenerateMore: () => void;
  generating: boolean;
}) {
  const cardNo = answered + 1;
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-ink-2">
            第 {cardNo} / {dueCount} 张
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{SOURCE_LABEL[card.source]}</Badge>
            <Button size="sm" variant="ghost" onClick={onGenerateMore} loading={generating}>
              再生成几张
            </Button>
          </div>
        </div>

        <ProgressBar value={answered} max={dueCount} label={`已完成 ${answered}/${dueCount}`} className="mt-3" />

        <button
          type="button"
          onClick={onFlip}
          aria-pressed={flipped}
          className="mt-4 block min-h-[200px] w-full rounded-md border border-line bg-subtle px-5 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
        >
          <div className="text-xs text-ink-3">{flipped ? "答案 · 点击返回问题" : "问题 · 点击查看答案"}</div>
          <p className="mt-3 text-lg font-medium leading-relaxed text-ink">{flipped ? card.answer : card.question}</p>
        </button>

        <p className="mt-2 text-xs text-ink-3">来源节点：{card.nodeTitle || "未关联节点"}</p>

        {flipped ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">这次回忆得如何？自评会流转卡片状态。</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATING_ORDER.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRate(r)}
                  disabled={submitting}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md border border-line bg-surface px-2 py-2 text-sm text-ink transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
                >
                  <span>{RATING_META[r].label}</span>
                  <span className="text-xs font-normal text-ink-3">{RATING_META[r].hint}</span>
                </button>
              ))}
            </div>
            {submitting ? <p className="mt-2 text-xs text-ink-3">正在保存自评…</p> : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">点击卡片查看答案后，可进行自评。</p>
        )}
      </Card>
    </div>
  );
}
