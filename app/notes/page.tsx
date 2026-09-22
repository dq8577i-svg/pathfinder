"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { NOTES, PATH_PM, nodeById } from "@/lib/demo";
import { mockFetch, relativeTime } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listNotes, updateNote } from "@/lib/api/notes";
import { listPaths, getPath } from "@/lib/api/paths";
import type { FeynmanNote } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, Input, Tabs, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { AiNote, DemoTag, EmptyState, LoadingState } from "@/components/states";

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-ink-2">加载中…</div>}>
      <NotesContent />
    </Suspense>
  );
}

const SOURCE_LABEL: Record<FeynmanNote["sourceTag"], string> = {
  ai_draft: "AI 草稿",
  user_edit: "你的编辑",
  mixed: "混合",
};

type StatusKey = "all" | "to_add" | "self_assessed" | "archived";

function effectiveStatus(n: FeynmanNote): StatusKey {
  if (n.statusFilter === "archived") return "archived";
  return n.selfAssessed ? "self_assessed" : "to_add";
}

function loadAllNotes(base: FeynmanNote[]): FeynmanNote[] {
  if (typeof window === "undefined") return base;
  const map = new Map<string, FeynmanNote>();
  for (const n of base) map.set(n.id, n);
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("pf-note-")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as FeynmanNote;
        if (parsed && typeof parsed.id === "string") map.set(parsed.id, parsed);
      }
    }
  } catch {
    /* ignore */
  }
  return Array.from(map.values());
}

function persistNote(n: FeynmanNote) {
  try {
    window.localStorage.setItem(`pf-note-${n.id}`, JSON.stringify(n));
    window.localStorage.setItem(`pf-note-${n.sessionId}`, JSON.stringify(n));
  } catch {
    /* ignore */
  }
}

function NotesContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const role = useAppStore((s) => s.role);
  const pushToast = useAppStore((s) => s.pushToast);

  const [notes, setNotes] = useState<FeynmanNote[]>(NOTES);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<StatusKey>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [nodeTitles, setNodeTitles] = useState<Map<string, string>>(new Map());
  const focusHandled = useRef(false);

  // api 模式：从后端拉取真实笔记；demo 模式：合并本地保存的笔记
  useEffect(() => {
    if (isApiMode) {
      let cancelled = false;
      listNotes()
        .then((list) => {
          if (!cancelled) {
            setNotes(list);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoaded(true);
            pushToast("笔记加载失败，请稍后重试", "error");
          }
        });
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setTimeout(() => {
      setNotes(loadAllNotes(NOTES));
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pushToast]);

  // api 模式：为笔记的来源节点解析标题（来自当前用户真实路径），不依赖演示数据
  useEffect(() => {
    if (!isApiMode) return;
    let cancelled = false;
    (async () => {
      try {
        const paths = await listPaths();
        const fulls = await Promise.all(paths.map((p) => getPath(p.id)));
        const m = new Map<string, string>();
        for (const full of fulls) {
          if (!full) continue;
          for (const n of full.nodes) m.set(n.id, n.title);
        }
        if (!cancelled) setNodeTitles(m);
      } catch {
        // 解析失败时回退显示 nodeId
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // URL ?focus=note-xx 直达打开（来自学习空间「最近资产」入口）
  useEffect(() => {
    if (focusHandled.current || !focusId) return;
    const n = notes.find((x) => x.id === focusId);
    if (n) {
      focusHandled.current = true;
      openNote(n);
    }
  }, [focusId, notes]);

  const activeNote = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  const filtered = useMemo(() => {
    if (tab === "all") return notes.filter((n) => effectiveStatus(n) !== "archived");
    return notes.filter((n) => effectiveStatus(n) === tab);
  }, [notes, tab]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { all: 0, to_add: 0, self_assessed: 0, archived: 0 };
    for (const n of notes) {
      if (effectiveStatus(n) !== "archived") c.all += 1;
      c[effectiveStatus(n)] += 1;
    }
    return c;
  }, [notes]);

  function openNote(n: FeynmanNote) {
    setActiveId(n.id);
    setEditTitle(n.title);
    setEditContent(n.content);
  }

  function closeNote() {
    setActiveId(null);
  }

  async function handleSave() {
    if (!activeNote || saving) return;
    setSaving(true);
    try {
      const updated: FeynmanNote = {
        ...activeNote,
        title: editTitle.trim() || activeNote.title,
        content: editContent,
        sourceTag: activeNote.sourceTag === "ai_draft" ? "mixed" : activeNote.sourceTag,
        selfAssessed: true,
        updatedAt: new Date().toISOString(),
      };
      if (isApiMode) {
        const saved = await updateNote(activeNote.id, {
          title: updated.title,
          content: updated.content,
          sourceTag: updated.sourceTag,
          selfAssessed: true,
        });
        setNotes((ns) => ns.map((n) => (n.id === saved.id ? saved : n)));
      } else {
        await mockFetch(null, { latency: [300, 600] });
        setNotes((ns) => ns.map((n) => (n.id === updated.id ? updated : n)));
        persistNote(updated);
      }
      pushToast("笔记已保存");
    } catch {
      pushToast("保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!activeNote) return;
    const updated: FeynmanNote = {
      ...activeNote,
      statusFilter: activeNote.statusFilter === "archived" ? "all" : "archived",
      updatedAt: new Date().toISOString(),
    };
    try {
      if (isApiMode) {
        const saved = await updateNote(activeNote.id, { statusFilter: updated.statusFilter });
        setNotes((ns) => ns.map((n) => (n.id === saved.id ? saved : n)));
      } else {
        setNotes((ns) => ns.map((n) => (n.id === updated.id ? updated : n)));
        persistNote(updated);
      }
      setActiveId(updated.id);
      pushToast(updated.statusFilter === "archived" ? "已归档，可在「归档」中查看" : "已取消归档", "info");
    } catch {
      pushToast("操作失败，请稍后重试", "error");
    }
  }

  // api 模式：以真实笔记为准（可能为空也可能已有）；demo 模式：新学习者演示无笔记
  if (!loaded) return <LoadingState label="正在加载笔记…" />;
  if (notes.length === 0 || (!isApiMode && role === "new_learner")) {
    return (
      <div>
        <NotesHeader count={0} />
        <EmptyState
          title="还没有笔记"
          description="完成一次费曼练习后，这里会保留你的可编辑笔记。"
          action={{ label: "去完成练习", href: "/path" }}
        />
      </div>
    );
  }

  return (
    <div>
      <NotesHeader count={notes.length} />

      <Tabs
        items={[
          { value: "all", label: "全部", count: counts.all },
          { value: "to_add", label: "待补充", count: counts.to_add },
          { value: "self_assessed", label: "已自查", count: counts.self_assessed },
          { value: "archived", label: "归档", count: counts.archived },
        ]}
        value={tab}
        onChange={(v) => setTab(v as StatusKey)}
      />

      {filtered.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-base font-medium text-ink">该筛选下没有笔记</p>
          <p className="max-w-sm text-sm text-ink-2">
            换个筛选条件，或去完成一次费曼练习生成新笔记。
          </p>
          <Button variant="secondary" onClick={() => setTab("all")}>
            清除筛选
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={() => openNote(n)}
              nodeTitle={isApiMode ? nodeTitles.get(n.nodeId) : nodeById(PATH_PM, n.nodeId)?.title}
            />
          ))}
        </div>
      )}

      {activeNote ? (
        <Modal
          open
          onClose={closeNote}
          title="笔记详情"
          width="max-w-lg"
          footer={
            <>
              <Button variant="ghost" onClick={toggleArchive}>
                {activeNote.statusFilter === "archived" ? "取消归档" : "归档"}
              </Button>
              {activeNote.sessionId ? (
                <ButtonLink href={`/practice/${activeNote.sessionId}/result`} variant="secondary">
                  查看原对话
                </ButtonLink>
              ) : null}
              <Button onClick={handleSave} loading={saving}>
                保存
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="笔记标题" />
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8} aria-label="笔记正文" />
            {activeNote.pendingQuestions.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-ink">待解决问题</p>
                <ul className="mt-1 space-y-1">
                  {activeNote.pendingQuestions.map((q, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                      <span aria-hidden="true" className="text-ink-3">
                        ?
                      </span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <AiNote /> 内容由费曼练习整理，可编辑并保存到本机。
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** 相对时间仅在客户端水合后计算，避免 SSR 与客户端首帧因 Date.now() 差异导致水合不匹配 */
function RelativeTime({ iso }: { iso: string }) {
  const mounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot);
  const label = mounted ? relativeTime(iso) : null;
  return <>{label ? ` · 更新于 ${label}` : ""}</>;
}

function subscribeToNothing() {
  return () => undefined;
}

function clientSnapshot() {
  return true;
}

function serverSnapshot() {
  return false;
}

function NotesHeader({ count }: { count: number }) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">我的笔记</h1>
        <p className="mt-1 text-sm text-ink-2">{count} 篇 · 练习中自动生成的个人知识资产</p>
      </div>
      <DemoTag />
    </header>
  );
}

function NoteCard({
  note,
  onOpen,
  nodeTitle,
}: {
  note: FeynmanNote;
  onOpen: () => void;
  nodeTitle: string | undefined;
}) {
  const status = effectiveStatus(note);
  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-ink-2"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-ink">{note.title}</h2>
          {status === "self_assessed" ? (
            <Badge tone="success">已自查</Badge>
          ) : (
            <Badge tone="warning">待补充</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-3">
          {nodeTitle ?? note.nodeId}
          <RelativeTime iso={note.updatedAt} />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {note.keyTerms.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
          <Badge tone="info">{SOURCE_LABEL[note.sourceTag]}</Badge>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-ink-2">{note.content}</p>
      </button>
    </Card>
  );
}
