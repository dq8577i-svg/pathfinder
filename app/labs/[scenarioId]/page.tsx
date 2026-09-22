"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { FeatureGate } from "@/components/guards";
import { PageHeader } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, Divider, ProgressBar, Spinner, Textarea } from "@/components/ui";
import { AiNote, DemoTag, ErrorState, OfflineState } from "@/components/states";
import { SCENARIOS, SCENARIO_SESSION_ACTIVE, SCENARIO_SESSION_DONE, SCENARIO_REPORT } from "@/lib/demo";
import type { PracticeMessage, Scenario, ScenarioReport } from "@/lib/types";
import { useAiChat } from "@/lib/hooks/use-ai";
import { isApiMode } from "@/lib/data-source";
import { cn, formatMinutes, mockFetch, throwByState } from "@/lib/utils";
import type { AiChatMessage } from "@/lib/ai/types";
import { ScenarioApiView } from "./api-view";

type RubricScores = { clarity: number; evidence: number; boundary: number };

interface SessionState {
  messages: PracticeMessage[];
  round: number;
  maxRounds: number;
  status: "in_progress" | "completed";
  report: ScenarioReport | null;
  rubricScores: RubricScores | null;
}

const ROLE_TONE: Record<Scenario["personaRole"], "warning" | "info" | "neutral" | "danger" | "success"> = {
  业务方: "warning",
  研发: "info",
  用户: "neutral",
  主管: "danger",
  设计: "success",
};

const DIFF_TONE: Record<Scenario["difficulty"], "neutral" | "warning" | "danger"> = {
  初级: "neutral",
  中级: "warning",
  高级: "danger",
};

function buildInitial(scenario: Scenario): SessionState {
  if (SCENARIO_SESSION_DONE.scenarioId === scenario.id) {
    const s = SCENARIO_SESSION_DONE;
    return {
      messages: s.messages,
      round: s.round,
      maxRounds: s.maxRounds,
      status: "completed",
      report: s.report ?? SCENARIO_REPORT,
      rubricScores: s.rubricScores ?? null,
    };
  }
  if (SCENARIO_SESSION_ACTIVE.scenarioId === scenario.id) {
    const s = SCENARIO_SESSION_ACTIVE;
    return {
      messages: s.messages,
      round: s.round,
      maxRounds: s.maxRounds,
      status: "in_progress",
      report: null,
      rubricScores: null,
    };
  }
  const opening: PracticeMessage = {
    id: `${scenario.id}-opening`,
    role: "ai",
    content: scenario.openingLine,
    turnIndex: 1,
    createdAt: new Date().toISOString(),
    status: "sent",
  };
  return {
    messages: [opening],
    round: 1,
    maxRounds: 8,
    status: "in_progress",
    report: null,
    rubricScores: null,
  };
}

export default function ScenarioPage() {
  return isApiMode ? <ScenarioApiView /> : <DemoScenarioPage />;
}

function DemoScenarioPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) ?? null, [scenarioId]);

  return (
    <FeatureGate flag="scenario_labs">
      {scenario ? (
        <ScenarioBody key={scenario.id} scenario={scenario} />
      ) : (
        <ErrorState title="未找到该情境" description="该练习场景不存在或已下架。" backTo="/labs" backLabel="返回练习场" />
      )}
    </FeatureGate>
  );
}

