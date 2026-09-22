"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button, Card, Badge, Divider, SectionHeading } from "@/components/ui";
import { OfflineState, DemoTag, AiNote } from "@/components/states";
import { RequireAuth } from "@/components/guards";
import { demoPlanOf, buildDemoTopicBundle } from "@/lib/demo";
import { formatDate, cn } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { previewPath, confirmPath } from "@/lib/api/paths";
import { refreshPathResources } from "@/lib/api/resources";
import { learningGoalSchema, EXAMPLE_TOPICS, type LearningGoalInput } from "@/lib/plan/goal";
import type { KnowledgeNode, LearningPath, PathRationale } from "@/lib/types";

const HOUR_CHIPS = [2, 5, 8, 15];
const WEEK_CHIPS = [4, 12, 26, 52];
const LEVEL_CHIPS = ["零基础", "有点基础", "自学过一些"];

const GENERATE_STAGES = [
  "理解你的学习目标",
  "检索公开资料与来源证据",
  "按基础与时间编排技能",
  "生成个性化学习路径",
];

function hoursNote(h: number): string {
  if (h <= 2) return "每周 2 小时 ≈ 每天约 17 分钟，适合碎片时间";
  if (h <= 5) return "每周 5 小时 ≈ 工作日晚间 30–40 分钟 + 周末 2 小时";
  if (h <= 8) return "每周 8 小时 ≈ 隔天 1 小时 + 周末 3 小时";
  return `每周 ${h} 小时 ≈ 每天约 ${Math.round((h * 60) / 7)} 分钟，进度更快但需保持节奏`;
}

function weeksNote(w: number): string {
  const end = new Date(Date.now() + w * 7 * 86400000);
  const months = Math.round(((w * 7) / 30) * 10) / 10;
  return `期限 ${w} 周（约 ${months} 个月），预计 ${formatDate(end.toISOString())} 前后完成`;
}

