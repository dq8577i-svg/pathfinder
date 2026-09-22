"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive as ArchiveBox,
  ChartDonut,
  DotsThree,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, Field, Input, ProgressBar, Select } from "@/components/ui";
import { ConfirmDialog, Drawer, Modal } from "@/components/overlay";
import { DemoTag, LoadingState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { PATH_PAUSED, PATH_PM } from "@/lib/demo";
import { useDemoTopic } from "@/lib/demo/use-topic";
import { formatDate } from "@/lib/utils";
import { isApiMode } from "@/lib/data-source";
import { listPaths, updatePath, type UpdatePathInput } from "@/lib/api/paths";
import { resolveActivePathId } from "@/lib/api/hooks";
import type { LearningPath } from "@/lib/types";

type ViewMode = "list" | "board";
type SortMode = "activity" | "progress" | "deadline" | "title";
type StatusFilter = "all" | LearningPath["status"];
type EditableStatus = Exclude<LearningPath["status"], "draft">;

const PREFS_KEY = "pf-paths-workbench-v1";
const PAGE_SIZE = 6;
const STATUS_LABEL: Record<LearningPath["status"], { text: string; tone: "info" | "warning" | "neutral" | "success" }> = {
  in_progress: { text: "进行中", tone: "info" },
  paused: { text: "已暂停", tone: "warning" },
  draft: { text: "草稿", tone: "neutral" },
  completed: { text: "已完成", tone: "success" },
  archived: { text: "已归档", tone: "neutral" },
};
const BOARD_COLUMNS: Array<{ status: EditableStatus; label: string; hint: string }> = [
  { status: "in_progress", label: "进行中", hint: "正在推进" },
  { status: "paused", label: "已暂停", hint: "稍后恢复" },
  { status: "completed", label: "已完成", hint: "目标达成" },
  { status: "archived", label: "已归档", hint: "保留记录" },
];

interface EditForm {
  title: string;
  weeklyHours: string;
  deadline: string;
}

export default function PathsPage() {
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: topic, ready } = useDemoTopic();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("activity");
  const [view, setView] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [prefsReady, setPrefsReady] = useState(false);
  const [selected, setSelected] = useState<LearningPath | null>(null);
  const [editing, setEditing] = useState<LearningPath | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: "", weeklyHours: "", deadline: "" });
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [archiving, setArchiving] = useState<LearningPath | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { view?: ViewMode; sort?: SortMode; status?: StatusFilter };
        if (saved.view === "list" || saved.view === "board") setView(saved.view);
        if (["activity", "progress", "deadline", "title"].includes(saved.sort ?? "")) setSort(saved.sort!);
        if (["all", "in_progress", "paused", "completed", "archived", "draft"].includes(saved.status ?? "")) setStatus(saved.status!);
      }
    } catch {
      /* 无效偏好自动忽略 */
    }
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ view, sort, status }));
    } catch {
      /* 隐私模式下允许不持久化 */
    }
  }, [prefsReady, sort, status, view]);

  useEffect(() => {
    if (isApiMode) {
      void reloadPaths();
      return;
    }
    if (!ready) return;
    const timer = window.setTimeout(() => {
      let savedPaths: LearningPath[] = [];
      try {
        const raw = window.localStorage.getItem("pf-demo-paths");
        const bundles = raw ? (JSON.parse(raw) as Array<{ path?: LearningPath }>) : [];
        savedPaths = bundles.flatMap((item) => (item.path ? [item.path] : []));
      } catch {
        savedPaths = [];
      }
      const next = savedPaths.length > 0 ? savedPaths : topic ? [topic.path, PATH_PAUSED] : [PATH_PM, PATH_PAUSED];
      setPaths(next);
      let storedActive: string | null = null;
      try {
        storedActive = window.localStorage.getItem("pf-active-path");
      } catch {
        /* ignore */
      }
      setActiveId(storedActive && next.some((item) => item.id === storedActive) ? storedActive : next[0]?.id ?? null);
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, topic]);

  async function reloadPaths() {
    try {
      const list = await listPaths();
      setPaths(list);
      setActiveId(resolveActivePathId(list));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "路径加载失败", "error");
    } finally {
      setLoaded(true);
    }
  }

  function persistDemoPaths(next: LearningPath[]) {
    try {
      const raw = window.localStorage.getItem("pf-demo-paths");
      const old = raw ? (JSON.parse(raw) as Array<Record<string, unknown> & { path?: LearningPath }>) : [];
      const bundles = next.map((path) => {
        const existing = old.find((item) => item.path?.id === path.id);
        return existing
          ? { ...existing, path, title: path.title }
          : {
              path,
              title: path.title,
              generatedAt: path.createdAt,
              goal: {
                topic: path.title,
                goal: path.goalSummary,
                currentLevel: "beginner",
                weeklyHours: path.weeklyHours,
                deadlineWeeks: path.estimatedWeeks || 8,
                preferredFormats: ["course"],
                languagePreference: "zh-CN",
              },
            };
      });
      window.localStorage.setItem("pf-demo-paths", JSON.stringify(bundles));
    } catch {
      /* ignore */
    }
  }

  async function mutatePath(path: LearningPath, input: UpdatePathInput, successMessage: string) {
    if (savingId) return;
    setSavingId(path.id);
    try {
      if (isApiMode) {
        const updated = await updatePath(path.id, input);
        setSelected((current) => (current?.id === path.id ? updated : current));
        await reloadPaths();
      } else {
        const now = new Date().toISOString();
        let next = paths.map((item) =>
          item.id === path.id
            ? {
                ...item,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.weeklyHours !== undefined ? { weeklyHours: input.weeklyHours } : {}),
                ...(input.status !== undefined ? { status: input.status } : {}),
                deadline: input.deadline ?? item.deadline,
                lastActivityAt: now,
                isPrimary: input.setPrimary ? true : item.isPrimary,
              }
            : input.setPrimary
              ? { ...item, isPrimary: false }
              : item,
        );
        if (input.status === "archived" && path.isPrimary) {
          const candidate = next.find((item) => item.id !== path.id && item.status !== "archived");
          next = next.map((item) => ({ ...item, isPrimary: item.id === candidate?.id }));
        }
        setPaths(next);
        persistDemoPaths(next);
        setSelected((current) => (current?.id === path.id ? next.find((item) => item.id === path.id) ?? current : current));
      }
      pushToast(successMessage, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "操作失败，请重试", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSetActive(path: LearningPath) {
    try {
      window.localStorage.setItem("pf-active-path", path.id);
    } catch {
      /* ignore */
    }
    setActiveId(path.id);
    pushToast(`已将「${path.title}」设为当前路径`, "success");
  }

  function openEdit(path: LearningPath) {
    setMenuId(null);
    setSelected(null);
    setEditing(path);
    setEditErrors({});
    setEditForm({ title: path.title, weeklyHours: String(path.weeklyHours), deadline: path.deadline ? path.deadline.slice(0, 10) : "" });
  }

  async function saveEdit() {
    if (!editing) return;
    const hours = Number(editForm.weeklyHours);
    const errors: Partial<Record<keyof EditForm, string>> = {};
    if (editForm.title.trim().length < 2) errors.title = "路径名称至少 2 个字";
    if (!Number.isInteger(hours) || hours < 1 || hours > 40) errors.weeklyHours = "请输入 1–40 的整数";
    if (!editForm.deadline) errors.deadline = "请选择目标日期";
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    await mutatePath(editing, {
      title: editForm.title.trim(),
      weeklyHours: hours,
      deadline: new Date(`${editForm.deadline}T23:59:59+08:00`).toISOString(),
    }, "路径信息已更新");
    setEditing(null);
  }

  async function changeStatus(path: LearningPath, next: EditableStatus) {
    setMenuId(null);
    if (path.status === next) return;
    await mutatePath(path, { status: next }, `「${path.title}」已${STATUS_LABEL[next].text}`);
  }

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    const list = paths.filter((path) => {
      const matchesText = !keyword || `${path.title} ${path.goalSummary}`.toLocaleLowerCase("zh-CN").includes(keyword);
      return matchesText && (status === "all" || path.status === status);
    });
    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "zh-CN");
      if (sort === "deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (sort === "progress") {
        const ap = a.progress.total ? a.progress.completed / a.progress.total : 0;
        const bp = b.progress.total ? b.progress.completed / b.progress.total : 0;
        return bp - ap;
      }
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }, [paths, query, sort, status]);

  useEffect(() => setPage(1), [query, sort, status, view]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const completedNodes = paths.reduce((sum, item) => sum + item.progress.completed, 0);
  const totalNodes = paths.reduce((sum, item) => sum + item.progress.total, 0);

  if (!isApiMode && !ready) return <LoadingState label="正在加载学习路径…" />;

  return (
    <FeatureGate flag="multi_path" title="多路径暂未开放" description="路径管理用于创建、切换和独立维护不同主题。">
      <PageHeader
        title="学习路径工作台"
        description="管理多个学习主题，在列表与看板之间切换；筛选、排序与视图偏好会在刷新后保留。"
        meta={<DemoTag />}
        actions={<ButtonLink href="/onboarding">新建路径</ButtonLink>}
      />
      <StateBanner state={demoState} />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="路径数据概览">
        <MetricCard label="全部路径" value={paths.length} hint={`${paths.filter((p) => p.status === "in_progress").length} 条进行中`} />
        <MetricCard label="已完成节点" value={completedNodes} hint={`共 ${totalNodes} 个节点`} />
        <MetricCard label="平均周投入" value={paths.length ? Math.round(paths.reduce((s, p) => s + p.weeklyHours, 0) / paths.length) : 0} suffix="h" hint="按全部路径计算" />
        <ProgressMetric completed={completedNodes} total={totalNodes} />
      </section>

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={17} />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索路径名称或学习目标" className="pl-9" aria-label="搜索学习路径" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="筛选状态" className="sm:w-36">
              <option value="all">全部状态</option><option value="in_progress">进行中</option><option value="paused">已暂停</option><option value="completed">已完成</option><option value="archived">已归档</option><option value="draft">草稿</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="排序方式" className="sm:w-40">
              <option value="activity">最近活动</option><option value="progress">完成进度</option><option value="deadline">目标日期</option><option value="title">路径名称</option>
            </Select>
            <Button variant="ghost" onClick={() => { setQuery(""); setStatus("all"); setSort("activity"); }} className="col-span-2 sm:col-span-1"><Funnel size={16} /> 重置</Button>
          </div>
          <div className="flex rounded-md border border-line bg-subtle p-1" aria-label="视图切换">
            <ViewButton active={view === "list"} onClick={() => setView("list")} label="列表视图"><Rows size={16} /></ViewButton>
            <ViewButton active={view === "board"} onClick={() => setView("board")} label="看板视图"><SquaresFour size={16} /></ViewButton>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3"><span>{filtered.length === paths.length ? `共 ${paths.length} 条路径` : `找到 ${filtered.length} / ${paths.length} 条路径`}</span><span>偏好已保存到本机</span></div>
      </Card>

      {!loaded ? <LoadingState label="正在加载学习路径…" /> : filtered.length === 0 ? (
        <Card className="p-9 text-center"><p className="text-base font-medium text-ink">没有符合条件的学习路径</p><p className="mt-1 text-sm text-ink-2">调整关键词或筛选条件，也可以创建一个新的学习主题。</p><div className="mt-4 flex justify-center gap-2"><Button variant="secondary" onClick={() => { setQuery(""); setStatus("all"); }}>清空筛选</Button><ButtonLink href="/onboarding">新建路径</ButtonLink></div></Card>
      ) : view === "list" ? (
        <div className="space-y-3">{visible.map((path) => (
          <PathRow key={path.id} path={path} active={path.id === activeId} saving={savingId === path.id} menuOpen={menuId === path.id}
            onMenu={() => setMenuId(menuId === path.id ? null : path.id)} onDetail={() => { setSelected(path); setMenuId(null); }} onEdit={() => openEdit(path)}
            onArchive={() => { setArchiving(path); setMenuId(null); }} onActive={() => void handleSetActive(path)} onStatus={(next) => void changeStatus(path, next)} />
        ))}</div>
      ) : (
        <PathBoard paths={filtered} activeId={activeId} draggedId={draggedId} onDragStart={setDraggedId} onDrop={(next) => {
          const path = paths.find((item) => item.id === draggedId);
          setDraggedId(null);
          if (path) void changeStatus(path, next);
        }} onDetail={setSelected} />
      )}

      {view === "list" && filtered.length > PAGE_SIZE ? (
        <nav className="mt-5 flex items-center justify-between" aria-label="路径分页"><p className="text-xs text-ink-3">第 {safePage} / {pageCount} 页</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button><Button size="sm" variant="secondary" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>下一页</Button></div></nav>
      ) : null}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="路径详情" width="w-[30rem] max-w-[92vw]">
        {selected ? <PathDetailDrawer path={selected} active={selected.id === activeId} saving={savingId === selected.id}
          onEdit={() => openEdit(selected)} onActive={() => void handleSetActive(selected)} onPrimary={() => void mutatePath(selected, { setPrimary: true }, "已设为主路径")}
          onStatus={(next) => void changeStatus(selected, next)} /> : null}
      </Drawer>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="编辑路径" description="调整名称、每周投入和目标日期，不会重置已有学习进度。" width="max-w-lg"
        footer={<><Button variant="ghost" onClick={() => { setEditForm({ title: editing?.title ?? "", weeklyHours: String(editing?.weeklyHours ?? ""), deadline: editing?.deadline.slice(0, 10) ?? "" }); setEditErrors({}); }}>重置</Button><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={() => void saveEdit()} loading={!!editing && savingId === editing.id}>保存修改</Button></>}>
        <div className="space-y-4">
          <Field label="路径名称" htmlFor="edit-title" error={editErrors.title}><Input id="edit-title" value={editForm.title} maxLength={60} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="每周投入（小时）" htmlFor="edit-hours" error={editErrors.weeklyHours}><Input id="edit-hours" type="number" min={1} max={40} value={editForm.weeklyHours} onChange={(e) => setEditForm((f) => ({ ...f, weeklyHours: e.target.value }))} /></Field><Field label="目标日期" htmlFor="edit-deadline" error={editErrors.deadline}><Input id="edit-deadline" type="date" value={editForm.deadline} onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))} /></Field></div>
        </div>
      </Modal>

      <ConfirmDialog open={!!archiving} onClose={() => setArchiving(null)} onConfirm={() => {
        if (!archiving) return;
        const path = archiving;
        setArchiving(null);
        void mutatePath(path, { status: "archived" }, `「${path.title}」已归档`);
      }} title="归档这条路径？" description="归档不会删除节点、资料和学习记录，可在看板或状态筛选中恢复。" confirmLabel="确认归档" danger loading={!!archiving && savingId === archiving.id} />
    </FeatureGate>
  );
}

