"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { FeatureGate } from "@/components/guards";
import { PageHeader } from "@/components/shell";
import { Badge, Button, ButtonLink, Card, Field, Input, Select, Tabs, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag, LoadingState } from "@/components/states";
import { isApiMode } from "@/lib/data-source";
import { LIBRARY_ITEMS } from "@/lib/demo";
import { useDemoTopic } from "@/lib/demo/use-topic";
import type { BadgeTone } from "@/components/ui";
import type { LibraryItem } from "@/lib/types";
import { mockFetch, relativeTime, throwByState } from "@/lib/utils";
import { LibraryApiView } from "./api-view";

const NODE_TITLES: Record<string, string> = {
  "need-signal": "从表象需求到真实需求",
  "user-research-basics": "用户研究基础与问题定义",
  "interview-methods": "访谈方法与避免诱导",
  "req-review": "需求评审与反馈吸收",
  "prd-structure": "PRD 结构与问题定义",
  "wireframe-ux": "低保真原型与关键路径",
};

const KIND_LABEL: Record<LibraryItem["kind"], string> = { link: "链接", file: "文件", note: "笔记" };
const KIND_TONE: Record<LibraryItem["kind"], BadgeTone> = { link: "info", file: "neutral", note: "success" };

const STATUS_LABEL: Record<LibraryItem["status"], string> = {
  verified: "已校验",
  pending: "待校验",
  unavailable: "失效",
  scanning: "扫描中",
};
const STATUS_TONE: Record<LibraryItem["status"], BadgeTone> = {
  verified: "success",
  pending: "warning",
  unavailable: "warning",
  scanning: "info",
};

type NewItemForm = { kind: LibraryItem["kind"]; title: string; url: string; sourceName: string; tags: string; memo: string };
const EMPTY_FORM: NewItemForm = { kind: "link", title: "", url: "", sourceName: "", tags: "", memo: "" };

type TabValue = "all" | LibraryItem["kind"];

export default function LibraryPage() {
  return isApiMode ? <LibraryApiView /> : <DemoLibraryPage />;
}

