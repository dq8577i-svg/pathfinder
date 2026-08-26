"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import { AiNote, LoadingState } from "@/components/states";
import { PathSwitcher } from "@/components/path-switcher";
import { useAppStore } from "@/lib/store";
import { useAsync, useCurrentPathId } from "@/lib/api/hooks";
import type { ScenarioDto } from "@/lib/api/labs";
import { generateScenario, listScenarios } from "@/lib/api/labs";
import { formatDate } from "@/lib/utils";

const SOURCE_LABEL: Record<ScenarioDto["sourceType"], string> = {
  ai: "AI 生成",
  template: "模板",
};

/** 情境练习场（api 模式）：当前路径真实场景 + 生成 */
export function LabsApiView() {
  const { pathId, paths, reload: reloadPath } = useCurrentPathId();
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: scenarios, loading, reload } = useAsync<ScenarioDto[]>(
    async () => (pathId ? listScenarios(pathId) : []),
    [pathId],
    { enabled: !!pathId },
  );
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!pathId || generating) return;
    setGenerating(true);
    try {
      const s = await generateScenario(pathId);
      pushToast(`已生成「${s.title}」`, "success");
      await reload();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "场景生成失败，请稍后重试", "error");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState label="正在加载情境练习…" />;

  return (
    <>
      <PageHeader
        title="情境练习场"
        description="围绕当前学习路径的节点生成真实情境，与 AI 角色对话练手。"
        meta={
          <>
            <Badge tone="info">{scenarios?.length ?? 0} 个场景</Badge>
            <AiNote>场景基于你的真实节点生成（AI 或模板），非通用示例。</AiNote>
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

      {!scenarios || scenarios.length === 0 ? (
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-base font-medium text-ink">当前路径还没有情境练习</p>
          <p className="max-w-sm text-sm text-ink-2">
            从你的路径节点生成一个情境，进入与 AI 角色的实战对话。
          </p>
          <Button onClick={handleGenerate} loading={generating} className="mt-2">
            生成一个情境练习
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button onClick={handleGenerate} loading={generating} size="sm">
              再生成一个
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ScenarioCard({ scenario: s }: { scenario: ScenarioDto }) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{SOURCE_LABEL[s.sourceType]}</Badge>
        <span className="text-xs text-ink-3">节点：{s.nodeTitle || "未关联"}</span>
      </div>
      <h3 className="text-base font-semibold leading-snug text-ink">{s.title}</h3>
      <p className="line-clamp-3 text-sm text-ink-2">{s.situation}</p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-xs text-ink-3">{formatDate(s.createdAt)}</span>
        <ButtonLink href={`/labs/${s.id}`} size="sm">
          进入练习
        </ButtonLink>
      </div>
    </Card>
  );
}