function Onboarding() {
  const router = useRouter();
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [goalText, setGoalText] = useState("");
  const [currentLevel, setCurrentLevel] = useState("零基础");
  const [weeklyHours, setWeeklyHours] = useState<number | null>(null);
  const [deadlineWeeks, setDeadlineWeeks] = useState<number | null>(null);
  const [customHours, setCustomHours] = useState("");
  const [customWeeks, setCustomWeeks] = useState("");

  const [phase, setPhase] = useState<"form" | "generating" | "result">("form");
  const [stageIdx, setStageIdx] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmStage, setConfirmStage] = useState<"creating" | "resources" | null>(null);
  const [result, setResult] = useState<{
    id: string;
    title: string;
    rationale: PathRationale;
    nodes: KnowledgeNode[];
  } | null>(null);
  const [weeksEnd, setWeeksEnd] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const pendingTopic = window.localStorage.getItem("pf-pending-topic");
      if (pendingTopic) {
        queueMicrotask(() => setTopic(pendingTopic));
        window.localStorage.removeItem("pf-pending-topic");
      }
    } catch {
      /* 首页未预填时保持空白 */
    }
  }, []);

  useEffect(() => {
    if (phase !== "generating") return;
    if (isApiMode) return; // api 模式由 runPreview 完成后直接进入结果
    const done = stageIdx >= GENERATE_STAGES.length;
    const t = window.setTimeout(() => {
      if (done) setPhase("result");
      else setStageIdx((i) => i + 1);
    }, done ? 0 : 500);
    return () => clearTimeout(t);
  }, [phase, stageIdx]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setWeeksEnd(deadlineWeeks ? new Date(Date.now() + deadlineWeeks * 7 * 86400000) : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deadlineWeeks]);

  function buildGoal(): LearningGoalInput {
    return learningGoalSchema.parse({
      topic: topic.trim(),
      goal: goalText.trim(),
      currentLevel: currentLevel.trim() || "零基础",
      weeklyHours: weeklyHours ?? 5,
      deadlineWeeks: deadlineWeeks ?? 12,
      preferences: [],
    });
  }

  const canNext =
    step === 1
      ? topic.trim().length > 0
      : step === 2
        ? currentLevel.trim().length > 0
        : step === 3
          ? weeklyHours !== null
          : deadlineWeeks !== null;

  async function next() {
    if (!canNext) {
      pushToast("请先完成当前步骤", "warning");
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    setPhase("generating");
    setStageIdx(0);
    const goal = buildGoal();
    if (isApiMode) {
      try {
        const p: LearningPath = await previewPath(goal);
        setResult({ id: p.id, title: p.title, rationale: p.rationale, nodes: p.nodes });
        setPhase("result");
      } catch {
        pushToast("路径生成失败，请稍后重试", "error");
        setPhase("form");
      }
    } else {
      // demo：确定性本地编排，仅作演示展示；stage 动画结束后由 effect 切入 result
      const bundle = buildDemoTopicBundle(goal);
      setResult({ id: bundle.path.id, ...demoPlanOf(goal), nodes: bundle.path.nodes });
    }
  }

  async function handleConfirm() {
    if (demoState === "offline") {
      pushToast("当前离线演示，无法确认路径", "error");
      return;
    }
    setConfirming(true);
    setConfirmStage("creating");
    const goal = buildGoal();
    if (isApiMode) {
      try {
        const res = await confirmPath(goal, result?.id);
        if ("conflict" in res) {
          pushToast("路径创建发生并发冲突，请返回路径列表后重试", "warning");
          router.replace("/paths");
          return;
        }
        window.localStorage.setItem("pf-active-path", res.id);
        setConfirmStage("resources");
        try {
          const resources = await refreshPathResources(res.id);
          if (resources.provider === "mock") {
            pushToast("路径已创建；搜索服务未配置，资料仍待补充", "warning");
          } else {
            pushToast(
              `路径已创建，并为 ${resources.nodesWithResources} 个节点补充了真实资料`,
              "success",
            );
          }
        } catch {
          pushToast("路径已创建；资料检索暂时失败，可在节点页重新生成", "warning");
        }
        router.replace("/paths");
      } catch {
        pushToast("确认路径失败，请稍后重试", "error");
        setConfirming(false);
        setConfirmStage(null);
      }
      return;
    }
    // demo：保存当前路径和路径列表；再次创建不会覆盖已有路径。
    const bundle = buildDemoTopicBundle(goal);
    try {
      const rawPaths = window.localStorage.getItem("pf-demo-paths");
      let storedPaths: Array<typeof bundle> = [];
      if (rawPaths) {
        try {
          const parsed = JSON.parse(rawPaths) as unknown;
          storedPaths = Array.isArray(parsed) ? (parsed as Array<typeof bundle>) : [];
        } catch {
          storedPaths = [];
        }
      }
      const nextPaths = [...storedPaths.filter((item) => item.path.id !== bundle.path.id), bundle];
      window.localStorage.setItem("pf-demo-paths", JSON.stringify(nextPaths));
      window.localStorage.setItem("pf-active-path", bundle.path.id);
      window.localStorage.setItem(
        "pf-onboarded",
        JSON.stringify({
          version: 2,
          goal,
          generatedAt: bundle.generatedAt,
          title: bundle.title,
          bundle,
        }),
      );
    } catch {
      /* ignore storage failure */
    }
    setConfirming(false);
    pushToast("新学习路径已创建", "success");
    router.replace("/paths");
  }

  const steps = [
    { n: 1, label: "主题" },
    { n: 2, label: "基础" },
    { n: 3, label: "时间" },
    { n: 4, label: "期限" },
  ];

  const rationale = result?.rationale ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">创建你的学习路径</h1>
        <span className="flex items-center gap-2 text-xs text-ink-3">
          <DemoTag />
          <AiNote />
        </span>
      </div>

      {/* 步骤条 */}
      <div className="mb-8 flex items-center gap-1" aria-label="规划步骤">
        {steps.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center gap-1">
            <div
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium",
                s.n === step
                  ? "bg-ink text-white"
                  : s.n < step
                    ? "bg-subtle text-ink-2"
                    : "bg-surface text-ink-3 border border-line",
              )}
              aria-current={s.n === step ? "step" : undefined}
            >
              <span className="text-xs opacity-70">{s.n}</span>
              {s.label}
            </div>
            {i < steps.length - 1 ? <span className="h-px w-3 bg-line" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>

      {demoState === "offline" ? (
        <div className="mb-4">
          <OfflineState description="离线演示下可编辑本地草稿，但不能生成或确认路径。" />
        </div>
      ) : null}

      {/* 表单步骤 */}
      {phase === "form" ? (
        <Card className="p-5 md:p-6">
          {step === 1 ? (
            <div>
              <h2 className="text-lg font-semibold text-ink">你想学什么？</h2>
              <p className="mt-1 text-sm text-ink-2">
                输入你真正想学的主题。AI 会结合目标、基础、时间和期限，生成一条可解释的学习路径。
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="topic" className="text-sm font-medium text-ink">
                    学习主题
                  </label>
                  <input
                    id="topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="例如：Python 数据分析、日语口语、摄影、产品经理"
                    maxLength={120}
                    className="mt-1.5 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-ink-3">必填，最多 120 个字符。尽量使用具体、可理解的主题名称。</p>
                </div>
                <div>
                  <label htmlFor="goal" className="text-sm font-medium text-ink">
                    具体学习目标（可选）
                  </label>
                  <textarea
                    id="goal"
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    rows={2}
                    placeholder="例如：从零到能够独立完成一份数据分析报告"
                    maxLength={400}
                    className="mt-1.5 block w-full resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                  />
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-3">不知道从哪里开始？点击示例快速填入：</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLE_TOPICS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setTopic(item.label);
                      setGoalText(item.desc);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      topic === item.label
                        ? "border-ink bg-subtle text-ink"
                        : "border-line bg-surface text-ink-2 hover:border-ink-2",
                    )}
                    aria-pressed={topic === item.label}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-md bg-subtle/60 p-3 text-xs text-ink-2">
                产品经理是一个有完整教材骨架的推荐主题；其他主题由 AI 结合公开资料编排，并明确标注来源与不确定性。
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-lg font-semibold text-ink">你目前的水平？</h2>
              <p className="mt-1 text-sm text-ink-2">水平只影响起点，不会跳过任何核心技能。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {LEVEL_CHIPS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setCurrentLevel(lv)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      currentLevel === lv
                        ? "border-ink bg-subtle text-ink"
                        : "border-line bg-surface text-ink-2 hover:border-ink-2",
                    )}
                    aria-pressed={currentLevel === lv}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="level" className="text-sm font-medium text-ink">
                  也可以自己描述（选填）
                </label>
                <input
                  id="level"
                  type="text"
                  value={currentLevel}
                  onChange={(e) => setCurrentLevel(e.target.value)}
                  className="mt-1.5 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-lg font-semibold text-ink">你每周可以投入多少时间？</h2>
              <p className="mt-1 text-sm text-ink-2">选择后会据此预估每周学习任务量。</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {HOUR_CHIPS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      setWeeklyHours(h);
                      setCustomHours("");
                    }}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-md border px-3 py-2 text-center transition-colors",
                      weeklyHours === h && customHours === ""
                        ? "border-ink bg-subtle"
                        : "border-line bg-surface hover:border-ink-2",
                    )}
                    aria-pressed={weeklyHours === h}
                  >
                    <span className="text-base font-semibold text-ink">{h} 小时</span>
                    <span className="text-xs text-ink-3">每周</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="custom-hours" className="text-sm font-medium text-ink">
                  自定义小时数（1–80）
                </label>
                <input
                  id="custom-hours"
                  type="number"
                  min={1}
                  max={80}
                  value={customHours}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomHours(v);
                    const n = parseInt(v, 10);
                    if (n >= 1 && n <= 80) setWeeklyHours(n);
                  }}
                  className="mt-1.5 block w-40 rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              {weeklyHours !== null ? (
                <p className="mt-4 text-sm text-ink-2">已选：{hoursNote(weeklyHours)}。</p>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h2 className="text-lg font-semibold text-ink">你希望在多长时间内完成？</h2>
              <p className="mt-1 text-sm text-ink-2">期限会换算为预计完成日期。</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEK_CHIPS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setDeadlineWeeks(w);
                      setCustomWeeks("");
                    }}
                    className={cn(
                      "flex min-h-[64px] flex-col items-center justify-center rounded-md border px-3 py-2 text-center transition-colors",
                      deadlineWeeks === w && customWeeks === ""
                        ? "border-ink bg-subtle"
                        : "border-line bg-surface hover:border-ink-2",
                    )}
                    aria-pressed={deadlineWeeks === w}
                  >
                    <span className="text-base font-semibold text-ink">{w} 周</span>
                    <span className="text-xs text-ink-3">期限</span>
                  </button>
                ))}
              </div>
              <div className="mt-4">
                <label htmlFor="custom-weeks" className="text-sm font-medium text-ink">
                  自定义周数（1–208）
                </label>
                <input
                  id="custom-weeks"
                  type="number"
                  min={1}
                  max={208}
                  value={customWeeks}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomWeeks(v);
                    const n = parseInt(v, 10);
                    if (n >= 1 && n <= 208) setDeadlineWeeks(n);
                  }}
                  className="mt-1.5 block w-40 rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
              {deadlineWeeks !== null ? (
                <p className="mt-4 text-sm text-ink-2">已选：{weeksNote(deadlineWeeks)}。</p>
              ) : null}

              <Divider className="my-5" />

              <div className="rounded-md bg-subtle/60 p-4">
                <p className="text-sm font-medium text-ink">你的学习目标摘要</p>
                <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">主题</dt>
                    <dd className="font-medium text-ink">{topic || "未填"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">目标</dt>
                    <dd className="font-medium text-ink">{goalText || "（由 AI 理解）"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">水平</dt>
                    <dd className="font-medium text-ink">{currentLevel || "未填"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">每周投入</dt>
                    <dd className="font-medium text-ink">{weeklyHours ?? "未选"} 小时</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">期限</dt>
                    <dd className="font-medium text-ink">{deadlineWeeks ?? "未选"} 周</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={phase !== "form"}>
                上一步
              </Button>
            ) : (
              <span />
            )}
            {step < 4 ? (
              <Button onClick={next} disabled={!canNext || demoState === "offline"}>
                下一步
              </Button>
            ) : (
              <Button onClick={next} disabled={!canNext || demoState === "offline"}>
                生成路径方案
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      {/* 生成中 */}
      {phase === "generating" ? (
        <Card className="p-8">
          <div className="mx-auto max-w-md">
            <p className="text-center text-lg font-semibold text-ink">AI 编排中</p>
            <p className="mt-1 text-center text-sm text-ink-2">
              围绕「{topic || "你的主题"}」拆解知识、练习与周计划（{isApiMode ? "真实 API" : "演示模拟"}）。
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full rounded-full bg-ink transition-all duration-500"
                style={{ width: `${Math.round((stageIdx / GENERATE_STAGES.length) * 100)}%` }}
              />
            </div>
            <ol className="mt-6 space-y-2">
              {GENERATE_STAGES.map((s, i) => (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    i < stageIdx ? "text-ink" : i === stageIdx ? "text-ink font-medium" : "text-ink-3",
                  )}
                >
                  <span className="w-12 shrink-0 text-xs" aria-hidden="true">
                    {i < stageIdx ? "完成" : i === stageIdx ? "进行中" : "待处理"}
                  </span>
                  {s}
                  {i === stageIdx ? <AiNote className="ml-auto" /> : null}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : null}

      {/* 结果 */}
      {phase === "result" && result ? (
        <div className="space-y-4">
          <Card className="p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">你的建议学习路径</h2>
              <span className="flex items-center gap-2 text-xs text-ink-3">
                <DemoTag />
                <AiNote />
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-ink">{result.title}</p>
            <div className="mt-2">
              <Badge tone="info">
                {rationale?.skills?.length ?? 0} 个技能节点 · 可继续添加其他路径
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-2">{rationale?.rationale}</p>

            <Divider className="my-4" />

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">目标画像</dt>
                <dd className="text-right font-medium text-ink">{rationale?.goalProfile}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">每周投入</dt>
                <dd className="font-medium text-ink">{weeklyHours ?? 5} 小时</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">期限</dt>
                <dd className="font-medium text-ink">
                  {deadlineWeeks ?? 12} 周
                  {weeksEnd ? `（预计 ${formatDate(weeksEnd.toISOString())} 前后完成）` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-3">编排</dt>
                <dd className="font-medium text-ink">{rationale?.providerLabel}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 md:p-6">
            <SectionHeading
              title="路径依据与可信度"
              description="先查看真实检索依据，再决定是否采用这条路径。"
              actions={
                <Badge tone={rationale?.evidenceConfidence === "high" ? "success" : rationale?.evidenceConfidence === "medium" ? "warning" : "neutral"}>
                  {rationale?.evidenceConfidence === "high" ? "证据较充分" : rationale?.evidenceConfidence === "medium" ? "证据一般" : "证据不足"}
                </Badge>
              }
            />
            <div className="mt-3 rounded-md border border-line bg-subtle/45 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={rationale?.providerLabel?.includes("Mock") ? "warning" : "success"}>
                  编排：{rationale?.providerLabel || "未知"}
                </Badge>
                <Badge tone={rationale?.searchProviderLabel?.includes("Mock") || rationale?.searchProviderLabel?.includes("未配置") ? "warning" : "success"}>
                  检索：{rationale?.searchProviderLabel || "未知"}
                </Badge>
                <span className="text-ink-3">
                  {rationale?.nodesWithResources ?? 0}/{rationale?.searchedNodeCount ?? result.nodes.length} 个核心节点有候选资料
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                {rationale?.evidenceCoverageSummary || "尚未形成可核验的资料覆盖报告。"}
              </p>
            </div>

            {rationale?.searchQueries?.length ? (
              <details className="mt-3 rounded-md border border-line px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-ink">查看 Agent 扩展的检索词</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rationale.searchQueries.slice(0, 12).map((query) => (
                    <span key={query} className="rounded-full border border-line bg-subtle px-2.5 py-1 text-xs text-ink-2">
                      {query}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.nodes.slice(0, 6).map((node) => (
                <div key={node.id} className="rounded-md border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{node.title}</p>
                    <span className="shrink-0 text-xs text-ink-3">{node.resources.length} 条</span>
                  </div>
                  {node.resources.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {node.resources.slice(0, 3).map((resource) => (
                        <li key={resource.id} className="text-xs">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                          >
                            {resource.title}
                          </a>
                          <p className="mt-0.5 text-ink-3">
                            {resource.grade} 级 · {resource.domain} · 待可访问性核验
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-warning">未找到足够候选资料，建议调整节点或重新检索。</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-ink-3">
              候选资料来自实时公开搜索，A/B/C 为机器初筛，不代表人工认证；确认后系统会重新检索、去重并持久化。
            </p>
          </Card>

          {rationale?.weeks && rationale.weeks.length > 0 ? (
            <Card className="p-5 md:p-6">
              <SectionHeading title="按周计划" description="每阶段学习的技能，按认知顺序推进。" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {rationale.weeks.map((w) => (
                  <div key={w.week} className="rounded-md border border-line p-3">
                    <Badge tone="info">第 {w.week} 周</Badge>
                    <ul className="mt-2 space-y-1 text-sm text-ink-2">
                      {w.skills.map((s) => (
                        <li key={s}>· {s}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {rationale?.skills && rationale.skills.length > 0 ? (
            <Card className="p-5 md:p-6">
              <SectionHeading title="技能拆解" description="达成目标需要掌握的核心技能。" />
              <ul className="mt-3 divide-y divide-line">
                {rationale.skills.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{s.name}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{s.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setPhase("form")}>
              返回调整
            </Button>
            <div className="flex items-center gap-2">
              {demoState === "offline" ? (
                <span className="text-xs text-ink-3">离线演示下不能确认路径</span>
              ) : null}
              <Button onClick={handleConfirm} loading={confirming} disabled={demoState === "offline"}>
                {confirmStage === "resources" ? "正在检索并保存资料" : confirmStage === "creating" ? "正在创建路径" : "确认此路径"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}
