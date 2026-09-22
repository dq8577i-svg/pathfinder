"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, Field, Input, Select, Tabs, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { AiNote, EmptyState, LoadingState } from "@/components/states";
import { PathSwitcher } from "@/components/path-switcher";
import { useAppStore } from "@/lib/store";
import { useAsync, useCurrentPathId } from "@/lib/api/hooks";
import {
  createLibraryItem,
  deleteLibraryItem,
  getLibraryDownloadUrl,
  listLibraryItems,
  uploadLibraryFile,
} from "@/lib/api/library";
import type { LibraryItemDto, LibrarySourceType } from "@/lib/api/library";
import { relativeTime } from "@/lib/utils";

const SOURCE_LABEL: Record<LibrarySourceType, string> = {
  resource: "资源",
  upload: "文件",
  note: "笔记",
  link: "链接",
};
const SOURCE_TONE: Record<LibrarySourceType, "info" | "neutral" | "success" | "warning"> = {
  resource: "info",
  link: "neutral",
  upload: "warning",
  note: "success",
};

const STATUS_LABEL: Record<string, string> = { verified: "已校验", pending: "待校验" };
const STATUS_TONE: Record<string, "success" | "warning"> = { verified: "success", pending: "warning" };

type CreateKind = "link" | "upload" | "note";
type FormState = {
  kind: CreateKind;
  title: string;
  url: string;
  sourceName: string;
  tags: string;
  memo: string;
  file: File | null;
};
const EMPTY_FORM: FormState = {
  kind: "link",
  title: "",
  url: "",
  sourceName: "",
  tags: "",
  memo: "",
  file: null,
};

type TabValue = "all" | LibrarySourceType;

