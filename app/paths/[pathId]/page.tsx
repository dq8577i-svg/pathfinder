"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ProgressBar,
  SectionHeading,
  Skeleton,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/overlay";
import { AiNote, DemoTag, ErrorState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { PATH_PAUSED, PATH_PM } from "@/lib/demo";
import { mockFetch, formatDate, formatDateTime } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { getPath } from "@/lib/api/paths";
import { useAsync } from "@/lib/api/hooks";
import type { LearningPath, PlanAdjustmentProposal, PlanVersion } from "@/lib/types";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

/** 演示调整建议：PATH_PM 数据中无 adjustmentProposal，按 planHealth.showAdjustment 与 PATH_RATIONALE 构建 */
function buildProposal(): PlanAdjustmentProposal {
  return {
    id: "adj-pm-01",
    generatedAt: new Date().toISOString(),
    reason: "本周仅完成 1/3 节点，可用时间少于目标 2 小时",
    assumptions: [
      "每周投入可由 5 小时调整为 6 小时（周末多出 1 小时可稳定投入）",
      "需求分析章节的优先级保持不变，不重排已完成节点",
    ],
    affectedNodes: [
      { title: "从表象需求到真实需求", before: "本周五", after: "下周二" },
      { title: "用户研究与需求假设", before: "下周", after: "顺延 1 周" },
    ],
    impacts: ["周均投入由 5 小时调整为 6 小时", "完成日期延后 1 周", "2 个节点的时间安排顺延"],
    confidence: "medium",
    proposedDeadline: inDays(37),
    proposedWeeklyHours: 6,
  };
}

const STATUS_LABEL: Record<string, { text: string; tone: "info" | "warning" | "neutral" | "success" }> = {
  in_progress: { text: "进行中", tone: "info" },
  paused: { text: "已暂停", tone: "warning" },
  draft: { text: "草稿", tone: "neutral" },
  completed: { text: "已完成", tone: "success" },
  archived: { text: "已归档", tone: "neutral" },
};

export default function PathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const demoState = useAppStore((s) => s.demoState);

  // api 模式：从真实路径详情加载（含节点与 planVersions）
  const { data: apiPath, loading: apiLoading } = useAsync<LearningPath | null>(
    () => getPath(pathId),
    [pathId],
    { enabled: isApiMode },
  );

  const path: LearningPath | null = isApiMode
    ? apiPath
    : pathId === PATH_PM.id
      ? PATH_PM
      : pathId === PATH_PAUSED.id
        ? PATH_PAUSED
        : null;

  if (isApiMode && apiLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="加载路径详情中">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <FeatureGate
      flag="multi_path"
      title="多路径暂未开放"
      description="路径详情用于查看节点证据、计划版本，并主动确认 AI 提议的节奏调整。"
    >
      {path ? <PathDetail key={path.id} path={path} /> : <ErrorState title="未找到该路径" description="该路径不存在或已被移除。" backTo="/paths" />}
      <StateBanner state={demoState} />
    </FeatureGate>
  );
}

