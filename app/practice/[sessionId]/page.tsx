"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { resolvePracticeSession, pathFor, PATH_PM, nodeById } from "@/lib/demo";
import { useAiChat } from "@/lib/hooks/use-ai";
import { cn, delay, mockFetch } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { useAsync } from "@/lib/api/hooks";
import { getPracticeSession, sendPracticeMessage, patchPracticeSession } from "@/lib/api/practice";
import { getNode } from "@/lib/api/curriculum";
import type { KnowledgeNode, PracticeMessage, PracticeSession } from "@/lib/types";
import type { AiChatMessage } from "@/lib/ai/types";
import { Badge, Button, Spinner, Textarea } from "@/components/ui";
import { ConfirmDialog } from "@/components/overlay";
import { AiNote, DemoTag, ErrorState, OfflineState } from "@/components/states";

const hm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const uid = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const SYNC_PILL: Record<PracticeSession["syncState"], { label: string; tone: "success" | "warning" }> = {
  saved: { label: "已保存", tone: "success" },
  local_only: { label: "仅本机·未同步", tone: "warning" },
  unsynced: { label: "待同步", tone: "warning" },
};

const MSG_STATUS: Record<
  PracticeMessage["status"],
  { label: string; tone: "neutral" | "info" | "warning" | "danger" }
> = {
  sent: { label: "已发送", tone: "neutral" },
  sending: { label: "发送中", tone: "info" },
  failed: { label: "发送失败", tone: "danger" },
  unsynced: { label: "未同步", tone: "warning" },
};

