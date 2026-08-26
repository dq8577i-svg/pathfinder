"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { resolvePracticeSession, pathFor, PATH_PM, nodeById, NOTES, PRACTICE_FEEDBACK_DONE } from "@/lib/demo";
import { cn, mockFetch } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { useAsync } from "@/lib/api/hooks";
import { getPracticeSession, evaluatePracticeSession } from "@/lib/api/practice";
import { getNode } from "@/lib/api/curriculum";
import { listNotes, createNote, updateNote } from "@/lib/api/notes";
import type { FeynmanNote, KnowledgeNode, PracticeFeedback, PracticeMessage } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, Input, Textarea } from "@/components/ui";
import { Drawer } from "@/components/overlay";
import { AiNote, DemoTag, ErrorState } from "@/components/states";

const LEVEL_LABEL: Record<number, string> = {
  1: "不足",
  2: "待加强",
  3: "基本",
  4: "较充分",
  5: "充分",
};

const SOURCE_LABEL: Record<FeynmanNote["sourceTag"], string> = {
  ai_draft: "AI 草稿",
  user_edit: "你的编辑",
  mixed: "混合",
};

export default function PracticeResultPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const pushToast = useAppStore((s) => s.pushToast);

  // api 模式：真实会话详情（含评价）；demo 模式：解析演示会话
  const { data: detail, loading: detailLoading } = useAsync(
    () => getPracticeSession(sessionId),
    [sessionId],
    { enabled: isApiMode },
  );
  const demoSession = useMemo(() => resolvePracticeSession(sessionId), [sessionId]);
  const session = isApiMode ? (detail?.session ?? null) : demoSession;

  const { data: apiNode } = useAsync<KnowledgeNode | null>(
    async () => (isApiMode && session?.nodeId ? getNode(session.nodeId) : null),
    [session?.nodeId],
  );
  const node = useMemo(() => {
    if (isApiMode) return apiNode ?? null;
    const path = pathFor(role) ?? PATH_PM;
    return session && path ? nodeById(path, session.nodeId) : null;
  }, [session, role, apiNode]);

  const demoFeedback: PracticeFeedback | null = session?.status === "completed" ? PRACTICE_FEEDBACK_DONE : null;
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  const [note, setNote] = useState<FeynmanNote | null>(null);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // demo 数据中 generatedAt 在模块加载时生成，SSR 与客户端首帧取值可能不同；
  // 挂载后再渲染时间，避免水合不匹配。
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // api 模式：会话已完成轮次但尚无评价 → 幂等触发评价并生成反馈
  useEffect(() => {
    if (!isApiMode || !session) return;
    if (detail?.feedback) {
      setFeedback(detail.feedback);
      return;
    }
    if (session.status === "completed" || session.currentRound >= session.totalRounds) {
      setEvalLoading(true);
      evaluatePracticeSession(sessionId)
        .then((r) => setFeedback(r.feedback))
        .catch(() => setFeedback(null))
        .finally(() => setEvalLoading(false));
    }
  }, [isApiMode, session, detail, sessionId]);

  // demo 模式：本地已保存的笔记优先（key: pf-note-<sessionId>）
  const { data: notesData } = useAsync(
    () => (isApiMode ? listNotes() : Promise.resolve<FeynmanNote[]>([])),
    [],
  );
  useEffect(() => {
    if (isApiMode) return;
    const base = NOTES.find((n) => n.sessionId === sessionId);
    if (base) setNote({ ...base });
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`pf-note-${sessionId}`);
    if (saved) {
      try {
        setNote(JSON.parse(saved) as FeynmanNote);
      } catch {
        /* ignore */
      }
    }
  }, [sessionId]);

  // api 模式：已有笔记优先，否则空白模板（保存时创建真实笔记）
  useEffect(() => {
    if (!isApiMode || !notesData) return;
    const found = notesData.find((n) => n.sessionId === sessionId) ?? null;
    if (found) {
      setNote(found);
      return;
    }
    setNote({
      id: "",
      sessionId,
      nodeId: session?.nodeId ?? "",
      title: `${node?.title ?? "费曼练习"} · 笔记`,
      content: "",
      keyTerms: [],
      pendingQuestions: [],
      selfAssessed: false,
      updatedAt: new Date().toISOString(),
      statusFilter: "all",
      sourceTag: "ai_draft",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiMode, notesData, sessionId, session?.nodeId, node?.title]);

  if (isApiMode && detailLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-2">
        正在加载评价…
      </div>
    );
  }

  if (!session) {
    return (
      <ErrorState
        title="未找到该练习会话"
        description="会话可能已被删除，或链接地址有误。"
        backTo="/home"
        backLabel="返回首页"
      />
    );
  }

  // api 模式：轮次未完 → 尚未完成；demo 模式：非 completed → 尚未完成
  const canEvaluate =
    isApiMode && session.status !== "completed" && session.currentRound >= session.totalRounds;
  if (session.status !== "completed" && !canEvaluate) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-medium text-ink">练习尚未完成</p>
        <p className="max-w-sm text-sm text-ink-2">
          完成全部轮次后，这里会生成你的评价与可编辑笔记。
        </p>
        <Button onClick={() => router.push(`/practice/${sessionId}`)}>回到练习</Button>
      </div>
    );
  }

  const resolvedFeedback = isApiMode ? feedback : demoFeedback;
  if (!resolvedFeedback) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        {evalLoading ? (
          <p className="text-sm text-ink-2">正在生成评价…</p>
        ) : (
          <>
            <p className="text-base font-medium text-ink">评价生成失败</p>
            <p className="max-w-sm text-sm text-ink-2">AI 暂时不可用，你可以稍后重试。</p>
            <Button onClick={() => router.push(`/practice/${sessionId}`)}>回到练习</Button>
          </>
        )}
      </div>
    );
  }

  function persistNote(n: FeynmanNote) {
    try {
      window.localStorage.setItem(`pf-note-${n.id}`, JSON.stringify(n));
      window.localStorage.setItem(`pf-note-${n.sessionId}`, JSON.stringify(n));
    } catch {
      /* ignore */
    }
  }

  async function handleSaveNote() {
    if (!note || saving) return;
    if (isApiMode && !note.content.trim()) {
      pushToast("请输入笔记内容后再保存", "warning");
      return;
    }
    setSaving(true);
    try {
      if (isApiMode) {
        const sourceTag = note.sourceTag === "ai_draft" ? "mixed" : note.sourceTag;
        const payload = {
          title: note.title.trim() || "费曼练习笔记",
          content: note.content,
          keyTerms: note.keyTerms ?? [],
          pendingQuestions: note.pendingQuestions ?? [],
          selfAssessed: true,
          sourceTag,
          statusFilter: note.statusFilter,
        };
        const saved = note.id
          ? await updateNote(note.id, payload)
          : await createNote({ ...payload, sessionId, nodeId: session?.nodeId });
        setNote(saved);
      } else {
        await mockFetch(null, { latency: [400, 700] });
        const updated: FeynmanNote = {
          ...note,
          selfAssessed: true,
          sourceTag: note.sourceTag === "ai_draft" ? "mixed" : note.sourceTag,
          updatedAt: new Date().toISOString(),
        };
        setNote(updated);
        persistNote(updated);
      }
      pushToast("笔记已保存");
    } catch {
      pushToast("保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 顶部：节点标题 + 会话摘要 */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">费曼练习评价</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
            {node?.title ?? session.nodeId}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">共 {session.currentRound} / {session.totalRounds} 轮</Badge>
            <Badge tone="neutral">基于 {resolvedFeedback.evidenceRounds} 轮讲解</Badge>
            <Badge tone="neutral">{resolvedFeedback.providerLabel}</Badge>
            <DemoTag />
          </div>
        </div>
        <Button variant="secondary" onClick={() => router.push("/home")}>
          返回首页
        </Button>
      </header>

      <p className="flex items-center gap-2 text-xs text-ink-3">
        <AiNote /> 以下判定为学习建议，不是能力认证。
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左：三大判定 + 维度 + 置信提示 */}
        <section className="space-y-4">
          <VerdictCard title="这次你已经讲清" icon="✓" items={resolvedFeedback.clear} tone="success" />
          <VerdictCard title="仍待补充" icon="△" items={resolvedFeedback.toAdd} tone="warning" />
          <VerdictCard title="尚未覆盖" icon="○" items={resolvedFeedback.notCovered} tone="danger" />

          <div className="grid gap-3 sm:grid-cols-3">
            {(["completeness", "accuracy", "clarity"] as const).map((key) => {
              const d = resolvedFeedback.dimensions[key];
              return (
                <Card key={key} className="p-4">
                  <p className="text-sm font-medium text-ink">{d.label}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-2">{LEVEL_LABEL[d.level]}</p>
                  <p className="mt-0.5 text-xs text-ink-3">{d.level} / 5</p>
                  <p className="mt-2 text-xs text-ink-2">{d.note}</p>
                </Card>
              );
            })}
          </div>

          <Card className="p-4">
            <p className="text-xs font-medium text-ink-2">依据与置信提示</p>
            <p className="mt-1 text-sm text-ink">{resolvedFeedback.confidenceNotice}</p>
            <p className="mt-2 text-xs text-ink-3">
              依据模型：{resolvedFeedback.providerLabel} · 提示词版本：{resolvedFeedback.promptVersion} · 生成于{" "}
              {mounted ? formatDateTime(resolvedFeedback.generatedAt) : "——"}
            </p>
          </Card>
        </section>

        {/* 右：费曼笔记 + 下一步 */}
        <section className="space-y-4">
          {note ? (
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">费曼笔记（可编辑）</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={note.sourceTag === "ai_draft" ? "neutral" : "info"}>
                    {SOURCE_LABEL[note.sourceTag]}
                  </Badge>
                  {note.selfAssessed ? (
                    <Badge tone="success">已自查</Badge>
                  ) : (
                    <Badge tone="warning">待补充</Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={note.title}
                  onChange={(e) => setNote({ ...note, title: e.target.value })}
                  aria-label="笔记标题"
                />
                <Textarea
                  value={note.content}
                  onChange={(e) => setNote({ ...note, content: e.target.value })}
                  rows={8}
                  aria-label="笔记正文"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={handleSaveNote} loading={saving}>
                  保存笔记
                </Button>
                <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                  查看原对话
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                <AiNote /> 初始内容由练习整理，你的编辑会保留来源标记。
              </p>
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="text-base font-semibold text-ink">下一步</h2>
            <ol className="mt-3 space-y-2">
              {resolvedFeedback.nextStep.map((step, i) => (
                <li key={`${step.type}-${step.label}-${i}`}>
                  <ButtonLink
                    href={stepHref(step, sessionId)}
                    variant="secondary"
                    className="w-full justify-start text-left"
                  >
                    <span className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-subtle text-xs text-ink-2">
                      {i + 1}
                    </span>
                    {step.label}
                  </ButtonLink>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>

      {/* 原始对话抽屉 */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="原始对话" width="w-96">
        <div className="space-y-4 p-4">
          {session.messages.map((m) => (
            <ConversationLine key={m.id} m={m} />
          ))}
        </div>
      </Drawer>
    </div>
  );
}

function stepHref(step: PracticeFeedback["nextStep"][number], sessionId: string): string {
  if (step.type === "node" && step.nodeId) return `/path/nodes/${step.nodeId}`;
  if (step.type === "practice") return `/practice/${sessionId}`;
  if (step.type === "review") return "/review";
  return "/home";
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function VerdictCard({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: string;
  items: string[];
  tone: "success" | "warning" | "danger";
}) {
  const toneText = { success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
            <span className={cn("mt-0.5 shrink-0", toneText)} aria-hidden="true">
              {icon}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConversationLine({ m }: { m: PracticeMessage }) {
  const isAi = m.role === "ai";
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-3">{isAi ? <AiNote /> : "你"}</p>
      <p className="whitespace-pre-wrap break-words rounded-md border border-line bg-subtle px-3 py-2 text-sm text-ink">
        {isAi ? m.content.replace(/^AI 整理（演示）｜/, "") : m.content}
      </p>
    </div>
  );
}