function MetricCard({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint: string }) {
  return <Card className="p-4"><p className="text-xs text-ink-3">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}<span className="ml-1 text-sm font-medium text-ink-3">{suffix}</span></p><p className="mt-1 text-xs text-ink-2">{hint}</p></Card>;
}

function ProgressMetric({ completed, total }: { completed: number; total: number }) {
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return <Card className="flex items-center gap-4 p-4"><div className="relative grid size-14 place-items-center rounded-full" style={{ background: `conic-gradient(var(--pf-action) ${pct}%, var(--pf-subtle) ${pct}% 100%)` }}><div className="grid size-10 place-items-center rounded-full bg-surface text-xs font-semibold text-ink">{pct}%</div></div><div><div className="flex items-center gap-1.5 text-xs text-ink-3"><ChartDonut size={14} />综合进度</div><p className="mt-1 text-sm font-medium text-ink">跨路径完成率</p><p className="text-xs text-ink-2">随节点状态动态更新</p></div></Card>;
}

function ViewButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`grid h-9 w-10 place-items-center rounded transition-colors ${active ? "bg-surface text-action shadow-sm" : "text-ink-3 hover:text-ink"}`}>{children}</button>;
}

function PathRow({ path, active, saving, menuOpen, onMenu, onDetail, onEdit, onArchive, onActive, onStatus }: {
  path: LearningPath; active: boolean; saving: boolean; menuOpen: boolean; onMenu: () => void; onDetail: () => void; onEdit: () => void; onArchive: () => void; onActive: () => void; onStatus: (status: EditableStatus) => void;
}) {
  const st = STATUS_LABEL[path.status];
  return <Card className={`relative p-4 transition-all sm:p-5 ${active ? "pf-current-glow" : "hover:border-line-strong"}`}>
    <div className="flex items-start gap-3"><button type="button" onClick={onDetail} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-action"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-ink sm:text-lg">{path.title}</h2><Badge tone={st.tone}>{st.text}</Badge>{path.isPrimary ? <Badge tone="success">主路径</Badge> : null}{active ? <Badge tone="info">当前</Badge> : null}</div><p className="mt-1 line-clamp-2 text-sm text-ink-2">{path.goalSummary}</p></button>
      <div className="relative shrink-0">{menuOpen ? <button className="fixed inset-0 z-20 cursor-default" aria-label="关闭菜单" onClick={onMenu} /> : null}<button type="button" onClick={onMenu} disabled={saving} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`管理 ${path.title}`} className="relative z-30 grid h-11 w-11 place-items-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink"><DotsThree size={22} weight="bold" /></button>{menuOpen ? <div role="menu" className="pf-glass absolute right-0 top-12 z-30 w-44 rounded-lg p-1.5 shadow-pop"><MenuButton onClick={onDetail}>查看详情</MenuButton><MenuButton onClick={onEdit}><PencilSimple size={15} />编辑路径</MenuButton>{!active ? <MenuButton onClick={onActive}>设为当前路径</MenuButton> : null}{path.status === "paused" || path.status === "archived" ? <MenuButton onClick={() => onStatus("in_progress")}>恢复进行</MenuButton> : <MenuButton onClick={() => onStatus("paused")}>暂停路径</MenuButton>}<div className="my-1 border-t border-line" /><MenuButton onClick={onArchive} danger><ArchiveBox size={15} />归档路径</MenuButton></div> : null}</div>
    </div>
    <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_auto] sm:items-end"><ProgressBar value={path.progress.completed} max={path.progress.total} label={`${path.progress.completed} / ${path.progress.total}`} /><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3"><span>每周 {path.weeklyHours}h</span><span>目标 {formatDate(path.deadline)}</span><span>更新 {formatDate(path.lastActivityAt)}</span>{!active ? <Button size="sm" variant="secondary" onClick={onActive}>设为当前路径</Button> : null}</div></div>
  </Card>;
}

