"use client";

import { useEffect, useState } from "react";
import { PageHeader, StateBanner } from "@/components/shell";
import { RequireAuth } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { Card, Badge, ButtonLink, ProgressBar, SectionHeading } from "@/components/ui";
import { EmptyState, LoadingState, DemoTag, AiNote } from "@/components/states";
import {
  pathFor,
  currentNodeFor,
  practiceSessionFor,
  NOTES,
  ADMIN_FLAGS,
  TENANT,
} from "@/lib/demo";
import { useDemoTopic } from "@/lib/demo/use-topic";
import { relativeTime } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listPaths, getPath } from "@/lib/api/paths";
import { resolveActivePathId } from "@/lib/api/hooks";
import type { LearningGoalInput } from "@/lib/plan/goal";
import { LearningDashboard } from "@/components/learning-dashboard";

interface OnboardedData {
  goal: LearningGoalInput;
  generatedAt: string;
  title: string;
}

function readOnboarded(): OnboardedData | null {
  try {
    const raw = window.localStorage.getItem("pf-onboarded");
    if (!raw) return null;
    return JSON.parse(raw) as OnboardedData;
  } catch {
    return null;
  }
}

/* ---------------- api 模式首页（真实用户路径，杜绝 Demo 数据） ---------------- */

function ApiHome() {
  const profile = useAppStore((s) => s.profile);
  const [path, setPath] = useState<NonNullable<Awaited<ReturnType<typeof getPath>>> | null>(null);
  const [paths, setPaths] = useState<NonNullable<Awaited<ReturnType<typeof listPaths>>>>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const paths = await listPaths();
        if (alive) setPaths(paths);
        const activePathId = resolveActivePathId(paths);
        if (activePathId) {
          const full = await getPath(activePathId);
          if (alive) setPath(full);
        }
      } catch {
        /* 网络/未登录：保持空态 */
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!checked) return <LoadingState label="正在读取学习状态…" />;

  if (!path) {
    return (
      <div>
        <StateBanner />
        <PageHeader
          title="开始你的学习"
          description={`${profile.displayName}，告诉 AI 你想学什么，再用基础、时间和目标期限生成专属路径。`}
        />
        <EmptyState
          title="还没有学习路径"
          description="输入任意学习主题，例如 Python 数据分析、日语、摄影或产品经理。"
          action={{ label: "规划我的学习路径", href: "/onboarding" }}
        />
      </div>
    );
  }

  const current =
    path.nodes.find((n) => n.status === "available" || n.status === "current") ?? path.nodes[0] ?? null;

  async function switchPath(pathId: string) {
    try {
      window.localStorage.setItem("pf-active-path", pathId);
      const full = await getPath(pathId);
      if (full) setPath(full);
    } catch {
      /* 保持当前路径 */
    }
  }

  if (!current) {
    return <EmptyState title="当前路径还没有学习节点" action={{ label: "新建路径", href: "/onboarding" }} />;
  }

  return (
    <LearningDashboard
      path={path}
      paths={paths}
      current={current}
      learnerName={profile.displayName}
      onSwitchPath={switchPath}
    />
  );
}

/* ---------------- 新学习者（林然，演示） ---------------- */

