"use client";

import { FeatureGate } from "@/components/guards";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card, ProgressBar } from "@/components/ui";
import { DemoTag } from "@/components/states";
import { isApiMode } from "@/lib/data-source";
import { SKILL_DIMENSIONS } from "@/lib/demo";
import { SkillsApiView } from "./api-view";
import type { BadgeTone } from "@/components/ui";
import type { SkillDimension, SkillLevel } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const LEVEL_TONE: Record<SkillLevel, BadgeTone> = {
  待开始: "neutral",
  学习中: "info",
  已有基础: "success",
  证据不足: "warning",
};

const CONF_TONE: Record<SkillDimension["confidence"], BadgeTone> = {
  high: "success",
  medium: "neutral",
  low: "warning",
};

const CONF_LABEL: Record<SkillDimension["confidence"], string> = {
  high: "置信度高",
  medium: "置信度中",
  low: "置信度低",
};

const totalEvidence = SKILL_DIMENSIONS.reduce((sum, d) => sum + d.evidenceCount, 0);
const maxEvidence = Math.max(1, ...SKILL_DIMENSIONS.map((d) => d.evidenceCount));
const priority = SKILL_DIMENSIONS.find((d) => d.recommendation?.gapType === "优先补强") ?? null;

export default function SkillsPage() {
  if (isApiMode) return <SkillsApiView />;
  return (
    <FeatureGate flag="skill_radar">
      <PageHeader
        title="技能雷达"
        description={`基于 ${totalEvidence} 条学习证据（已完成节点、费曼评价、情境练习 Rubric）整理的当前学习画像，不代表职业认证或成绩。`}
        meta={<DemoTag />}
      />

      {priority ? (
        <Card className="mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">{priority.recommendation?.gapType ?? "优先补强"}</Badge>
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
        {SKILL_DIMENSIONS.map((d) => (
          <DimensionCard key={d.id} dim={d} maxEvidence={maxEvidence} />
        ))}
      </div>
    </FeatureGate>
  );
}

function DimensionCard({ dim, maxEvidence }: { dim: SkillDimension; maxEvidence: number }) {
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
