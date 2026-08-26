"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, ButtonLink, Card, ProgressBar, Skeleton } from "@/components/ui";
import { DemoTag } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { SPACE_SUMMARY } from "@/lib/demo";
import { formatMinutes, relativeTime } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { useAsync, resolveActivePathId } from "@/lib/api/hooks";
import { PathSwitcher } from "@/components/path-switcher";
import { listPaths, getPath } from "@/lib/api/paths";
import { listNotes } from "@/lib/api/notes";
import { getProgress } from "@/lib/api/progress";
import type { LearnerProgress } from "@/lib/api/progress";
import type { FeynmanNote, LearningPath, SpaceSummary } from "@/lib/types";

const TASK_TYPE_LABEL: Record<string, string> = { practice: "练习", node: "节点", review: "复习" };
const ASSET_TYPE_LABEL: Record<string, string> = { note: "笔记", scenario: "情境", challenge: "挑战" };
const LAB_TITLE: Record<string, string> = { "scenario-priority": "向研发解释优先级" };

export default function SpacePage() {
  const flags = useAppStore((s) => s.flags);
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="learning_space"
      title="学习空间暂未开放"
      description="学习空间用于汇总今日任务、计划健康度与协作待办。可通过演示控制台开启后重试。"
    >
      <PageHeader
        title="学习空间"
        description="今天做什么、为什么做、完成后去哪里——一个明确的恢复点，而不是所有功能的仪表盘。"
        meta={<DemoTag />}
      />
      <StateBanner state={demoState} />
      <SpaceContent />
    </FeatureGate>
  );
}

/** api 模式：把真实进度/路径/笔记汇总为学习空间视图（无今日复习与小队模块） */
function buildApiSummary(d: {
  paths: LearningPath[];
  notes: FeynmanNote[];
  progress: LearnerProgress;
  full: LearningPath;
}): SpaceSummary {
  const { full, notes, progress } = d;
  const current = progress.path;
  const recentAssets = notes.slice(0, 3).map((n) => ({
    type: "note" as const,
    title: n.title,
    updatedAt: n.updatedAt,
    href: n.sessionId ? `/practice/${n.sessionId}/result` : "/notes",
  }));
  return {
    activePath: full,
    todayTask: {
      type: "node",
      nodeId: current.currentNodeId ?? full.currentNodeId ?? undefined,
      title: "继续当前节点",
      reason: "回到你的学习路径，完成当前节点的能力目标并继续费曼练习。",
      estimatedMinutes: 25,
      resumeCursor: "",
    },
    planHealth: {
      onTrack: true,
      confidence: "high",
      reason: `已按计划完成 ${full.progress.completed}/${full.progress.total} 个节点，保持当前节奏即可。`,
      showAdjustment: false,
    },
    todayReviewCount: 0,
    recommendedLabId: null,
    recentAssets,
  };
}

