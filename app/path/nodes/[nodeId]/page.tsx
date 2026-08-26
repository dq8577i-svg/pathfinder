"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { RequireAuth } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { Button, Card, Badge, ButtonLink, Divider, SectionHeading } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { Modal, ConfirmDialog } from "@/components/overlay";
import { ErrorState, EmptyState, LoadingState, OfflineState, DemoTag, AiNote } from "@/components/states";
import { pathFor, PATH_PM } from "@/lib/demo";
import { formatMinutes, formatDate, gradeLabel } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listPaths, getPath } from "@/lib/api/paths";
import { createPracticeSession } from "@/lib/api/practice";
import { refreshPathResources } from "@/lib/api/resources";
import { favoriteResource } from "@/lib/api/library";
import { useAsync } from "@/lib/api/hooks";
import type {
  KnowledgeNode,
  LearningPath,
  NodeStatus,
  ResourceEvidence,
  Grade,
  ResourceType,
  AccessibilityStatus,
} from "@/lib/types";

const STATUS_LABEL: Record<NodeStatus, string> = {
  completed: "已完成",
  current: "当前节点",
  available: "可开始",
  locked: "未解锁",
  in_progress: "学习中",
};

const STATUS_TONE: Record<NodeStatus, BadgeTone> = {
  completed: "success",
  current: "info",
  available: "info",
  locked: "neutral",
  in_progress: "info",
};

const SOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  official_docs: "官方文档",
  textbook: "教材",
  course: "课程",
  article: "文章",
  podcast: "播客",
  video: "视频",
  blog: "博客",
  university: "高校公开课",
  tool: "工具",
};

const ACCESS_LABEL: Record<AccessibilityStatus, string> = {
  verified: "可访问",
  pending: "待校验",
  unavailable: "可能不可访问",
  flagged: "已标记",
};

/**
 * Next.js 动态路由段（含 CJK，如 gen-python-数据分析-…）按原始 URL 编码值传入 useParams，
 * 而节点 id 是解码后的字符串；这里做一次安全解码对齐。
 */