function DemoLibraryPage() {
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const { data: topic, ready, updateBundle } = useDemoTopic();

  // 主题数据包存在时以 topic.library 为准（仅含主题字符串，物理上不可能出现 PM 资料）；
  // 无 bundle（演示角色 / 未诊断）才回退本地静态 PM 演示秀。
  const [localItems, setLocalItems] = useState<LibraryItem[]>(LIBRARY_ITEMS);
  const [tab, setTab] = useState<TabValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!ready) return <LoadingState label="正在加载个人资料库…" />;

  const items = topic ? topic.library : localItems;
  const nodeTitle = (id: string): string =>
    topic ? topic.path.nodes.find((n) => n.id === id)?.title ?? id : NODE_TITLES[id] ?? id;

  const counts = {
    all: items.length,
    link: items.filter((i) => i.kind === "link").length,
    file: items.filter((i) => i.kind === "file").length,
    note: items.filter((i) => i.kind === "note").length,
  };
  const visible = tab === "all" ? items : items.filter((i) => i.kind === tab);

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (saving) return;
    if (!form.title.trim()) {
      setFormError("请填写资料标题");
      return;
    }
    if (form.kind === "link" && !form.url.trim()) {
      setFormError("链接类型需要填写 URL");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      throwByState(demoState);
      await mockFetch(null, { latency: [400, 700] });
      const newItem: LibraryItem = {
        id: `lib-${Date.now()}`,
        kind: form.kind,
        title: form.title.trim(),
        url: form.kind === "link" && form.url.trim() ? form.url.trim() : undefined,
        sourceName: form.sourceName.trim() || "手动添加",
        tags: form.tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        linkedNodeIds: [],
        visibility: "private",
        checkedAt: new Date().toISOString(),
        status: form.kind === "link" ? "pending" : "verified",
        memo: form.memo.trim(),
        licenseNote: "由用户添加（演示）；请确保你拥有保存与分享的权利。",
      };
      if (topic) {
        updateBundle({ ...topic, library: [newItem, ...topic.library] });
      } else {
        setLocalItems((prev) => [newItem, ...prev]);
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      pushToast("已保存到个人资料库", "success");
    } catch {
      pushToast("保存失败：未同步，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FeatureGate flag="personal_library">
      <PageHeader
        title="个人资料库"
        description="集中保存可再次使用的链接、你有权上传的文件与个人摘记。仅自己可见；分享前需再次确认范围与版权。"
        meta={<DemoTag />}
        actions={<Button onClick={openModal}>新增资料</Button>}
      />

      <Tabs
        items={[
          { value: "all", label: "全部", count: counts.all },
          { value: "link", label: "链接", count: counts.link },
          { value: "file", label: "文件", count: counts.file },
          { value: "note", label: "笔记", count: counts.note },
        ]}
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
        className="mb-4"
      />

      <div className="space-y-3">
        {visible.map((item) => (
          <LibraryRow key={item.id} item={item} nodeTitle={nodeTitle} />
        ))}
        {visible.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-base font-medium text-ink">{topic ? "还没有学习资料" : "这个分类还没有资料"}</p>
            <p className="mt-1 text-sm text-ink-2">
              {topic
                ? "从当前学习路径收藏资料，会显示在这里。点击「新增资料」手动添加链接、文件与摘记。"
                : "先保存一个公开链接或已授权文件，或切换其他分类。"}
            </p>
          </Card>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="新增资料"
        description="仅保存你有权保存和用于学习的资料；演示不会真正上传文件。"
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
            <Select id="lib-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as LibraryItem["kind"] })}>
              <option value="link">链接</option>
              <option value="file">文件</option>
              <option value="note">笔记</option>
            </Select>
          </Field>
          <Field label="标题" htmlFor="lib-title" hint="必填；链接标题可在读取后改写">
            <Input id="lib-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：用户研究方法：访谈提纲示例" />
          </Field>
          {form.kind === "link" ? (
            <Field label="URL" htmlFor="lib-url" hint="必填；演示不会发起网络请求">
              <Input id="lib-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" inputMode="url" />
            </Field>
          ) : null}
          <Field label="来源" htmlFor="lib-source">
            <Input id="lib-source" value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} placeholder="例如：官方/机构、个人上传" />
          </Field>
          <Field label="标签" htmlFor="lib-tags" hint="逗号分隔，最多 10 个">
            <Input id="lib-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="需求分析, 访谈" />
          </Field>
          <Field label="摘记" htmlFor="lib-memo" hint="仅你自己可见，不会发送给模型">
            <Textarea id="lib-memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="这段资料为什么值得保存…" className="min-h-[88px]" />
          </Field>
          {formError ? (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </Modal>
    </FeatureGate>
  );
}

function LibraryRow({
  item,
  nodeTitle,
}: {
  item: LibraryItem;
  nodeTitle: (id: string) => string;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
            <span className="text-base font-semibold text-ink">{item.title}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {item.sourceName} · {relativeTime(item.checkedAt)}校验
          </p>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.tags.map((t) => (
          <Badge key={t} tone="neutral">
            {t}
          </Badge>
        ))}
        {item.linkedNodeIds.map((id) => (
          <Badge key={id} tone="info">
            关联：{nodeTitle(id)}
          </Badge>
        ))}
      </div>

      {item.memo ? (
        <p className="mt-3 text-sm text-ink-2">
          <span className="text-ink-3">摘记：</span>
          {item.memo}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-3">
            {item.kind === "link" && item.url
              ? item.url
              : item.kind === "file" && item.objectKey
                ? `${item.objectKey}${item.size ? ` · ${item.size}` : ""}`
                : item.licenseNote}
          </p>
          <p className="mt-0.5 text-xs text-ink-3">{item.kind === "link" && item.url ? item.licenseNote : null}</p>
        </div>
        {item.kind === "link" && item.url ? (
          <ButtonLink href={item.url} variant="secondary" size="sm" external ariaLabel={`打开 ${item.title}`}>
            打开 ↗
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}