function SpaceContent() {
  const { data, loading: apiLoading, reload } = useAsync<{
    paths: LearningPath[];
    notes: FeynmanNote[];
    progress: LearnerProgress;
    full: LearningPath | null;
  } | null>(async () => {
    if (!isApiMode) return null;
    const [paths, notes, progress] = await Promise.all([listPaths(), listNotes(), getProgress()]);
    const activeId = resolveActivePathId(paths);
    const primary = activeId ? (paths.find((p) => p.id === activeId) ?? null) : null;
    const full = primary ? await getPath(primary.id) : null;
    return { paths, notes, progress, full };
  }, []);

  // demo 模式：原假加载
  const [demoLoading, setDemoLoading] = useState(true);
  useEffect(() => {
    if (isApiMode) return;
    const t = setTimeout(() => setDemoLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  if (isApiMode ? apiLoading || !data : demoLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="加载学习空间中">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isApiMode && !data!.full) {
    return (
      <Card className="p-8 text-center">
        <p className="text-base font-medium text-ink">还没有学习路径</p>
        <p className="mt-1 text-sm text-ink-2">先完成目标诊断，学习空间会在这里汇总你的今日任务与进度。</p>
        <div className="mt-4">
          <ButtonLink href="/onboarding">去创建路径</ButtonLink>
        </div>
      </Card>
    );
  }

  const summary: SpaceSummary = isApiMode ? buildApiSummary(data as { paths: LearningPath[]; notes: FeynmanNote[]; progress: LearnerProgress; full: LearningPath }) : SPACE_SUMMARY;

  const { todayTask, planHealth, todayReviewCount, recommendedLabId, recentAssets, crewTask, activePath } =
    summary;

  const taskHref =
    todayTask.type === "practice" && todayTask.sessionId
      ? `/practice/${todayTask.sessionId}`
      : todayTask.type === "node" && todayTask.nodeId
        ? `/path/nodes/${todayTask.nodeId}`
        : "/review";

  const taskTone = todayTask.type === "review" ? "success" : todayTask.type === "node" ? "neutral" : "info";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* 主列 */}
      <div className="space-y-4 lg:col-span-2">
        {/* 今日任务 */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">今日任务</Badge>
            <Badge tone={taskTone}>{TASK_TYPE_LABEL[todayTask.type] ?? todayTask.type}</Badge>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-ink">{todayTask.title}</h2>
          <p className="mt-1 text-sm text-ink-2">{todayTask.reason}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            <span>预计 {formatMinutes(todayTask.estimatedMinutes)}</span>
            {todayTask.resumeCursor ? <span>上次进度：{todayTask.resumeCursor}</span> : null}
          </div>
          <div className="mt-4">
            <ButtonLink href={taskHref}>继续</ButtonLink>
          </div>
        </Card>

        {/* 计划健康度 */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={planHealth.onTrack ? "success" : "warning"}>
                {planHealth.onTrack ? "按计划推进" : "偏离计划"}
              </Badge>
              <span className="text-sm text-ink-2">置信度：{planHealth.confidence === "high" ? "高" : planHealth.confidence === "medium" ? "中" : "低"}</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-ink">{planHealth.reason}</p>
          {planHealth.showAdjustment ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5">
              <p className="text-sm text-warning">
                AI 已生成计划调整建议，影响列表见路径详情（含完成日期、每周投入变化）。
              </p>
              <ButtonLink href="/paths/path-pm#adjustment" variant="secondary" size="sm">
                查看调整建议
              </ButtonLink>
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-3">当前无待处理的计划调整建议。</p>
          )}
        </Card>

        {/* 最近资产 */}
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">最近资产</h2>
          <ul className="mt-2 divide-y divide-line">
            {recentAssets.map((a) => (
              <li key={a.title}>
                <Link
                  href={a.href}
                  className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge tone={a.type === "challenge" ? "warning" : a.type === "scenario" ? "info" : "neutral"}>
                      {ASSET_TYPE_LABEL[a.type] ?? a.type}
                    </Badge>
                    <span className="truncate text-ink">{a.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{relativeTime(a.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* 侧栏 */}
      <div className="space-y-4">
        {/* 当前路径 */}
        <Card className="p-4 sm:p-5">
          {isApiMode ? (
            <PathSwitcher
              pathId={data?.full?.id ?? null}
              paths={data?.paths ?? []}
              label="学习路径"
              onChange={(id) => {
                try {
                  window.localStorage.setItem("pf-active-path", id);
                } catch {
                  /* ignore */
                }
                reload();
              }}
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">当前路径</h2>
            <Badge tone={activePath.isPrimary ? "success" : "info"}>
              {activePath.isPrimary ? "主路径" : "当前路径"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-2">{activePath.title}</p>
          <p className="mt-1 text-xs text-ink-3">{activePath.goalSummary}</p>
          <div className="mt-3">
            <ProgressBar
              value={activePath.progress.completed}
              max={activePath.progress.total}
              label={`${activePath.progress.completed} / ${activePath.progress.total}`}
            />
          </div>
          <div className="mt-3">
            <ButtonLink href="/paths" variant="secondary" size="sm">
              查看全部路径
            </ButtonLink>
          </div>
        </Card>

        {/* 今日复习 */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">今日复习</h2>
              <p className="mt-0.5 text-sm text-ink-2">{todayReviewCount} 条记忆卡片待复习</p>
            </div>
            <ButtonLink href="/review" variant="secondary" size="sm">
              去复习
            </ButtonLink>
          </div>
        </Card>

        {/* 推荐情境 */}
        {recommendedLabId ? (
          <Card className="p-4 sm:p-5">
            <Badge tone="info">推荐情境</Badge>
            <h2 className="mt-2 text-base font-semibold text-ink">{LAB_TITLE[recommendedLabId] ?? "情境练习"}</h2>
            <p className="mt-1 text-sm text-ink-2">把「优先级沟通」放进真实协作场景练习。</p>
            <div className="mt-3">
              <ButtonLink href={`/labs/${recommendedLabId}`} variant="secondary" size="sm">
                开始练习
              </ButtonLink>
            </div>
          </Card>
        ) : null}

        {/* 小队任务 */}
        {crewTask ? (
          <Card className="p-4 sm:p-5">
            <Badge tone="warning">小队任务</Badge>
            <h2 className="mt-2 text-base font-semibold text-ink">{crewTask.title}</h2>
            <p className="mt-1 text-sm text-ink-3">截止：{crewTask.dueAt}</p>
            <div className="mt-3">
              <ButtonLink href={`/crews/${crewTask.crewId}`} variant="secondary" size="sm">
                前往小队
              </ButtonLink>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