function safeDecodeParam(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

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

function effectiveStatus(node: KnowledgeNode, localCompleted: string[]): NodeStatus {
  if (localCompleted.includes(node.id)) return "completed";
  if (node.status === "completed" || node.status === "current" || node.status === "in_progress") {
    return node.status;
  }
  const prereqsDone = node.prerequisiteIds.every((p) => localCompleted.includes(p));
  return prereqsDone ? "available" : "locked";
}

function gradeTone(g: Grade): BadgeTone {
  return g === "A" ? "success" : g === "B" ? "warning" : "neutral";
}

function accessTone(a: AccessibilityStatus): BadgeTone {
  if (a === "verified") return "success";
  if (a === "pending") return "warning";
  if (a === "unavailable") return "danger";
  return "warning";
}

function NodeDetail() {
  const params = useParams();
  const nodeId = safeDecodeParam(typeof params.nodeId === "string" ? params.nodeId : "");
  const router = useRouter();

  const role = useAppStore((s) => s.role);
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);

  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<ResourceEvidence | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

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

  // api 模式：加载当前用户主路径（节点状态与资源来自 PostgreSQL）
  const { data: apiPath, loading: apiLoading, reload: reloadPath } = useAsync<LearningPath | null>(
    async () => {
      const list = await listPaths();
      const primary = list.find((p) => p.isPrimary) ?? list[0];
      if (!primary) return null;
      return getPath(primary.id);
    },
    [],
    { enabled: isApiMode },
  );

  const basePath = isApiMode ? apiPath : pathFor(role);
  const hasAccessPath = isApiMode ? !!basePath : !!basePath || (isNewLearner && onboarded === true);
  const path = basePath ?? (isApiMode ? null : isNewLearner && onboarded === true ? PATH_PM : null);

  const rawNode = path?.nodes.find((n) => n.id === nodeId) ?? null;
  const baseNode =
    rawNode && !isApiMode && isNewLearner && !basePath
      ? {
          ...rawNode,
          status: (rawNode.prerequisiteIds.length === 0 ? "available" : "locked") as NodeStatus,
        }
      : rawNode;

  if (isApiMode ? apiLoading : !checked) return <LoadingState label="正在加载节点…" />;

  if (!hasAccessPath) {
    return (
      <div>
        <StateBanner />
        <EmptyState
          title="还没有学习路径"
          description="先完成目标诊断，生成你的学习路径后再进入节点。"
          action={{ label: "去诊断", href: "/onboarding" }}
        />
      </div>
    );
  }

  if (!baseNode || !path) {
    return <ErrorState title="未找到该学习节点" description="该节点不存在或不属于你的路径。" backTo="/path" backLabel="返回路径" />;
  }

  // api 模式：节点状态直接来自数据库；demo 模式叠加本地完成记录
  const status = isApiMode ? baseNode.status : effectiveStatus(baseNode, localCompleted);
  const isCompleted = status === "completed";
  const cov = baseNode.evidenceCoverage;
  const insufficient =
    cov.insufficient || demoState === "evidence_insufficient";
  const canPractice = nodeId === "need-signal";

  const prereqNodes = baseNode.prerequisiteIds
    .map((pid) => path.nodes.find((n) => n.id === pid))
    .filter((n): n is KnowledgeNode => !!n);

  const nextNode = path.nodes
    .filter((n) => n.sequence > baseNode.sequence)
    .sort((a, b) => a.sequence - b.sequence)[0];

  function handleStart() {
    if (!baseNode) return;
    if (demoState === "offline") {
      pushToast("离线演示下不能开始 AI 会话", "error");
      return;
    }
    pushToast(`已开始学习「${baseNode.title}」，请先阅读下方资料`, "info");
  }

  /** api 模式：为本路径所有待补充节点发起真实资料检索（幂等：已有资源的节点跳过） */
  async function handleRefreshResources() {
    if (!basePath || refreshing) return;
    setRefreshing(true);
    try {
      const result = await refreshPathResources(basePath.id);
      if (result.provider === "mock") {
        pushToast("搜索未配置（Mock 占位），未生成真实资料", "warning");
      } else if (result.nodesWithResources > 0) {
        pushToast(
          `已为 ${result.nodesWithResources} 个节点补充真实学习资料${result.failures.length ? `，${result.failures.length} 个节点未检索到` : ""}`,
          "success",
        );
      } else {
        pushToast("暂未检索到可补充的资料，可稍后重试", "info");
      }
      await reloadPath();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "资料补充失败，请稍后重试", "error");
    } finally {
      setRefreshing(false);
    }
  }

  /** api 模式：收藏当前路径的真实资源到个人资料库（同用户幂等） */
  async function handleFavorite(res: ResourceEvidence) {
    if (!basePath || favoritingId) return;
    setFavoritingId(res.id);
    try {
      await favoriteResource(basePath.id, res.id);
      pushToast(`已收藏「${res.title}」到个人资料库`, "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "收藏失败，请稍后重试", "error");
    } finally {
      setFavoritingId(null);
    }
  }

  /** api 模式：为当前节点创建真实费曼会话后进入对话页 */
  async function handleStartPractice() {
    if (!baseNode || practicing) return;
    setPracticing(true);
    try {
      const s = await createPracticeSession({ nodeId: baseNode.id });
      router.push(`/practice/${s.id}`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "无法创建练习会话，请稍后重试", "error");
      setPracticing(false);
    }
  }

  function handleComplete() {
    if (demoState === "offline") {
      pushToast("离线演示下不会伪造已保存", "error");
      setCompleteOpen(false);
      return;
    }
    setCompleting(true);
    window.setTimeout(() => {
      const next = localCompleted.includes(nodeId) ? localCompleted : [...localCompleted, nodeId];
      setLocalCompleted(next);
      try {
        window.localStorage.setItem("pf-node-completed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setCompleting(false);
      setCompleteOpen(false);
      pushToast("已标记为完成，学习进度已更新", "success");
    }, 400);
  }

  function handleUndo() {
    const next = localCompleted.filter((id) => id !== nodeId);
    setLocalCompleted(next);
    try {
      window.localStorage.setItem("pf-node-completed", JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setUndoOpen(false);
    pushToast("已撤销完成", "info");
  }

  /* 锁定节点只展示前置说明 */
  if (status === "locked") {
    return (
      <div>
        <StateBanner />
        <PageHeader title={baseNode.title} description={`${baseNode.chapter} · 未解锁节点`} />
        <Card className="p-6">
          <p className="font-medium text-ink">该节点尚未解锁</p>
          <p className="mt-2 text-sm text-ink-2">请先完成以下前置节点后再回来学习：</p>
          <ul className="mt-3 space-y-1">
            {prereqNodes.length > 0 ? (
              prereqNodes.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-sm text-ink">
                  <span aria-hidden="true" className="text-ink-3">·</span>
                  {n.title}
                </li>
              ))
            ) : (
              <li className="text-sm text-ink-3">等待前置节点完成后开放。</li>
            )}
          </ul>
          <div className="mt-5">
            <ButtonLink href="/path" variant="secondary">
              返回路径
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <StateBanner />
      <PageHeader
        title={baseNode.title}
        description={`${baseNode.chapter} · 节点 ${baseNode.sequence} / ${path.nodes.length} · 预计 ${formatMinutes(baseNode.estimatedMinutes)}`}
        meta={
          <>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            {insufficient ? <Badge tone="warning">证据不足</Badge> : null}
            <DemoTag />
          </>
        }
      />

      {demoState === "offline" ? (
        <div className="mb-4">
          <OfflineState description="离线演示下可阅读本地内容，但不能开始 AI 会话或写入完成状态。" />
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* 能力目标 */}
          <Card className="p-5">
            <SectionHeading title="能力目标" />
            <p className="mt-2 text-sm text-ink-2">{baseNode.capabilityGoal}</p>
          </Card>

          {/* 完成条件 */}
          <Card className="p-5">
            <SectionHeading title="完成条件" description="满足以下条件后可标记为完成" />
            <ul className="mt-3 space-y-1.5">
              {baseNode.completionCriteria.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-ink-2">
                  <span aria-hidden="true" className="mt-0.5 text-ink-3">
                    ·
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </Card>

          {/* 真实场景示例 */}
          {baseNode.scenario ? (
            <Card className="border-line bg-subtle/40 p-5">
              <SectionHeading title="真实场景示例" />
              <p className="mt-2 text-sm text-ink-2">
                用户说「{baseNode.scenario}」——
                {isApiMode
                  ? `先理清目标与边界，再达成能力目标：${baseNode.capabilityGoal}。`
                  : "试着像产品经理一样先澄清任务，再写需求假设。"}
              </p>
            </Card>
          ) : null}

          {/* 资料与依据 */}
          <Card className="p-5">
            <SectionHeading
              title="资料与依据"
              description="A/B/C 分级公开资料，均标注来源与检索时间。"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="success">A 级 {cov.aCount}</Badge>
              <Badge tone="warning">B 级 {cov.bCount}</Badge>
              <Badge tone="neutral">C 级 {cov.cCount}</Badge>
              {cov.hasAB ? (
                <Badge tone="success">含 A/B 级核心依据</Badge>
              ) : (
                <Badge tone="warning">缺少 A/B 级依据</Badge>
              )}
            </div>

            {insufficient ? (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-3 text-sm text-warning">
                <span aria-hidden="true">!</span>
                <div>
                  <p className="font-medium">证据不足</p>
                  <p className="mt-0.5 text-ink-2">
                    当前节点缺少足够的 A/B 级公开来源，已标记为待补充资料。仍可先按教材任务学习，补充资料示意如下。
                  </p>
                </div>
              </div>
            ) : null}

            {isApiMode && baseNode.resources.length === 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-subtle/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">待补充资料</p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    该节点暂无真实学习资源。将为本路径所有待补充节点发起实时检索并分级（A/B/C）整理。
                  </p>
                </div>
                <Button size="sm" onClick={handleRefreshResources} loading={refreshing}>
                  生成学习资料
                </Button>
              </div>
            ) : null}

            <ul className="mt-4 divide-y divide-line">
              {baseNode.resources.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="flex min-h-[44px] flex-1 items-center justify-between gap-3 rounded-md px-1 py-2.5 text-left hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
                    aria-label={`查看证据详情：${r.title}`}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={gradeTone(r.grade)}>{gradeLabel(r.grade)}</Badge>
                        <span className="text-sm font-medium text-ink">{r.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {r.sourceName} · {SOURCE_TYPE_LABEL[r.sourceType]} · {r.domain}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-2">详情 →</span>
                  </button>
                  {isApiMode ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={favoritingId === r.id}
                      onClick={() => handleFavorite(r)}
                      aria-label={`收藏到资料库：${r.title}`}
                      className="shrink-0"
                    >
                      收藏
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-3">
              点击证据行查看来源、校验时间与跳转链接。仅保存元数据与链接，不复制正文。
              <AiNote />
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          {/* 操作区 */}
          <Card className="p-5">
            <SectionHeading
              title={isCompleted ? "本节点已完成" : "开始学习"}
              description={isCompleted ? "你可以撤销完成，或进入下一节点。" : "阅读资料并满足完成条件后标记完成。"}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isApiMode ? (
                <>
                  {!isCompleted ? (
                    <Button onClick={handleStartPractice} loading={practicing}>
                      开始费曼练习
                    </Button>
                  ) : (
                    <Badge tone="success">已完成</Badge>
                  )}
                  <p className="w-full text-xs text-ink-3">完成进度由练习会话与评价自动更新。</p>
                </>
              ) : (
                <>
                  {!isCompleted ? (
                    <>
                      {canPractice ? (
                        <ButtonLink href="/practice/session-active-chen">开始费曼练习</ButtonLink>
                      ) : (
                        <Button onClick={handleStart} disabled={demoState === "offline"}>
                          开始学习
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setCompleteOpen(true)}
                        disabled={demoState === "offline"}
                      >
                        标记为完成
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge tone="success">已完成</Badge>
                      <Button variant="dangerGhost" onClick={() => setUndoOpen(true)}>
                        撤销完成
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            {!isApiMode && canPractice ? (
              <p className="mt-3 text-xs text-ink-3">
                该节点有进行中的费曼会话（第 2 轮），可直接继续。
                <AiNote />
              </p>
            ) : null}
          </Card>

          {/* 下一步推荐 */}
          {isCompleted && nextNode ? (
            <Card className="p-5">
              <SectionHeading title="下一步" description="完成当前节点后，下一节点已解锁" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{nextNode.title}</p>
                  <p className="text-xs text-ink-3">
                    {nextNode.chapter} · 预计 {formatMinutes(nextNode.estimatedMinutes)}
                  </p>
                </div>
                <ButtonLink href={`/path/nodes/${nextNode.id}`} variant="secondary" size="sm">
                  打开节点
                </ButtonLink>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <SectionHeading title="返回路径" description="查看整条知识树的前置关系与进度。" />
              <div className="mt-3">
                <ButtonLink href="/path" variant="secondary" size="sm">
                  查看路径
                </ButtonLink>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 证据详情 */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ""}
        description={selected ? `${selected.sourceName} · ${SOURCE_TYPE_LABEL[selected.sourceType]} · ${selected.domain}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              关闭
            </Button>
            {selected ? (
              <ButtonLink external href={selected.url}>
                在新标签打开原站
              </ButtonLink>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={gradeTone(selected.grade)}>{gradeLabel(selected.grade)}</Badge>
              <Badge tone={accessTone(selected.accessibilityStatus)}>
                {ACCESS_LABEL[selected.accessibilityStatus]}
              </Badge>
            </div>
            <p className="text-ink-2">{selected.reason}</p>
            <Divider />
            <dl className="grid gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">校验时间</dt>
                <dd className="text-ink">{formatDate(selected.checkedAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">检索时间</dt>
                <dd className="text-ink">{formatDate(selected.retrievedAt)}</dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-ink-3">许可说明</dt>
                <dd className="text-right text-ink">{selected.licenseNote}</dd>
              </div>
            </dl>
            <p className="text-xs text-ink-3">仅保存元数据与链接；外链将适用原机构的隐私与版权条款。</p>
          </div>
        ) : null}
      </Modal>

      {/* 标记完成确认 */}
      <ConfirmDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onConfirm={handleComplete}
        title="标记为完成"
        description="确认你已经理解并完成该节点的学习任务？完成后将解锁下一节点（演示）。"
        confirmLabel="标记完成"
        loading={completing}
      />

      {/* 撤销完成确认 */}
      <ConfirmDialog
        open={undoOpen}
        onClose={() => setUndoOpen(false)}
        onConfirm={handleUndo}
        title="撤销完成"
        description="将把该节点恢复为未完成状态。"
        confirmLabel="撤销完成"
        danger
      />
    </div>
  );
}

export default function NodePage() {
  return (
    <RequireAuth>
      <NodeDetail />
    </RequireAuth>
  );
}
