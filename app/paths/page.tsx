"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, Field, Input, ProgressBar, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag, LoadingState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { PATH_PAUSED, PATH_PM } from "@/lib/demo";
import { useDemoTopic } from "@/lib/demo/use-topic";
import { mockFetch, formatDate } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listPaths } from "@/lib/api/paths";
import { resolveActivePathId } from "@/lib/api/hooks";
import type { LearningPath, PlanAdjustmentProposal } from "@/lib/types";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

/** 演示调整建议：PATH_PM 数据中无 adjustmentProposal，按 planHealth.showAdjustment 构建 */
function buildAdjustmentProposal(): PlanAdjustmentProposal {
  return {
    id: "adj-pm-01",
    generatedAt: new Date().toISOString(),
    reason: "本周仅完成 1/3 节点，可用时间少于目标 2 小时",
    assumptions: ["每周投入可由 5 小时调整为 6 小时", "需求分析章节的优先级保持不变"],
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

export default function PathsPage() {
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: topic, ready } = useDemoTopic();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (isApiMode) {
      let cancelled = false;
      listPaths()
        .then((list) => {
          if (!cancelled) {
            setPaths(list);
            setActiveId(resolveActivePathId(list));
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) setLoaded(true);
        });
      return () => {
        cancelled = true;
      };
    }
    if (!ready) return;
    setPaths(topic ? [topic.path] : [PATH_PM, PATH_PAUSED]);
    setLoaded(true);
  }, [ready, topic]);

  if (!isApiMode && !ready) return <LoadingState label="正在加载学习路径…" />;

  function handleSetActive(id: string, title: string) {
    try {
      window.localStorage.setItem("pf-active-path", id);
    } catch {
      /* ignore */
    }
    setActiveId(id);
    pushToast(`已将「${title}」设为当前路径`, "success");
  }

  const primary = paths.find((p) => p.isPrimary) ?? paths[0] ?? null;
  const proposal =
    (isApiMode ? primary?.adjustmentProposal : !topic ? PATH_PM.adjustmentProposal : null) ??
    buildAdjustmentProposal();
  const showProposal = isApiMode ? !!primary?.adjustmentProposal : !topic && PATH_PM.status === "in_progress";

  return (
    <FeatureGate
      flag="multi_path"
      title="多路径暂未开放"
      description="路径管理用于在多条学习路径间选择、暂停或创建，并保持教材版本可追溯。"
    >
      <PageHeader
        title="我的学习路径"
        description="路径是个人计划快照；教材更新不会静默覆盖你的节点与完成记录。"
        meta={<DemoTag />}
        actions={<CreatePathButton />}
      />
      <StateBanner state={demoState} />

      {showProposal && primary ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning-bg p-4">
          <div>
            <p className="text-sm font-medium text-warning">计划调整建议</p>
            <p className="mt-0.5 text-sm text-ink-2">
              {proposal.reason}。建议{proposal.impacts.join("；")}。影响列表已置顶，可逐条查看后决定是否接受。
            </p>
          </div>
          <ButtonLink href={`/paths/${primary.id}#adjustment`} variant="secondary" size="sm">
            查看影响与调整
          </ButtonLink>
        </Card>
      ) : null}

      {loaded && paths.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-medium text-ink">还没有学习路径</p>
          <p className="mt-1 text-sm text-ink-2">完成目标诊断后，这里会生成你的学习路径。</p>
          <div className="mt-4">
            <ButtonLink href="/onboarding">去创建路径</ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {paths.map((p) => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft;
            return (
              <li key={p.id}>
                <div className="flex flex-col rounded-lg border border-line bg-surface p-4 sm:p-5">
                <Link
                  href={`/paths/${p.id}`}
                  className="block transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{p.title}</h2>
                    <Badge tone={st.tone}>{st.text}</Badge>
                    {p.isPrimary ? <Badge tone="success">主路径</Badge> : null}
                    {isApiMode && p.id === activeId ? <Badge tone="info">当前路径</Badge> : null}
                    <span className="ml-auto text-xs text-ink-3">计划版本 {p.curriculumVersion}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{p.goalSummary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                    <span>每周 {p.weeklyHours} 小时</span>
                    <span>目标期限 {formatDate(p.deadline)}</span>
                    <span>上次活动 {formatDate(p.lastActivityAt)}</span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar
                      value={p.progress.completed}
                      max={p.progress.total}
                      label={`${p.progress.completed} / ${p.progress.total}`}
                    />
                  </div>
                </Link>
                {isApiMode && p.id !== activeId ? (
                  <div className="mt-3 border-t border-line pt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetActive(p.id, p.title)}
                    >
                      设为当前路径
                    </Button>
                  </div>
                ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-3">
        路径为个人快照；暂停不会删除会话与作品。创建新路径不会覆盖当前路径。
        {isApiMode ? " 当前选中的路径会同步到技能雷达、复习、情境练习与作品集。" : ""}
      </p>
    </FeatureGate>
  );
}

function CreatePathButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", goal: "", weeklyHours: "5" });
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  async function handleCreate() {
    if (isApiMode) {
      // api 模式：路径由目标诊断生成，直接进入规划页
      router.push("/onboarding");
      return;
    }
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    if (!form.title.trim() || !form.goal.trim()) {
      pushToast("请填写路径名称与目标", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      setOpen(false);
      setForm({ title: "", goal: "", weeklyHours: "5" });
      pushToast("新路径已创建（演示）");
    } catch {
      pushToast("创建失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => (isApiMode ? router.push("/onboarding") : setOpen(true))}>新建路径</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建学习路径"
        description="生成前会复用目标诊断；新路径不会覆盖当前路径。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              创建路径
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="路径名称" htmlFor="new-path-title">
            <Input
              id="new-path-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例如：用户研究方法补强"
            />
          </Field>
          <Field label="学习目标" htmlFor="new-path-goal" hint="一句话描述期望能力，例如「6 周完成需求分析与基础 PRD」">
            <Textarea
              id="new-path-goal"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              placeholder="本路径希望达成的能力目标"
            />
          </Field>
          <Field label="每周可投入时间" htmlFor="new-path-hours">
            <Select
              id="new-path-hours"
              value={form.weeklyHours}
              onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))}
            >
              <option value="3">3 小时 / 周</option>
              <option value="5">5 小时 / 周</option>
              <option value="6">6 小时 / 周</option>
              <option value="8">8 小时 / 周</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