function MenuButton({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" role="menuitem" onClick={onClick} className={`flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm ${danger ? "text-danger hover:bg-danger-bg" : "text-ink-2 hover:bg-subtle hover:text-ink"}`}>{children}</button>;
}

function PathBoard({ paths, activeId, draggedId, onDragStart, onDrop, onDetail }: { paths: LearningPath[]; activeId: string | null; draggedId: string | null; onDragStart: (id: string) => void; onDrop: (status: EditableStatus) => void; onDetail: (path: LearningPath) => void }) {
  return <div className="grid gap-3 xl:grid-cols-4" aria-label="路径状态看板">{BOARD_COLUMNS.map((column) => {
    const items = paths.filter((path) => path.status === column.status);
    return <section key={column.status} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(column.status)} className={`min-h-56 rounded-xl border p-3 transition-colors ${draggedId ? "border-action/40 bg-[var(--pf-active-soft)]/30" : "border-line bg-subtle/45"}`}><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-ink">{column.label}</h2><p className="text-xs text-ink-3">{column.hint}</p></div><Badge tone={STATUS_LABEL[column.status].tone}>{items.length}</Badge></div><div className="space-y-2">{items.map((path) => <button key={path.id} type="button" draggable onDragStart={() => onDragStart(path.id)} onDragEnd={() => onDragStart("")} onClick={() => onDetail(path)} className={`pf-card w-full cursor-grab rounded-lg border p-3 text-left active:cursor-grabbing ${path.id === activeId ? "border-action/50" : "border-line"}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-medium text-ink">{path.title}</p>{path.id === activeId ? <span className="mt-1 size-2 shrink-0 rounded-full bg-action" title="当前路径" /> : null}</div><p className="mt-2 text-xs text-ink-3">{path.progress.completed}/{path.progress.total} 节点 · 每周 {path.weeklyHours}h</p><ProgressBar value={path.progress.completed} max={path.progress.total} className="mt-2" /></button>)}</div>{items.length === 0 ? <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-line text-center text-xs text-ink-3">拖动路径到这里<br />或在详情中切换状态</div> : null}</section>;
  })}</div>;
}

