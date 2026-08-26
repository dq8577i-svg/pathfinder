"use client";

import { FeatureGate } from "@/components/guards";
import { PageHeader } from "@/components/shell";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { DemoTag } from "@/components/states";
import { isApiMode } from "@/lib/data-source";
import { SCENARIOS, SCENARIO_SESSION_ACTIVE, SCENARIO_SESSION_DONE } from "@/lib/demo";
import { LabsApiView } from "./api-view";
import type { BadgeTone } from "@/components/ui";
import type { Scenario } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

const ROLE_TONE: Record<Scenario["personaRole"], BadgeTone> = {
  业务方: "warning",
  研发: "info",
  用户: "neutral",
  主管: "danger",
  设计: "success",
};

const DIFF_TONE: Record<Scenario["difficulty"], BadgeTone> = {
  初级: "neutral",
  中级: "warning",
  高级: "danger",
};

function sessionMeta(id: string): { label: string; tone: BadgeTone; inProgress: boolean } | null {
  if (SCENARIO_SESSION_DONE.scenarioId === id) {
    return { label: "已完成 · 可查看复盘", tone: "success", inProgress: false };
  }
  if (SCENARIO_SESSION_ACTIVE.scenarioId === id) {
    return {
      label: `进行中 · 第 ${SCENARIO_SESSION_ACTIVE.round}/${SCENARIO_SESSION_ACTIVE.maxRounds} 轮`,
      tone: "warning",
      inProgress: true,
    };
  }
  return null;
}

export default function LabsPage() {
  if (isApiMode) return <LabsApiView />;
  return (
    <FeatureGate flag="scenario_labs">
      <PageHeader
        title="情境练习场"
        description="把产品知识放进工作对话：向 AI 扮演的业务方、研发或设计澄清、解释与辩护，获得基于 Rubric 的复盘。场景为教学模拟，不代表真实面试。"
        meta={<DemoTag />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((s) => {
          const meta = sessionMeta(s.id);
          return (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={ROLE_TONE[s.personaRole]}>{s.personaRole}</Badge>
                <Badge tone={DIFF_TONE[s.difficulty]}>{s.difficulty}</Badge>
                <Badge tone="neutral">{formatMinutes(s.estimatedMinutes)}</Badge>
                {s.status === "published" ? (
                  <Badge tone="info">已发布</Badge>
                ) : (
                  <Badge tone="warning">{s.status === "draft" ? "草稿" : "已下架"}</Badge>
                )}
              </div>

              <h2 className="mt-3 text-base font-semibold leading-snug text-ink">{s.title}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-2 line-clamp-3">{s.summary}</p>

              <div className="mt-3 flex flex-wrap gap-1">
                {s.skillTags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="min-w-0 truncate text-xs text-ink-3">AI 扮演：{s.persona}</span>
                <ButtonLink href={`/labs/${s.id}`} size="sm">
                  {meta?.inProgress ? "继续练习" : "开始练习"}
                </ButtonLink>
              </div>

              {meta ? (
                <div className="mt-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </FeatureGate>
  );
}