function ScenarioBody({ scenario }: { scenario: Scenario }) {
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const ai = useAiChat();

  const [session, setSession] = useState<SessionState>(() => buildInitial(scenario));
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedMsgId, setFailedMsgId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.messages.length, ai.loading]);

  const completed = session.status === "completed";
  const maxReached = session.round >= session.maxRounds;

  async function sendContent(text: string, retryId?: string) {
    const trimmed = text.trim();
    if (!trimmed || ai.loading || completed) return;
    const msgId = retryId ?? `m-${Date.now()}`;
    const userMsg: PracticeMessage = {
      id: msgId,
      role: "user",
      content: trimmed,
      turnIndex: session.round,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    setInput("");
    setSendError(null);
    setFailedMsgId(null);
    setSession((s) => ({
      ...s,
      messages: retryId
        ? s.messages.map((m) => (m.id === retryId ? { ...m, status: "sent" as const } : m))
        : [...s.messages, userMsg],
    }));

    const history: AiChatMessage[] = session.messages
      .filter((m) => m.id !== retryId || m.status !== "failed")
      .map<AiChatMessage>((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))
      .concat([{ role: "user", content: trimmed }]);

    try {
      throwByState(demoState);
      const res = await ai.send({
        mode: "chat",
        context: { scenarioTitle: scenario.title, nodeTitle: scenario.title },
        messages: history,
      });
      const aiMsg: PracticeMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        content: res.content,
        turnIndex: session.round + 1,
        createdAt: res.generatedAt,
        status: "sent",
      };
      setSession((s) => ({ ...s, messages: [...s.messages, aiMsg], round: s.round + 1 }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "request_failed";
      setSendError(msg);
      setFailedMsgId(msgId);
      setSession((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === msgId ? { ...m, status: "failed" as const } : m)),
      }));
    }
  }

  function handleSend() {
    void sendContent(input);
  }

  function retryFailed() {
    if (!failedMsgId) return;
    const failed = session.messages.find((m) => m.id === failedMsgId);
    if (!failed) return;
    void sendContent(failed.content, failedMsgId);
  }

  async function handleEnd() {
    if (ending || completed) return;
    setEnding(true);
    try {
      throwByState(demoState);
      await mockFetch(null, { latency: [500, 900] });
      setSession((s) => ({
        ...s,
        status: "completed",
        report: SCENARIO_REPORT,
        rubricScores: { clarity: 4, evidence: 3, boundary: 4 },
      }));
      pushToast("复盘已生成（演示）", "success");
    } catch {
      pushToast("复盘生成失败：请稍后重试", "error");
    } finally {
      setEnding(false);
    }
  }

  return (
    <>
      <PageHeader
        title={scenario.title}
        description={scenario.summary}
        meta={
          <>
            <Badge tone={ROLE_TONE[scenario.personaRole]}>{scenario.personaRole}</Badge>
            <Badge tone={DIFF_TONE[scenario.difficulty]}>{scenario.difficulty}</Badge>
            <Badge tone="neutral">{formatMinutes(scenario.estimatedMinutes)}</Badge>
            <DemoTag />
          </>
        }
      />

      <Link href="/labs" className="inline-flex h-11 items-center gap-1 text-sm text-ink-2 hover:text-ink">
        ← 返回练习场
      </Link>

      {demoState === "offline" ? (
        <div className="mt-4">
          <OfflineState description="当前为离线演示状态，发送的内容不会保存到云端。" />
        </div>
      ) : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ScenarioSidebar scenario={scenario} />
        </aside>

        <section className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">角色扮演对话</span>
                <AiNote />
              </div>
              <Badge tone={completed ? "success" : "info"}>
                {completed ? "已完成" : `第 ${session.round} / ${session.maxRounds} 轮`}
              </Badge>
            </div>
            <ProgressBar value={session.round} max={session.maxRounds} label={`${session.round}/${session.maxRounds} 轮`} className="mt-3" />

            <div className="pf-scroll-thin mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {session.messages.map((m) => (
                <MessageRow key={m.id} message={m} persona={scenario.persona} personaRole={scenario.personaRole} />
              ))}
              {ai.loading ? (
                <div className="flex items-center gap-2 text-sm text-ink-2">
                  <Spinner className="size-4" />
                  {scenario.persona} 正在组织回答…
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            {sendError ? (
              <div role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
                <p className="font-medium">消息发送失败，未同步保存</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="dangerGhost" onClick={retryFailed}>
                    重试
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSendError(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : null}

            {!completed ? (
              <div className="mt-4 border-t border-line pt-4">
                {maxReached ? (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
                    <span aria-hidden="true">!</span>
                    <span>已达建议轮次上限，你已覆盖核心信息，可以结束并生成复盘。</span>
                  </div>
                ) : null}
                <label htmlFor="scenario-input" className="block text-sm font-medium text-ink">
                  你的回应
                </label>
                <Textarea
                  id="scenario-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`向${scenario.persona}解释你的判断…`}
                  className="mt-2 min-h-[96px]"
                  disabled={ai.loading || ending}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink-3">Enter 发送 · Shift+Enter 换行。请勿输入真实客户机密。</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleEnd} disabled={ai.loading || ending} loading={ending}>
                      结束并查看报告
                    </Button>
                    <Button onClick={handleSend} disabled={!input.trim() || ai.loading || ending} loading={ai.loading}>
                      发送
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm text-ink-2">本次对话已结束。如需再次练习，请返回练习场重新开始。</p>
              </div>
            )}
          </Card>

          {completed && session.report ? (
            <ReportCard report={session.report} rubricScores={session.rubricScores} />
          ) : null}
        </section>
      </div>
    </>
  );
}

function MessageRow({
  message,
  persona,
  personaRole,
}: {
  message: PracticeMessage;
  persona: string;
  personaRole: Scenario["personaRole"];
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          isUser ? "bg-ink text-white" : "bg-subtle text-ink-2",
        )}
        aria-hidden="true"
      >
        {isUser ? "我" : persona.slice(0, 1)}
      </div>
      <div className={cn("max-w-[85%] rounded-md border border-line px-3 py-2", isUser ? "bg-surface" : "bg-subtle")}>
        <div className="text-xs text-ink-3">{isUser ? "你" : `${persona} · ${personaRole}`}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{message.content}</p>
        {message.status === "failed" ? <p className="mt-1 text-xs text-danger">发送失败，未同步</p> : null}
      </div>
    </div>
  );
}

