"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { RequireAuth } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { Card, Badge, ButtonLink, ProgressBar, SectionHeading } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { EmptyState, LoadingState, DemoTag, AiNote } from "@/components/states";
import { pathFor, PATH_PM } from "@/lib/demo";
import { formatMinutes, cn } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listPaths, getPath } from "@/lib/api/paths";
import { useAsync, resolveActivePathId } from "@/lib/api/hooks";
import type { KnowledgeNode, LearningPath, NodeStatus } from "@/lib/types";

const STATUS_META: Record<NodeStatus, { label: string; dot: string; tone: BadgeTone }> = {
  completed: { label: "已完成", dot: "bg-success", tone: "success" },
  current: { label: "当前", dot: "bg-action", tone: "neutral" },
  available: { label: "可开始", dot: "bg-ink-3", tone: "info" },
  locked: { label: "未解锁", dot: "bg-line-strong", tone: "neutral" },
  in_progress: { label: "学习中", dot: "bg-warning", tone: "info" },
};

function readCompleted(): string[] {
  try {
    const raw = window.localStorage.getItem("pf-node-completed");
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 综合数据状态与本地完成记录计算节点的有效状态 */
function effectiveStatus(node: KnowledgeNode, localCompleted: string[]): NodeStatus {
  if (localCompleted.includes(node.id)) return "completed";
  if (node.status === "completed" || node.status === "current" || node.status === "in_progress") {
    return node.status;
  }
  const prereqsDone = node.prerequisiteIds.every((p) => localCompleted.includes(p));
  return prereqsDone ? "available" : "locked";
}

function NodeRow({
  node,
  status,
  onOpen,
}: {
  node: KnowledgeNode;
  status: NodeStatus;
  onOpen: (node: KnowledgeNode, status: NodeStatus) => void;
}) {
  const meta = STATUS_META[status];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-6 shrink-0 text-right text-xs text-ink-3">{node.sequence}</span>
      <button
        type="button"
        onClick={() => onOpen(node, status)}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
        aria-label={status === "locked" ? `未解锁：${node.title}` : `打开节点：${node.title}`}
      >
        <span className="truncate text-sm font-medium text-ink">{node.title}</span>
        {node.evidenceCoverage.insufficient ? (
          <Badge tone="warning">证据不足</Badge>
        ) : null}
      </button>
      <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">
        {formatMinutes(node.estimatedMinutes)}
      </span>
      <Badge tone={meta.tone} className="shrink-0">
        {meta.label}
      </Badge>
    </div>
  );
}

function PathContent() {
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const pushToast = useAppStore((s) => s.pushToast);

  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setOnboarded(!!window.localStorage.getItem("pf-onboarded"));
    } catch {
      setOnboarded(false);
    }
    setLocalCompleted(readCompleted());
    setChecked(true);
  }, []);

  const isNewLearner = role === "new_learner";

  // api 模式：加载当前用户「当前路径」（含节点）作为唯一数据源
  const { data: apiPath, loading: apiLoading } = useAsync<LearningPath | null>(async () => {
    const list = await listPaths();
    const activeId = resolveActivePathId(list);
    const active = activeId ? (list.find((p) => p.id === activeId) ?? null) : null;
    if (!active) return null;
    return getPath(active.id);
  }, [], { enabled: isApiMode });

  const needsDiagnosis = isApiMode ? !apiPath : isNewLearner && !onboarded;

  // demo 模式：新学习者完成诊断后，用一条「从首个节点开始」的路径展示
  const basePath = isApiMode ? apiPath : pathFor(role);
  const baseNodes = basePath ? basePath.nodes : null;
  const rawNodes = useMemo(() => {
    if (needsDiagnosis) return [];
    if (baseNodes) return baseNodes;
    if (!isApiMode && isNewLearner && onboarded) {
      return PATH_PM.nodes.map((n) =>
        n.prerequisiteIds.length === 0
          ? ({ ...n, status: "available" } as KnowledgeNode)
          : ({ ...n, status: "locked" } as KnowledgeNode),
      );
    }
    return [];
  }, [needsDiagnosis, baseNodes, isNewLearner, onboarded, isApiMode]);

  if (isApiMode ? apiLoading : !checked) return <LoadingState label="正在加载路径…" />;

  if (needsDiagnosis) {
    return (
      <div>
        <StateBanner />
        <PageHeader
          title="学习路径"
          description="先完成目标诊断，生成你的知识树。"
        />
        <EmptyState
          icon="🗺️"
          title="还没有学习路径"
          description="先告诉我你想学什么，AI 会围绕你的主题规划学习路径。"
          action={{ label: "去规划", href: "/onboarding" }}
        />
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div>
        <StateBanner />
        <PageHeader title="学习路径" description="当前角色没有可展示的学习路径。" />
        <EmptyState
          title="当前角色没有学习路径"
          description="请切换到学习者演示角色，或先完成目标诊断。"
          action={{ label: "返回首页", href: "/home" }}
        />
      </div>
    );
  }

  const path = basePath ?? PATH_PM;

  // api 模式：节点状态直接来自数据库（planner 确定性计算）；demo 模式叠加本地完成记录
  const nodes = rawNodes.map((n) => ({
    ...n,
    status: isApiMode ? n.status : effectiveStatus(n, localCompleted),
  }));
  const groups = new Map<string, KnowledgeNode[]>();
  for (const n of nodes) {
    const arr = groups.get(n.chapter) ?? [];
    arr.push(n);
    groups.set(n.chapter, arr);
  }

  const completedCount = nodes.filter((n) => n.status === "completed").length;
  const totalCount = nodes.length;
  const remainingMinutes = nodes
    .filter((n) => n.status !== "completed")
    .reduce((s, n) => s + n.estimatedMinutes, 0);
  const currentNodeName =
    nodes.find((n) => n.status === "current")?.title ??
    nodes.find((n) => n.status === "available")?.title ??
    "——";

  function handleOpen(node: KnowledgeNode, status: NodeStatus) {
    if (status === "locked") {
      pushToast(`「${node.title}」尚未解锁，请先完成前置节点`, "warning");
      return;
    }
    router.push(`/path/nodes/${node.id}`);
  }

  return (
    <div>
      <StateBanner />
      <PageHeader
        title="学习路径"
        description={path.title}
        meta={
          <>
            <DemoTag />
            <AiNote />
          </>
        }
      />

      {/* 进度头部 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              当前节点：
              <span className="ml-1 text-ink">{currentNodeName}</span>
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {path.goalSummary} · 计划版本 {path.curriculumVersion}
            </p>
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <ProgressBar
              value={completedCount}
              max={totalCount}
              label={`${completedCount}/${totalCount} 已完成`}
            />
            <p className="text-xs text-ink-3">
              预计剩余 {formatMinutes(remainingMinutes)}（约 {path.estimatedWeeks} 周计划）
            </p>
          </div>
        </div>
      </Card>

      {/* 图例 */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2.5">
        <span className="text-xs font-medium text-ink-2">图例：</span>
        {(Object.keys(STATUS_META) as NodeStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-warning" />
          证据不足（可进入）
        </span>
      </div>

      {/* 章节分组节点列表 */}
      <div className="mt-6 space-y-6">
        {Array.from(groups.entries()).map(([chapter, chapterNodes]) => (
          <section key={chapter}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              {chapter}
              <Badge tone="neutral">{chapterNodes.length}</Badge>
            </h3>
            <Card className="divide-y divide-line overflow-hidden">
              {chapterNodes.map((n) => (
                <NodeRow key={n.id} node={n} status={n.status} onOpen={handleOpen} />
              ))}
            </Card>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle/50 px-4 py-3">
        <p className="text-xs text-ink-3">
          当前视图为「按章节」纵向列表；锁定节点需先完成前置节点，证据不足节点仍可按教材任务学习。
        </p>
        <ButtonLink href="/home" variant="ghost" size="sm">
          返回首页
        </ButtonLink>
      </div>
    </div>
  );
}

export default function PathPage() {
  return (
    <RequireAuth>
      <PathContent />
    </RequireAuth>
  );
}
