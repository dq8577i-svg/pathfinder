"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell";
import { Badge, Button, Card } from "@/components/ui";
import { AiNote, EmptyState, LoadingState } from "@/components/states";
import { PathSwitcher } from "@/components/path-switcher";
import { useAppStore } from "@/lib/store";
import { useAsync, useCurrentPathId } from "@/lib/api/hooks";
import type { PortfolioItemDto, PortfolioType, PortfolioVisibility } from "@/lib/api/portfolio";
import {
  createPortfolioItem,
  deletePortfolioItem,
  listPortfolioItems,
} from "@/lib/api/portfolio";
import { formatDate } from "@/lib/utils";

const TYPE_LABEL: Record<PortfolioType, string> = {
  project: "项目",
  note: "笔记",
  link: "链接",
};

const TYPE_TONE: Record<PortfolioType, "info" | "neutral" | "success"> = {
  project: "info",
  note: "success",
  link: "neutral",
};

const VIS_LABEL: Record<PortfolioVisibility, string> = {
  private: "仅自己",
  shared: "站内共享",
  public_link: "公开链接",
};

const VIS_TONE: Record<PortfolioVisibility, "neutral" | "info" | "warning"> = {
  private: "neutral",
  shared: "info",
  public_link: "warning",
};

/** 作品集（api 模式）：绑定当前学习路径的真实作品条目 */
export function PortfolioApiView() {
  const { pathId, paths, reload: reloadPath } = useCurrentPathId();
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: items, loading, reload } = useAsync<PortfolioItemDto[]>(
    async () => (pathId ? listPortfolioItems(pathId) : []),
    [pathId],
    { enabled: !!pathId },
  );

  const [title, setTitle] = useState("");
  const [type, setType] = useState<PortfolioType>("project");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!pathId || saving) return;
    if (!title.trim()) {
      pushToast("请填写作品标题", "error");
      return;
    }
    setSaving(true);
    try {
      const item = await createPortfolioItem({
        pathId,
        title: title.trim(),
        type,
        url: url.trim() || null,
        description: desc.trim(),
      });
      pushToast(`已添加「${item.title}」`, "success");
      setTitle("");
      setUrl("");
      setDesc("");
      await reload();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, itemTitle: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deletePortfolioItem(id);
      pushToast(`已删除「${itemTitle}」`, "success");
      await reload();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除失败，请重试", "error");
    } finally {
      setDeletingId(null);
    }
  }

  if (!pathId) {
    return (
      <EmptyState
        title="还没有学习路径"
        description="先完成目标诊断并生成学习路径，作品集条目将绑定到当前路径。"
        action={{ label: "去诊断", href: "/onboarding" }}
      />
    );
  }
  if (loading) return <LoadingState label="正在加载作品集…" />;

  return (
    <>
      <PageHeader
        title="作品集"
        description="把学习过程中的产出与参考链接沉淀到当前路径，作为真实成果档案。"
        meta={<AiNote>条目均归属当前用户与当前学习路径。</AiNote>}
      />

      <PathSwitcher
        pathId={pathId}
        paths={paths}
        onChange={(id) => {
          try {
            window.localStorage.setItem("pf-active-path", id);
          } catch {
            /* ignore */
          }
          reloadPath();
        }}
      />

      <Card className="mb-6 p-5">
        <h2 className="text-base font-semibold text-ink">添加作品</h2>
        <form onSubmit={handleCreate} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pf-title">
              标题 *
            </label>
            <input
              id="pf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：Python 数据分析练习项目"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pf-type">
              类型
            </label>
            <select
              id="pf-type"
              value={type}
              onChange={(e) => setType(e.target.value as PortfolioType)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
            >
              <option value="project">项目</option>
              <option value="note">笔记</option>
              <option value="link">链接</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pf-url">
              链接（可选）
            </label>
            <input
              id="pf-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pf-desc">
              描述（可选）
            </label>
            <textarea
              id="pf-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="这件作品展示了什么？"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>
              添加作品
            </Button>
          </div>
        </form>
      </Card>

      {!items || items.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-ink-3">
          还没有作品条目。完成学习后，把成果或参考链接添加到这里。
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TYPE_TONE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
                    <Badge tone={VIS_TONE[item.visibility]}>{VIS_LABEL[item.visibility]}</Badge>
                    <span className="text-xs text-ink-3">{formatDate(item.updatedAt)}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-ink">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-1 text-sm text-ink-2">{item.description}</p>
                  ) : null}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block break-all text-sm text-link underline-offset-2 hover:underline"
                    >
                      {item.url}
                    </a>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deletingId === item.id}
                  onClick={() => handleDelete(item.id, item.title)}
                  className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  删除
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
