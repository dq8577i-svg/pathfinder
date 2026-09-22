"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { AiNote, EmptyState, LoadingState } from "@/components/states";
import { useAppStore } from "@/lib/store";
import type { ScenarioDto } from "@/lib/api/labs";
import { getScenario, replyInScenario } from "@/lib/api/labs";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

/** 情境练习详情（api 模式）：真实场景 + 与 AI 角色的单轮对话 */
export function ScenarioApiView() {
  const params = useParams<{ scenarioId: string }>();
  const scenarioId = params?.scenarioId ?? "";
  const pushToast = useAppStore((s) => s.pushToast);

  const [scenario, setScenario] = useState<ScenarioDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setNotFound(false);
      }
    }, 0);
    getScenario(scenarioId)
      .then((s) => {
        if (cancelled) return;
        setScenario(s);
        setMessages([
          {
            role: "assistant",
            content: `我是${s.aiRole}。场景：${s.situation}。请用${s.task}开始你的表现。`,
          },
        ]);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [scenarioId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setStarted(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const { reply } = await replyInScenario(scenarioId, text);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "回复失败，请重试", "error");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState label="正在加载场景…" />;
  if (notFound || !scenario) {
    return (
      <EmptyState
        title="没有找到该场景"
        description="它可能已被删除，或不属于当前用户。"
        action={{ label: "返回练习场", href: "/labs" }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={scenario.sourceType === "ai" ? "info" : "neutral"}>
            {scenario.sourceType === "ai" ? "AI 生成" : "模板"}
          </Badge>
          <span className="text-xs text-ink-3">来源节点：{scenario.nodeTitle || "未关联"}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold text-ink">{scenario.title}</h1>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-ink">情境</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-2">{scenario.situation}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">你的任务</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-2">{scenario.task}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">AI 角色</dt>
            <dd className="mt-0.5 text-ink-2">{scenario.aiRole}</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">评分标准</dt>
            <dd className="mt-0.5 whitespace-pre-line leading-relaxed text-ink-2">{scenario.rubric}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <span className="text-sm font-medium text-ink">与 {scenario.aiRole} 对话</span>
          <AiNote>按任务行动，完成一次实战表现。</AiNote>
        </div>

        <div className="flex max-h-[60vh] min-h-[260px] flex-col gap-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-md border px-3 py-2 text-sm leading-relaxed ${
                m.role === "assistant"
                  ? "self-start border-line bg-subtle text-ink"
                  : "self-end border-line bg-ink text-surface"
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending ? (
            <div className="self-start rounded-md border border-line bg-subtle px-3 py-2 text-sm text-ink-3">
              正在思考…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-line p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="说点什么，向角色展示你的能力…"
            aria-label="对话输入"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
          />
          <Button type="submit" size="sm" loading={sending} disabled={!input.trim()}>
            发送
          </Button>
        </form>
      </Card>

      {started ? (
        <p className="mt-3 text-center text-xs text-ink-3">
          可对照上方评分标准自我评估；本轮对话结果不会生成官方成绩。
        </p>
      ) : null}
    </div>
  );
}