/** 个人资料库（api 模式）：用户私有数据，绑定当前学习路径（user_id + path_id），绝不读 demo */
export function LibraryApiView() {
  const { pathId, paths, reload: reloadPath } = useCurrentPathId();
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: items, loading, reload } = useAsync<LibraryItemDto[]>(
    async () => (pathId ? listLibraryItems(pathId) : []),
    [pathId],
    { enabled: !!pathId },
  );

  const [tab, setTab] = useState<TabValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const list = items ?? [];
  const counts = {
    all: list.length,
    resource: list.filter((i) => i.sourceType === "resource").length,
    link: list.filter((i) => i.sourceType === "link").length,
    upload: list.filter((i) => i.sourceType === "upload").length,
    note: list.filter((i) => i.sourceType === "note").length,
  };
  const visible = tab === "all" ? list : list.filter((i) => i.sourceType === tab);

  function openModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  async function handleSave() {
    if (saving || !pathId) return;
    if (!form.title.trim()) {
      pushToast("请填写资料标题", "error");
      return;
    }
    if (form.kind === "link" && !form.url.trim()) {
      pushToast("链接类型需要填写 URL", "error");
      return;
    }
    if (form.kind === "upload" && !form.file) {
      pushToast("请选择要上传的文件", "error");
      return;
    }
    setSaving(true);
    try {
      const tags = form.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);
      const item = form.kind === "upload" && form.file
        ? await uploadLibraryFile({
            pathId,
            file: form.file,
            title: form.title.trim(),
            sourceName: form.sourceName.trim(),
            tags,
            memo: form.memo.trim(),
          })
        : await createLibraryItem({
            pathId,
            kind: form.kind,
            title: form.title.trim(),
            url: form.kind === "link" && form.url.trim() ? form.url.trim() : null,
            sourceName: form.sourceName.trim(),
            tags,
            memo: form.memo.trim(),
          });
      pushToast(`已保存「${item.title}」到个人资料库`, "success");
      setModalOpen(false);
      setForm(EMPTY_FORM);
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
      await deleteLibraryItem(id);
      pushToast(`已删除「${itemTitle}」`, "success");
      await reload();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "删除失败，请重试", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(id: string) {
    if (downloadingId) return;
    // 在用户点击的同步事件里先打开空白页，避免异步获取短时地址后被浏览器拦截。
    const targetWindow = window.open("", "_blank");
    setDownloadingId(id);
    try {
      const url = await getLibraryDownloadUrl(id);
      if (targetWindow) {
        targetWindow.opener = null;
        targetWindow.location.replace(url);
      } else {
        window.location.assign(url);
      }
    } catch (e) {
      targetWindow?.close();
      pushToast(e instanceof Error ? e.message : "暂时无法获取下载地址", "error");
    } finally {
      setDownloadingId(null);
    }
  }

  if (!pathId) {
    return (
      <EmptyState
        title="还没有学习路径"
        description="先完成目标诊断并生成学习路径，资料将绑定到当前路径。"
        action={{ label: "去诊断", href: "/onboarding" }}
      />
    );
  }
  if (loading) return <LoadingState label="正在加载个人资料库…" />;

  return (
    <>
      <PageHeader
        title="个人资料库"
        description="集中保存可再次使用的链接、真实文件与个人摘记，以及从当前学习路径收藏的可信资料。仅自己可见。"
        meta={<AiNote>资料归属当前用户和所选学习路径；文件经服务端进入对象存储。</AiNote>}
        actions={<Button onClick={openModal}>新增资料</Button>}
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

      <Tabs
        items={[
          { value: "all", label: "全部", count: counts.all },
          { value: "resource", label: "资源", count: counts.resource },
          { value: "link", label: "链接", count: counts.link },
          { value: "upload", label: "文件", count: counts.upload },
          { value: "note", label: "笔记", count: counts.note },
        ]}
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
        className="mb-4"
      />

      <div className="space-y-3">
        {visible.map((item) => (
          <LibraryRow
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            downloading={downloadingId === item.id}
            onDelete={() => handleDelete(item.id, item.title)}
            onDownload={() => handleDownload(item.id)}
          />
        ))}
        {visible.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-base font-medium text-ink">还没有学习资料</p>
            <p className="mt-1 text-sm text-ink-2">
              从当前学习路径收藏真实资料，或点击「新增资料」手动添加链接、文件与摘记。
            </p>
          </Card>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新增资料"
        description="链接和笔记写入数据库；文件经服务端校验后保存到对象存储，下载时使用短时授权地址。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} loading={saving}>
              保存到资料库
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="类型" htmlFor="lib-kind">
            <Select
              id="lib-kind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as CreateKind })}
            >
              <option value="link">链接</option>
              <option value="upload">文件</option>
              <option value="note">笔记</option>
            </Select>
          </Field>
          <Field label="标题" htmlFor="lib-title" hint="必填；链接标题可在读取后改写">
            <Input
              id="lib-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="这段资料讲什么…"
            />
          </Field>
          {form.kind === "link" ? (
            <Field label="URL" htmlFor="lib-url" hint="必填；保存链接与摘要，不复制正文">
              <Input
                id="lib-url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
                inputMode="url"
              />
            </Field>
          ) : null}
          {form.kind === "upload" ? (
            <Field label="选择文件" htmlFor="lib-file" hint="支持 PDF、Word、文本和常见图片；单个文件大小以服务端限制为准。">
              <Input
                id="lib-file"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,text/plain,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setForm({ ...form, file, title: form.title || file?.name || "" });
                }}
              />
            </Field>
          ) : null}
          <Field label="来源" htmlFor="lib-source">
            <Input
              id="lib-source"
              value={form.sourceName}
              onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
              placeholder="例如：官方/机构、个人整理"
            />
          </Field>
          <Field label="标签" htmlFor="lib-tags" hint="逗号分隔，最多 10 个">
            <Input
              id="lib-tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="需求分析, PRD, 原型设计"
            />
          </Field>
          <Field label="摘记" htmlFor="lib-memo" hint="仅你自己可见">
            <Textarea
              id="lib-memo"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="这段资料为什么值得保存…"
              className="min-h-[88px]"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function LibraryRow({
  item,
  deleting,
  downloading,
  onDelete,
  onDownload,
}: {
  item: LibraryItemDto;
  deleting: boolean;
  downloading: boolean;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SOURCE_TONE[item.sourceType]}>{SOURCE_LABEL[item.sourceType]}</Badge>
            <span className="text-base font-semibold text-ink">{item.title}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {item.sourceName}
            {item.checkedAt ? ` · ${relativeTime(item.checkedAt)}校验` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          <Button size="sm" variant="ghost" loading={deleting} onClick={onDelete}>
            删除
          </Button>
        </div>
      </div>

      {item.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}

      {item.memo ? (
        <p className="mt-3 text-sm text-ink-2">
          <span className="text-ink-3">摘记：</span>
          {item.memo}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-3">
            {item.url
              ? item.url
              : item.objectKey
                ? `${item.objectKey}${item.size ? ` · ${item.size}` : ""}`
                : item.licenseNote}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{item.url ? item.licenseNote : null}</p>
        </div>
        {item.url ? (
          <ButtonLink href={item.url} variant="secondary" size="sm" external ariaLabel={`打开 ${item.title}`}>
            打开 ↗
          </ButtonLink>
        ) : item.sourceType === "upload" && item.objectKey ? (
          <Button size="sm" variant="secondary" loading={downloading} onClick={onDownload}>
            下载文件
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