export default function PracticeConversationPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const aiChat = useAiChat();

  // api 模式：从后端加载真实会话；demo 模式：解析演示会话
  const { data: seedData, loading: seedLoading } = useAsync(
    () => getPracticeSession(sessionId),
    [sessionId],
    { enabled: isApiMode },
  );
  const demoSeed = useMemo(() => resolvePracticeSession(sessionId), [sessionId]);
  const seed = isApiMode ? (seedData?.session ?? null) : demoSeed;

  const { data: apiNode } = useAsync<KnowledgeNode | null>(
    async () => (isApiMode && seed?.nodeId ? getNode(seed.nodeId) : null),
    [seed?.nodeId],
  );
  const node = useMemo(() => {
    if (isApiMode) return apiNode ?? null;
    const path = pathFor(role) ?? PATH_PM;
    return seed && path ? nodeById(path, seed.nodeId) : null;
  }, [seed, role, apiNode]);

  const [messages, setMessages] = useState<PracticeMessage[]>(seed?.messages ?? []);
  const [currentRound, setCurrentRound] = useState(seed?.currentRound ?? 0);
  const [totalRounds, setTotalRounds] = useState(seed?.totalRounds ?? 5);
  const [syncState, setSyncState] = useState<PracticeSession["syncState"]>(seed?.syncState ?? "saved");
  const [input, setInput] = useState(seed?.draft ?? "");
  const [draftLabel, setDraftLabel] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const draftTimer = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 会话切换 / api 会话加载完成时，重置为对应会话（并从 localStorage 恢复草稿）
  useEffect(() => {
    if (!seed) return;
    setMessages(seed.messages);
    setCurrentRound(seed.currentRound);
    setTotalRounds(seed.totalRounds);
    setSyncState(seed.syncState);
    setInput(seed.draft ?? "");
    setDraftLabel(null);
    setAiThinking(false);
    setSending(false);
    setSyncInProgress(false);
    setErrorNotice(null);
    sendingRef.current = false;
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(`pf-draft-${sessionId}`);
      if (saved != null) setInput(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, seed]);

  // 卸载时清理防抖定时器
  useEffect(() => {
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, []);

  // 新消息 / AI 思考时自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, aiThinking]);

  const isCompleted = seed?.status === "completed";
  const hasUnsynced = messages.some((m) => m.status === "unsynced");
  const atMaxRounds = currentRound >= totalRounds && totalRounds > 0;
  // 轮次完成：当前轮达到上限，且最后一轮已收到 AI 追问（即最后一轮已完整闭环）
  const lastMessage = messages[messages.length - 1];
  const roundComplete = atMaxRounds && lastMessage?.role === "ai";

  function handleDraftChange(v: string) {
    setInput(v);
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`pf-draft-${sessionId}`, v);
      } catch {
        /* ignore */
      }
      setDraftLabel(hm(new Date()));
    }, 500);
  }

  function persistDraftNow() {
    try {
      window.localStorage.setItem(`pf-draft-${sessionId}`, input);
    } catch {
      /* ignore */
    }
  }

  function requestExit() {
    if (!isCompleted && (messages.length > 0 || input.trim().length > 0)) {
      setExitOpen(true);
    } else {
      router.push("/home");
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || sendingRef.current || atMaxRounds) return;
    if (content.length > 2000) {
      pushToast("讲解内容超过 2000 字，请精简后发送", "warning");
      return;
    }

    // api 模式：消息与 AI 追问都在服务端生成并持久化（真实链路：前端 → API → AI → 前端）
    if (isApiMode) {
      sendingRef.current = true;
      setSending(true);
      setAiThinking(true);
      setErrorNotice(null);
      try {
        const result = await sendPracticeMessage(sessionId, { content, clientId: uid() });
        setMessages((ms) => [...ms, result.userMessage, result.aiMessage]);
        setCurrentRound(result.aiMessage.turnIndex);
        setInput("");
        try {
          window.localStorage.removeItem(`pf-draft-${sessionId}`);
        } catch {
          /* ignore */
        }
      } catch {
        setErrorNotice("AI 暂不可用，这条消息没有发送成功。你可以重试发送，或稍后再来。");
      } finally {
        sendingRef.current = false;
        setSending(false);
        setAiThinking(false);
      }
      return;
    }

    const newRound = Math.min(currentRound + 1, totalRounds);
    const offline = demoState === "offline";
    const userMsg: PracticeMessage = {
      id: uid(),
      role: "user",
      content,
      turnIndex: newRound,
      createdAt: new Date().toISOString(),
      status: offline ? "unsynced" : "sending",
    };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setCurrentRound(newRound);
    setInput("");
    setErrorNotice(null);
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    try {
      window.localStorage.removeItem(`pf-draft-${sessionId}`);
    } catch {
      /* ignore */
    }

    // 离线：仅本地记录，不调用 AI，绝不伪造「已保存」
    if (offline) {
      setSyncState("local_only");
      setDraftLabel(null);
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setAiThinking(true);
    try {
      const [result] = await Promise.all([
        aiChat.send({
          mode: "feynman",
          context: { nodeTitle: node?.title, capabilityGoal: node?.capabilityGoal },
          messages: toAiMessages(nextMessages),
        }),
        delay(600),
      ]);
      setMessages((ms) => ms.map((m): PracticeMessage => (m.id === userMsg.id ? { ...m, status: "sent" } : m)));
      const aiMsg: PracticeMessage = {
        id: uid(),
        role: "ai",
        content: result.content,
        turnIndex: newRound,
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      setMessages((ms) => [...ms, aiMsg]);
    } catch {
      setMessages((ms) => ms.map((m) => (m.id === userMsg.id ? { ...m, status: "failed" } : m)));
      setErrorNotice("AI 暂不可用，这条消息没有发送成功。你可以重试发送，或稍后再来。");
    } finally {
      sendingRef.current = false;
      setSending(false);
      setAiThinking(false);
    }
  }

  async function retryMessage(msgId: string) {
    const failed = messages.find((m) => m.id === msgId);
    if (!failed || sendingRef.current) return;

    if (demoState === "offline") {
      setMessages((ms) => ms.map((m) => (m.id === msgId ? { ...m, status: "unsynced" } : m)));
      setSyncState("local_only");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setAiThinking(true);
    setErrorNotice(null);
    try {
      const idx = messages.findIndex((m) => m.id === msgId);
      const payload = messages.slice(0, idx + 1);
      const [result] = await Promise.all([
        aiChat.send({
          mode: "feynman",
          context: { nodeTitle: node?.title, capabilityGoal: node?.capabilityGoal },
          messages: toAiMessages(payload),
        }),
        delay(600),
      ]);
      setMessages((ms) => [
        ...ms.map((m): PracticeMessage => (m.id === msgId ? { ...m, status: "sent" } : m)),
        {
          id: uid(),
          role: "ai",
          content: result.content,
          turnIndex: failed.turnIndex,
          createdAt: new Date().toISOString(),
          status: "sent",
        },
      ]);
    } catch {
      setErrorNotice("AI 暂不可用，重试失败。请稍后再试。");
    } finally {
      sendingRef.current = false;
      setSending(false);
      setAiThinking(false);
    }
  }

  async function handleSync() {
    if (syncInProgress || demoState !== "normal") return;
    setSyncInProgress(true);
    if (isApiMode) {
      // api 模式：草稿同步到服务端
      try {
        await patchPracticeSession(sessionId, {
          draft: input,
          draftSavedAt: new Date().toISOString(),
          syncState: "saved",
        });
        persistDraftNow();
        setDraftLabel(hm(new Date()));
        setSyncState("saved");
        pushToast("已同步");
      } catch {
        setSyncState("local_only");
        pushToast("同步失败，请稍后重试", "error");
      } finally {
        setSyncInProgress(false);
      }
      return;
    }
    setSyncState("unsynced");
    try {
      await mockFetch(null, { latency: [700, 1100] });
      setMessages((ms) => ms.map((m): PracticeMessage => (m.status === "unsynced" ? { ...m, status: "sent" } : m)));
      persistDraftNow();
      setDraftLabel(hm(new Date()));
      setSyncState("saved");
      pushToast("已同步");
    } catch {
      setSyncState("local_only");
      pushToast("同步失败，请稍后重试", "error");
    } finally {
      setSyncInProgress(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendingRef.current && input.trim() && !atMaxRounds) void handleSend();
    }
  }

  if (isApiMode && seedLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <Spinner className="size-4" />
          正在加载会话…
        </div>
      </div>
    );
  }

  if (!seed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <ErrorState
          title="未找到该练习会话"
          description="会话可能已被删除，或链接地址有误。"
          backTo="/home"
          backLabel="返回首页"
        />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <div className="text-4xl" aria-hidden="true">
          ✓
        </div>
        <p className="text-base font-medium text-ink">本次练习已完成</p>
        <p className="max-w-sm text-sm text-ink-2">
          你已完成 {seed.currentRound} 轮费曼讲解，评价与可编辑笔记已生成。
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.push(`/practice/${sessionId}/result`)}>查看评价</Button>
          <Button variant="ghost" onClick={() => router.push("/home")}>
            返回首页
          </Button>
        </div>
        <AiNote />
      </div>
    );
  }

  const pill = SYNC_PILL[syncState];
  const canSync = demoState === "normal" && syncState !== "saved" && !roundComplete;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 md:px-4">
        <button
          type="button"
          onClick={requestExit}
          aria-label="退出练习"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-ink-2"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ←
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{node?.title ?? seed.nodeId}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-ink-2">
          第 {currentRound} / {totalRounds} 轮
        </span>
        <Badge tone={pill.tone} className="shrink-0">
          {pill.label}
        </Badge>
        <DemoTag className="hidden sm:inline-flex" />
      </header>

      {/* 对话区 */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto pf-scroll-thin">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {demoState === "offline" ? (
            <div className="mb-4">
              <OfflineState description="未保存为已同步，恢复联网后可同步。" />
            </div>
          ) : null}
          {errorNotice ? (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-2 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              <span>{errorNotice}</span>
              <button
                type="button"
                onClick={() => setErrorNotice(null)}
                aria-label="关闭提示"
                className="shrink-0 text-danger hover:text-danger/70"
              >
                ×
              </button>
            </div>
          ) : null}
          <ol className="space-y-5">
            {messages.map((m) => (
              <MessageItem key={m.id} m={m} onRetry={() => retryMessage(m.id)} />
            ))}
            {aiThinking ? (
              <li className="flex items-start gap-2" aria-live="polite">
                <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-2">
                  <Spinner className="size-4" />
                  <span>AI 思考中…</span>
                </div>
              </li>
            ) : null}
          </ol>
        </div>
      </main>

      {/* 输入区 / 轮次完成 CTA */}
      <footer className="shrink-0 border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {atMaxRounds ? (
            roundComplete ? (
              <div className="flex flex-col items-center gap-2 py-1 text-center">
                <p className="text-sm text-ink-2">
                  已完成 {totalRounds} 轮讲解，可以生成学习反馈了。
                </p>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => router.push(`/practice/${sessionId}/result`)}
                >
                  进入评价
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-1 text-center">
                <p className="text-sm text-ink-2">
                  {demoState === "offline"
                    ? "离线中，最后一条讲解尚未同步，恢复联网后可生成评价。"
                    : "本轮讲解已发出，AI 正在整理最后的追问…"}
                </p>
              </div>
            )
          ) : (
            <>
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的讲解… Enter 发送 · Shift+Enter 换行"
                  rows={2}
                  maxLength={2000}
                  className="resize-none"
                  aria-label="你的讲解"
                />
                <Button
                  onClick={handleSend}
                  loading={sending}
                  disabled={!input.trim() || input.length > 2000 || sending}
                >
                  发送
                </Button>
              </div>
              <div className="mt-1.5 flex min-h-5 flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">
                  {draftLabel
                    ? demoState === "offline"
                      ? `草稿已存本机 ${draftLabel}`
                      : `草稿已自动保存 ${draftLabel}`
                    : demoState === "offline"
                      ? "离线中，草稿仅保存在本机"
                      : "输入内容将自动保存到本机"}
                </p>
                {canSync ? (
                  <Button variant="secondary" loading={syncInProgress} onClick={handleSync}>
                    {hasUnsynced ? "同步消息与草稿" : "同步草稿"}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </footer>

      <ConfirmDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={() => {
          persistDraftNow();
          if (isApiMode) {
            // 退出前尽力把草稿同步到服务端，失败不阻塞离开
            void patchPracticeSession(sessionId, {
              draft: input,
              draftSavedAt: new Date().toISOString(),
              syncState: "saved",
            }).catch(() => {});
          }
          setExitOpen(false);
          router.push("/home");
        }}
        title="退出练习？"
        description="你的进度已保存为草稿，可随时回来继续。"
        confirmLabel="退出"
      />
    </div>
  );
}

function toAiMessages(msgs: PracticeMessage[]): AiChatMessage[] {
  return msgs.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
}

function MessageItem({ m, onRetry }: { m: PracticeMessage; onRetry: () => void }) {
  const isAi = m.role === "ai";
  const status = MSG_STATUS[m.status];
  return (
    <li className={isAi ? "flex justify-start" : "flex justify-end"}>
      <div className={cn("max-w-[86%] md:max-w-[75%]", isAi ? "mr-auto" : "ml-auto")}>
        {isAi ? (
          <p className="mb-1 text-xs text-ink-3">
            <AiNote />
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isAi ? "border border-line bg-surface text-ink" : "bg-action text-white",
          )}
        >
          <p className="whitespace-pre-wrap break-words">
            {isAi ? m.content.replace(/^AI 整理（演示）｜/, "") : m.content}
          </p>
        </div>
        {!isAi ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {m.status === "failed" ? (
              <button
                type="button"
                onClick={onRetry}
                className="flex min-h-[44px] items-center px-1 text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
              >
                重试发送
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