function PathDetail({ path }: { path: LearningPath }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  // api 模式暂无计划调整 API，建议区不展示演示数据；demo 模式按 PATH_RATIONALE 构建
  const proposal = isApiMode ? null : path.adjustmentProposal ?? (path.status === "in_progress" ? buildProposal() : null);
  const [decision, setDecision] = useState<"none" | "accepted" | "rejected">("none");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<"none" | "accept" | "reject">("none");
  const [applied, setApplied] = useState<{ weeklyHours: number; deadline: string } | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>(() => {
    if (path.planVersions && path.planVersions.length > 0) return [...path.planVersions];
    return [
      {
        id: `${path.id}-v1`,
        version: 1,
        weeklyHours: path.weeklyHours,
        deadline: path.deadline,
        reason: "初始计划",
        createdAt: path.createdAt,
        source: "initial",
      },
    ];
  });

  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  // 从列表页「查看调整建议」跳转时滚动到影响列表
  useEffect(() => {
    if (loading) return;
    if (typeof window !== "undefined" && window.location.hash === "#adjustment") {
      document.getElementById("adjustment")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="加载路径详情中">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const st = STATUS_LABEL[path.status] ?? STATUS_LABEL.draft;
  const currentWeeklyHours = applied?.weeklyHours ?? path.weeklyHours;
  const currentDeadline = applied?.deadline ?? path.deadline;
  const currentVersion = versions.length > 0 ? versions[versions.length - 1].version : 1;

  async function handleAccept() {
    if (saving || !proposal) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      setVersions((v) => [
        ...v,
        {
          id: `${path.id}-v2`,
          version: currentVersion + 1,
          weeklyHours: proposal.proposedWeeklyHours,
          deadline: proposal.proposedDeadline,
          reason: "接受 AI 计划调整建议",
          createdAt: new Date().toISOString(),
          source: "ai_proposal",
        },
      ]);
      setApplied({ weeklyHours: proposal.proposedWeeklyHours, deadline: proposal.proposedDeadline });
      setDecision("accepted");
      setConfirm("none");
      pushToast("计划已更新（演示）");
    } catch {
      pushToast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [300, 500] });
      setDecision("rejected");
      setConfirm("none");
      pushToast("已忽略调整建议（演示）");
    } catch {
      pushToast("操作失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={path.title}
        description={path.goalSummary}
        meta={
          <>
            <Badge tone={st.tone}>{st.text}</Badge>
            {path.isPrimary ? <Badge tone="success">主路径</Badge> : null}
            <DemoTag />
          </>
        }
      />

      {/* 概览 */}
      <Card className="p-4 sm:p-5">
        <SectionHeading
          title="概览"
          description={
            path.rationale.kind === "generic"
              ? `围绕「${path.rationale.topic ?? path.title}」的 AI 规划 · 共 ${path.progress.total} 个技能节点`
              : `教材 ${path.rationale.curriculumTitle} · ${path.curriculumVersion}`
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-ink-3">路径进度</p>
            <ProgressBar
              value={path.progress.completed}
              max={path.progress.total}
              label={`${path.progress.completed} / ${path.progress.total}`}
              className="mt-1.5"
            />
          </div>
          <div>
            <p className="text-xs text-ink-3">每周投入</p>
            <p className="mt-1 text-sm font-medium text-ink">{currentWeeklyHours} 小时</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">目标期限</p>
            <p className="mt-1 text-sm font-medium text-ink">{formatDate(currentDeadline)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">计划版本</p>
            <p className="mt-1 text-sm font-medium text-ink">v{currentVersion}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">创建时间</p>
            <p className="mt-1 text-sm text-ink-2">{formatDate(path.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">最近活动</p>
            <p className="mt-1 text-sm text-ink-2">{formatDateTime(path.lastActivityAt)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          <AiNote>路径由 AI 基于 {path.rationale.providerLabel} 编排，个人计划快照，可回滚。</AiNote>
        </p>
      </Card>

      {/* 计划调整建议 */}
      <Card className="p-4 sm:p-5" id="adjustment">
        <SectionHeading
          title="计划调整建议"
          description={path.status === "in_progress" ? "影响列表置顶展示；确认后才写入新计划版本。" : "路径暂停中，不提供计划调整。"}
        />

        {path.status !== "in_progress" ? (
          <p className="mt-4 text-sm text-ink-2">该路径已暂停或已完成，计划调整不可用。恢复路径后可重新生成建议。</p>
        ) : decision === "accepted" ? (
          <div className="mt-4 rounded-md border border-success/30 bg-success-bg px-3 py-2.5 text-sm text-success">
            已接受调整：每周投入 {applied?.weeklyHours ?? proposal?.proposedWeeklyHours} 小时，完成日期调整至{" "}
            {formatDate(applied?.deadline ?? proposal?.proposedDeadline ?? "")}。可在下方版本历史中回滚。
          </div>
        ) : decision === "rejected" ? (
          <div className="mt-4 rounded-md border border-line bg-subtle px-3 py-2.5 text-sm text-ink-2">
            已忽略本次调整建议，当前计划保持不变。
          </div>
        ) : proposal ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-ink">预计影响</p>
              <ul className="mt-2 space-y-1.5">
                {proposal.impacts.map((i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
                    <span aria-hidden="true">!</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium text-ink">受影响节点</p>
              <ul className="mt-2 space-y-1.5">
                {proposal.affectedNodes.map((n) => (
                  <li key={n.title} className="flex flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink">
                    <span className="font-medium">{n.title}</span>
                    <span className="text-ink-3">{n.before}</span>
                    <span aria-hidden="true" className="text-ink-3">→</span>
                    <span className="text-ink-2">{n.after}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-subtle p-3">
                <p className="text-xs text-ink-3">建议每周投入</p>
                <p className="mt-1 text-sm font-medium text-ink">{proposal.proposedWeeklyHours} 小时</p>
              </div>
              <div className="rounded-md bg-subtle p-3">
                <p className="text-xs text-ink-3">建议完成日期</p>
                <p className="mt-1 text-sm font-medium text-ink">{formatDate(proposal.proposedDeadline)}</p>
              </div>
              <div className="rounded-md bg-subtle p-3">
                <p className="text-xs text-ink-3">置信度</p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {proposal.confidence === "high" ? "高" : proposal.confidence === "medium" ? "中" : "低"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-ink">建议依据（假设）</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {proposal.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">
                建议非强制、可编辑；基于你的每周可用时间、完成记录与假设生成。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirm("accept")}>接受调整</Button>
              <Button variant="secondary" onClick={() => setConfirm("reject")}>
                拒绝
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-2">当前没有待处理的计划调整建议。</p>
        )}
      </Card>

      {/* 计划版本历史 */}
      <Card className="p-4 sm:p-5">
        <SectionHeading title="计划版本历史" description="每次确认都会产生不可变版本，可回滚至前一版本。" />
        <ul className="mt-3 divide-y divide-line">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink">v{v.version}</span>
                <span className="ml-2 text-ink-2">{v.reason}</span>
                <span className="ml-2 text-xs text-ink-3">
                  {v.source === "initial" ? "初始计划" : v.source === "ai_proposal" ? "AI 建议" : "自定义"}
                </span>
              </div>
              <span className="text-xs text-ink-3">
                {formatDateTime(v.createdAt)} · 每周 {v.weeklyHours}h · 期限 {formatDate(v.deadline)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/paths" variant="secondary">
          返回路径列表
        </ButtonLink>
      </div>

      <ConfirmDialog
        open={confirm === "accept"}
        onClose={() => setConfirm("none")}
        onConfirm={handleAccept}
        title="接受计划调整？"
        description={`确认后将在计划版本历史中创建新版本（v${currentVersion + 1}），可随时回滚到当前版本。`}
        confirmLabel="确认接受"
        loading={saving}
      />
      <ConfirmDialog
        open={confirm === "reject"}
        onClose={() => setConfirm("none")}
        onConfirm={handleReject}
        title="忽略调整建议？"
        description="当前计划保持不变；后续仍可重新生成建议。"
        confirmLabel="确认忽略"
        danger
        loading={saving}
      />
    </div>
  );
}