function NewLearnerHome() {
  const profile = useAppStore((s) => s.profile);
  const { data: topic, ready } = useDemoTopic();
  const [onboarded, setOnboarded] = useState<OnboardedData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOnboarded(readOnboarded());
      setChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready || !checked) return <LoadingState label="正在读取学习状态…" />;

  if (!onboarded) {
    return (
      <div>
        <StateBanner />
        <PageHeader
          title="开始你的学习路径"
          description={`${profile.displayName}，输入你真正想学的主题，AI 会按你的基础与时间编排路径。`}
        />
        <EmptyState
          title="还没有学习路径"
          description="你可以学习 Python、语言、摄影、产品经理或任何明确主题，并在之后继续添加其他路径。"
          action={{ label: "去规划", href: "/onboarding" }}
        />
      </div>
    );
  }

  const goal = onboarded.goal;
  return (
    <div>
      <StateBanner />
      <PageHeader
        title="你的学习路径"
        description="目标已确认，路径已生成（演示）。"
        meta={
          <>
            <DemoTag />
            <AiNote />
          </>
        }
      />
      <Card className="p-5 md:p-6">
        <SectionHeading title={onboarded.title} actions={<Badge tone="info">已生成</Badge>} />
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-3">目标画像</dt>
            <dd className="font-medium text-ink">
              {goal.topic} · {goal.currentLevel}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-3">目标</dt>
            <dd className="font-medium text-ink">{goal.goal || "（由 AI 理解）"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-3">每周投入</dt>
            <dd className="font-medium text-ink">{goal.weeklyHours} 小时</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-3">期限</dt>
            <dd className="font-medium text-ink">{goal.deadlineWeeks} 周</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-ink-2">
          围绕「{goal.topic}」推进，共 {topic?.path.nodes.length ?? 0} 个节点、{goal.deadlineWeeks} 周、每周 {goal.weeklyHours} 小时。
        </p>
        {topic ? (
          <>
            <div className="mt-4">
              <ProgressBar
                value={topic.path.progress.completed}
                max={topic.path.progress.total}
                label={`${topic.path.progress.completed}/${topic.path.progress.total} 节点`}
              />
            </div>
            <p className="mt-2 text-xs text-ink-3">
              当前节点：
              {topic.path.currentNodeId
                ? topic.path.nodes.find((n) => n.id === topic.path.currentNodeId)?.title ?? "—"
                : "—"}
            </p>
          </>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/path">进入路径</ButtonLink>
          <ButtonLink href="/paths" variant="secondary">管理全部路径</ButtonLink>
          <ButtonLink href="/onboarding" variant="secondary">创建另一条路径</ButtonLink>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- 在学学习者（陈思） ---------------- */

function LearnerHome() {
  const profile = useAppStore((s) => s.profile);
  const path = pathFor("learner")!;
  const current = currentNodeFor("learner")!;

  const recentNotes = NOTES.slice(0, 2);

  if (!path || !current) {
    return <EmptyState title="暂时没有可继续的学习任务" action={{ label: "返回首页", href: "/home" }} />;
  }

  return (
    <LearningDashboard
      path={path}
      paths={[path]}
      current={current}
      learnerName={profile.displayName}
      practiceHref="/practice/session-active-chen"
      recentItems={recentNotes.map((note) => ({ title: note.title, meta: relativeTime(note.updatedAt), href: "/notes" }))}
    />
  );
}

/* ---------------- 练习中学习者（周宁） ---------------- */

function PracticeLearnerHome() {
  const profile = useAppStore((s) => s.profile);
  const path = pathFor("practice_learner")!;
  const session = practiceSessionFor("practice_learner")!;

  return (
    <div>
      <StateBanner />
      <PageHeader
        title="继续学习"
        description={`${profile.displayName}，有一个未完成的费曼练习等你恢复。`}
        meta={
          <>
            <DemoTag />
            <AiNote />
          </>
        }
      />

      <Card className="border-warning/40 bg-warning-bg/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink">恢复未完成练习</p>
            <p className="mt-1 text-sm text-ink-2">
              费曼练习第 {session.currentRound}/{session.totalRounds} 轮进行中，本地有未发送草稿。
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {profile.resume?.detail ?? ""} · 同步状态：仅本地草稿
            </p>
          </div>
          <ButtonLink href="/practice/session-unfin-zhou">继续练习</ButtonLink>
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="路径进度" description={path?.title ?? ""} />
          <div className="mt-3">
            <ProgressBar
              value={path.progress.completed}
              max={path.progress.total}
              label={`${path.progress.completed}/${path.progress.total} 节点`}
            />
          </div>
          <div className="mt-4">
            <ButtonLink href="/path" variant="secondary" size="sm">
              查看路径
            </ButtonLink>
          </div>
        </Card>
        <Card className="p-5">
          <SectionHeading title="当前节点" description="从表象需求到真实需求" />
          <p className="mt-2 text-sm text-ink-2">
            区分用户提出的方案与底层任务，并写出至少一条可验证的需求假设。
          </p>
          <div className="mt-3">
            <ButtonLink href="/path/nodes/need-signal" variant="secondary" size="sm">
              打开节点
            </ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- 内容管理员（陈岚） ---------------- */

function ContentAdminHome() {
  const pending = ADMIN_FLAGS.filter((f) => f.status === "pending");
  return (
    <div>
      <StateBanner />
      <PageHeader
        title="内容运营台"
        description="待审核资源队列与教材版本维护（脱敏）。"
        meta={<DemoTag />}
      />
      <Card className="p-5">
        <SectionHeading
          title="待审核资源"
          description={`${pending.length} 条资源待处理`}
          actions={
            <ButtonLink href="/admin/content" variant="secondary" size="sm">
              前往处理
            </ButtonLink>
          }
        />
        <ul className="mt-3 divide-y divide-line">
          {pending.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{f.resourceTitle}</p>
                <p className="text-xs text-ink-3">
                  {f.reason} · {f.note}
                </p>
              </div>
              <Badge tone="warning">待处理</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------------- 机构管理员（张磊） ---------------- */

function OrgAdminHome() {
  const metrics = TENANT.aggregateMetrics.filter((m) => !m.suppressed).slice(0, 2);
  return (
    <div>
      <StateBanner />
      <PageHeader
        title="机构空间"
        description={`${TENANT.name} · ${TENANT.brandingNote}`}
        meta={<DemoTag />}
      />
      <Card className="p-5">
        <SectionHeading
          title={TENANT.name}
          description="仅展示本机构的脱敏聚合数据"
          actions={
            <ButtonLink href="/org/xingqiao" variant="secondary" size="sm">
              进入机构空间
            </ButtonLink>
          }
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-md border border-line p-4">
              <p className="text-sm text-ink-2">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{m.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- 路由 ---------------- */

function HomeContent() {
  const role = useAppStore((s) => s.role);

  // api 模式：展示真实用户路径（或通用空态），绝不渲染 Demo 角色数据
  if (isApiMode) return <ApiHome />;

  if (role === "new_learner") return <NewLearnerHome />;
  if (role === "learner") return <LearnerHome />;
  if (role === "practice_learner") return <PracticeLearnerHome />;
  if (role === "content_admin") return <ContentAdminHome />;
  if (role === "org_admin") return <OrgAdminHome />;

  return (
    <EmptyState
      title="请先登录"
      description="登录后即可查看你的学习路径。"
      action={{ label: "去登录", href: "/login" }}
    />
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}
