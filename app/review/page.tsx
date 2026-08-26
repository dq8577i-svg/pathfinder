"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { PageHeader } from "@/components/shell";
import { FeatureGate } from "@/components/guards";
import { Badge, ButtonLink, Card, ProgressBar, Skeleton } from "@/components/ui";
import { DemoTag } from "@/components/states";
import { isApiMode } from "@/lib/data-source";
import { REVIEW_DUE_CARDS } from "@/lib/demo";
import { ReviewApiView } from "./api-view";
import type { MemoryCard, ReviewRating } from "@/lib/types";
import { mockFetch, throwByState } from "@/lib/utils";

const RATING_META: Record<ReviewRating, { label: string; hint: string }> = {
  again: { label: "重来", hint: "想不起来" },
  hard: { label: "困难", hint: "有印象但不稳" },
  good: { label: "良好", hint: "能解释" },
  easy: { label: "轻松", hint: "非常熟悉" },
};

const RATING_ORDER: ReviewRating[] = ["again", "hard", "good", "easy"];

/** 按自评结果计算下次间隔（天）：简易 SM-2 风格，仅用于演示 */
function nextInterval(card: MemoryCard, rating: ReviewRating): number {
  switch (rating) {
    case "again":
      return 1;
    case "hard":
      return Math.max(1, Math.round(card.intervalDays * 1.2));
    case "good":
      return Math.max(1, Math.round(card.intervalDays * card.easeFactor));
    case "easy":
      return Math.max(1, Math.round(card.intervalDays * card.easeFactor * 1.3));
  }
}

function nextEase(card: MemoryCard, rating: ReviewRating): number {
  switch (rating) {
    case "again":
      return Math.max(1.3, +(card.easeFactor - 0.2).toFixed(2));
    case "hard":
      return Math.max(1.3, +(card.easeFactor - 0.15).toFixed(2));
    case "good":
      return card.easeFactor;
    case "easy":
      return Math.min(3.0, +(card.easeFactor + 0.15).toFixed(2));
  }
}

export default function ReviewPage() {
  if (isApiMode) return <ReviewApiView />;
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);

  const total = REVIEW_DUE_CARDS.length;
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<MemoryCard[]>(REVIEW_DUE_CARDS);
  const [answered, setAnswered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastNodeId, setLastNodeId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const card = queue[0];

  async function handleRate(rating: ReviewRating) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      throwByState(demoState);
      const next = await mockFetch(
        { intervalDays: nextInterval(card, rating), easeFactor: nextEase(card, rating) },
        { latency: [300, 600] },
      );
      setQueue((q) => q.slice(1));
      setAnswered((a) => a + 1);
      setFlipped(false);
      setLastNodeId(card.nodeId);
      pushToast(`已记录「${RATING_META[rating].label}」· 下次约 ${next.intervalDays} 天后复习`, "success");
    } catch {
      pushToast("保存失败：未同步，请重试", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FeatureGate flag="review_center">
      <PageHeader
        title="复习中心"
        description="基于间隔复习安排今日回顾；自评会更新下次复习时间并计入技能证据，但不作为能力认证。"
        meta={
          <>
            <Badge tone="info">今日待复习 {loading ? total : queue.length} 张</Badge>
            <DemoTag />
          </>
        }
      />

      {loading ? (
        <ReviewSkeleton />
      ) : total === 0 ? (
        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-base font-medium text-ink">今天没有到期的复习卡片</p>
          <p className="max-w-sm text-sm text-ink-2">完成节点学习或费曼练习后，会产生新的复习卡片。</p>
          <ButtonLink href="/labs" variant="secondary" className="mt-2">
            去情境练习巩固
          </ButtonLink>
        </Card>
      ) : queue.length === 0 ? (
        <CompleteState lastNodeId={lastNodeId} />
      ) : (
        <ReviewSession
          card={card}
          total={total}
          answered={answered}
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          submitting={submitting}
          onRate={handleRate}
        />
      )}
    </FeatureGate>
  );
}

function ReviewSession({
  card,
  total,
  answered,
  flipped,
  onFlip,
  submitting,
  onRate,
}: {
  card: MemoryCard;
  total: number;
  answered: number;
  flipped: boolean;
  onFlip: () => void;
  submitting: boolean;
  onRate: (r: ReviewRating) => void;
}) {
  const cardNo = answered + 1;
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-ink-2">
            第 {cardNo} / {total} 张
          </div>
          <Badge tone={card.sourceKind === "practice_gap" ? "warning" : card.sourceKind === "user_added" ? "neutral" : "info"}>
            {card.sourceKind === "practice_gap" ? "练习待补" : card.sourceKind === "user_added" ? "个人添加" : "节点要点"}
          </Badge>
        </div>

        <ProgressBar value={answered} max={total} label={`已完成 ${answered}/${total}`} className="mt-3" />

        <button
          type="button"
          onClick={onFlip}
          aria-pressed={flipped}
          className="mt-4 block min-h-[200px] w-full rounded-md border border-line bg-subtle px-5 py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
        >
          <div className="text-xs text-ink-3">{flipped ? "答案 · 点击返回问题" : "问题 · 点击查看答案"}</div>
          <p className="mt-3 text-lg font-medium leading-relaxed text-ink">{flipped ? card.backSummary : card.front}</p>
        </button>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">来源：{card.sourceTitle}</p>

        {flipped ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">这次回忆得如何？自评会调整下次复习时间。</p>
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
            {submitting ? <p className="mt-2 text-xs text-ink-3">正在同步自评…</p> : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-3">点击卡片查看答案后，可进行自评。</p>
        )}
      </Card>
    </div>
  );
}

function CompleteState({ lastNodeId }: { lastNodeId: string | null }) {
  return (
    <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-3xl text-ink-3" aria-hidden="true">
        ✓
      </div>
      <p className="text-base font-medium text-ink">今日复习完成</p>
      <p className="max-w-sm text-sm text-ink-2">
        本次共完成 {REVIEW_DUE_CARDS.length} 张卡片的自评。结果已计入技能证据，不会作为能力评级。
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {lastNodeId ? (
          <ButtonLink href={`/path/nodes/${lastNodeId}`}>回到薄弱节点</ButtonLink>
        ) : null}
        <ButtonLink href="/labs" variant="secondary">
          去情境练习巩固
        </ButtonLink>
        <ButtonLink href="/skills" variant="ghost">
          查看技能雷达
        </ButtonLink>
      </div>
    </Card>
  );
}

function ReviewSkeleton() {
  return (
    <Card className="mx-auto max-w-2xl p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-2 w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </Card>
  );
}
