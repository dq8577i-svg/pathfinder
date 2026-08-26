"use client";

import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, ProgressBar } from "@/components/ui";
import { EmptyState, LoadingState } from "@/components/states";
import type { BadgeTone } from "@/components/ui";
import { PathSwitcher } from "@/components/path-switcher";
import { useAsync, useCurrentPathId } from "@/lib/api/hooks";
import type { SkillDimensionDto, SkillsOverviewDto } from "@/lib/api/skills";
import { getSkillsOverview } from "@/lib/api/skills";
import { formatDate } from "@/lib/utils";

const LEVEL_TONE: Record<SkillDimensionDto["level"], BadgeTone> = {
  待开始: "neutral",
  学习中: "info",
  已有基础: "success",
  证据不足: "warning",
};

const CONF_TONE: Record<SkillDimensionDto["confidence"], BadgeTone> = {
  high: "success",
  medium: "neutral",
  low: "warning",
};

const CONF_LABEL: Record<SkillDimensionDto["confidence"], string> = {
  high: "置信度高",
  medium: "置信度中",
  low: "置信度低",
};

/** 技能雷达（api 模式）：从当前用户路径真实派生 */
export function SkillsApiView() {
  const { pathId, paths, reload: reloadPath } = useCurrentPathId();
  const { data, loading } = useAsync<SkillsOverviewDto | null>(
    async () => (pathId ? getSkillsOverview(pathId) : null),
    [pathId],
    { enabled: !!pathId },
  );

  if (!pathId) {
    return (
      <EmptyState
        title="还没有学习路径"
        description="先完成目标诊断并生成学习路径，技能雷达会从你的路径、资料与练习评价中自动形成。"
        action={{ label: "去诊断", href: "/onboarding" }}
      />
    );
  }
  if (loading || !data) return <LoadingState label="正在计算技能画像…" />;

  const { priority, dimensions, totalEvidence, maxEvidence } = data;

  return (
    <>
      <PageHeader
        title="技能雷达"
        description={`基于 ${totalEvidence} 条学习证据（路径节点、真实资料、费曼评价）整理的当前学习画像，不代表职业认证或成绩。`}
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

      {priority ? (
        <Card className="mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">
                {priority.recommendation?.gapType ?? "优先补强"}
              </Badge>
              <span className="text-base font-semibold text-ink">{priority.name}</span>
            </div>
            <p className="mt-2 text-sm text-ink-2">
              <strong className="text-ink">{priority.recommendation?.nextAction}</strong>
              <span className="text-ink-3"> · 原因：{priority.recommendation?.reason}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ButtonLink href="/labs" size="sm">
              去情境练习
            </ButtonLink>
            <ButtonLink href="/review" variant="secondary" size="sm">
              做 10 分钟复习
            </ButtonLink>
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {dimensions.map((d) => (
          <DimensionCard key={d.id} dim={d} maxEvidence={maxEvidence} />
        ))}
      </div>
    </>
  );
}

function DimensionCard({ dim, maxEvidence }: { dim: SkillDimensionDto; maxEvidence: number }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">{dim.name}</h2>
        <Badge tone={LEVEL_TONE[dim.level]}>{dim.level}</Badge>
        <Badge tone={CONF_TONE[dim.confidence]}>{CONF_LABEL[dim.confidence]}</Badge>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={dim.evidenceCount} max={maxEvidence} className="flex-1" />
        <span className="shrink-0 text-xs text-ink-3">{dim.evidenceCount} 条证据</span>
      </div>

      {dim.evidences.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {dim.evidences.map((ev, i) => (
            <li key={`${ev.sourceId}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">{ev.sourceType}</Badge>
              <span className="text-ink">{ev.claim}</span>
              <span className="text-xs text-ink-3">
                {ev.sourceId} · {formatDate(ev.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-3">暂无证据：完成对应节点或练习后，这里会逐步形成画像。</p>
      )}

      {dim.recommendation ? (
        <div className="mt-4 rounded-md border border-line bg-subtle px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={dim.recommendation.gapType === "优先补强" || dim.recommendation.gapType === "证据不足" ? "warning" : "info"}>
              {dim.recommendation.gapType}
            </Badge>
            <span className="text-sm text-ink">{dim.recommendation.nextAction}</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">原因：{dim.recommendation.reason}</p>
        </div>
      ) : null}
    </Card>
  );
}