function ScenarioSidebar({ scenario }: { scenario: Scenario }) {
  return (
    <>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink">你的任务</h2>
        <p className="mt-1 text-sm text-ink-2">{scenario.task}</p>
        <Divider className="my-4" />
        <h2 className="text-sm font-semibold text-ink">练习目标</h2>
        <p className="mt-1 text-sm text-ink-2">{scenario.goal}</p>
        <Divider className="my-4" />
        <h2 className="text-sm font-semibold text-ink">完成条件</h2>
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-ink-2">
          {scenario.completionCriteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Divider className="my-4" />
        <h2 className="text-sm font-semibold text-ink">AI 扮演</h2>
        <p className="mt-1 text-sm text-ink-2">
          {scenario.persona}（{scenario.personaRole}）。AI 仅按模板事实回答，不知道时会说明「该信息未提供」。
        </p>
      </Card>

      {scenario.auxiliaryDocs.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">辅助资料</h2>
          <div className="mt-3 space-y-3">
            {scenario.auxiliaryDocs.map((doc) => (
              <div key={doc.label} className="rounded-md border border-line bg-subtle p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{doc.label}</span>
                  {doc.isFictional ? <Badge tone="warning">演示虚构资料</Badge> : <Badge tone="info">脱敏资料</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-2">{doc.content}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <p className="px-1 text-xs text-ink-3">
        <AiNote /> 本次练习为教学模拟，数据为虚构或脱敏案例。
      </p>
    </>
  );
}

function ReportCard({ report, rubricScores }: { report: ScenarioReport; rubricScores: RubricScores | null }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">复盘报告</h2>
        <Badge tone="success">已完成</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-3">
        <AiNote /> {report.providerLabel} · 基于本次模拟对话与场景 Rubric 生成，为学习建议，不是能力认证。
      </p>

      {rubricScores ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <RubricCell label="清晰度" value={rubricScores.clarity} />
          <RubricCell label="证据" value={rubricScores.evidence} />
          <RubricCell label="边界" value={rubricScores.boundary} />
        </div>
      ) : null}

      <Divider className="my-5" />

      <h3 className="text-sm font-semibold text-ink">已体现</h3>
      <ul className="mt-2 space-y-2">
        {report.achieved.map((a) => (
          <li key={a.claim} className="flex items-start gap-2 text-sm text-ink">
            <span className="mt-0.5 shrink-0 text-xs font-medium text-success">达成</span>
            <span>{a.claim}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold text-ink">待深挖</h3>
      <ul className="mt-2 space-y-2">
        {report.toProbe.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-ink-2">
            <span className="mt-0.5 shrink-0 text-warning">?</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold text-ink">下一步</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {report.nextActions.map((a) => (
          <ButtonLink key={a.label} href={a.href} variant={a.type === "node" ? "primary" : "secondary"} size="sm">
            {a.label}
          </ButtonLink>
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-3">{report.confidenceNote}</p>
    </Card>
  );
}

function RubricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-subtle p-3 text-center">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">
        {value} / 5
      </div>
      <div className="mt-2 flex gap-0.5" role="img" aria-label={`${label} ${value} 分（满分 5 分）`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= value ? "bg-action" : "bg-line")} />
        ))}
      </div>
    </div>
  );
}