function PathDetailDrawer({ path, active, saving, onEdit, onActive, onPrimary, onStatus }: { path: LearningPath; active: boolean; saving: boolean; onEdit: () => void; onActive: () => void; onPrimary: () => void; onStatus: (status: EditableStatus) => void }) {
  const st = STATUS_LABEL[path.status];
  return <div className="space-y-5 p-5"><div><div className="flex flex-wrap gap-2"><Badge tone={st.tone}>{st.text}</Badge>{path.isPrimary ? <Badge tone="success">主路径</Badge> : null}{active ? <Badge tone="info">当前路径</Badge> : null}</div><h3 className="mt-3 text-xl font-semibold tracking-tight text-ink">{path.title}</h3><p className="mt-2 text-sm leading-6 text-ink-2">{path.goalSummary}</p></div><Card className="grid grid-cols-2 gap-4 p-4"><DataPoint label="节点进度" value={`${path.progress.completed} / ${path.progress.total}`} /><DataPoint label="每周投入" value={`${path.weeklyHours} 小时`} /><DataPoint label="目标日期" value={formatDate(path.deadline)} /><DataPoint label="计划版本" value={`v${path.curriculumVersion}`} /></Card><div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">状态流转</p><div className="grid grid-cols-2 gap-2">{BOARD_COLUMNS.map((item) => <Button key={item.status} size="sm" variant={path.status === item.status ? "primary" : "secondary"} disabled={saving || path.status === item.status} onClick={() => onStatus(item.status)}>{item.label}</Button>)}</div></div><div className="space-y-2 border-t border-line pt-4"><Button className="w-full" variant="secondary" onClick={onEdit}><PencilSimple size={16} />编辑路径</Button>{!active ? <Button className="w-full" variant="secondary" onClick={onActive}>设为当前路径</Button> : null}{!path.isPrimary ? <Button className="w-full" variant="secondary" onClick={onPrimary}>设为主路径</Button> : null}<ButtonLink className="w-full" href={`/paths/${path.id}`}>打开完整详情</ButtonLink></div><p className="text-xs leading-5 text-ink-3">当前路径决定首页与学习模块展示的主题；主路径用于默认排序。状态变化会写入数据库，归档不会删除历史资料。</p></div>;
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-ink-3">{label}</p><p className="mt-1 text-sm font-medium text-ink">{value}</p></div>;
}
