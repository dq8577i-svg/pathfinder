"use client";

import { useState } from "react";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Field, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { isApiMode } from "@/lib/data-source";
import { PORTFOLIO_ITEMS } from "@/lib/demo";
import { PortfolioApiView } from "./api-view";
import { mockFetch, formatDate, relativeTime } from "@/lib/utils";
import type { PortfolioItem } from "@/lib/types";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const TYPE_LABEL: Record<string, { text: string; tone: "info" | "warning" | "neutral" }> = {
  challenge: { text: "挑战作品", tone: "warning" },
  note: { text: "笔记", tone: "neutral" },
  template: { text: "模板", tone: "info" },
};

const VISIBILITY_LABEL: Record<string, { text: string; tone: "neutral" | "info" | "warning" }> = {
  private: { text: "仅自己可见", tone: "neutral" },
  shared: { text: "对小队可见", tone: "info" },
  public_link: { text: "公开链接", tone: "warning" },
};

export default function PortfolioPage() {
  if (isApiMode) return <PortfolioApiView />;
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="portfolio"
      title="作品集暂未开放"
      description="沉淀费曼笔记、挑战作品与模板，选择性形成可分享的能力证据。"
    >
      <PageHeader
        title="我的学习资产"
        description="沉淀可验证的能力证据；原始学习记录默认不公开，分享前请移除机密与个人信息。"
        meta={<DemoTag />}
      />
      <StateBanner state={demoState} />

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PORTFOLIO_ITEMS.map((item) => (
          <li key={item.id} className="h-full">
            <PortfolioCard item={item} />
          </li>
        ))}
      </ul>
    </FeatureGate>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const [visibility, setVisibility] = useState<PortfolioItem["visibility"]>(item.visibility);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(item.shareExpiresAt);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ scope: PortfolioItem["visibility"]; days: string }>({
    scope: item.visibility === "private" ? "shared" : item.visibility,
    days: "30",
  });
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  const type = TYPE_LABEL[item.type] ?? TYPE_LABEL.note;
  const vis = VISIBILITY_LABEL[visibility] ?? VISIBILITY_LABEL.private;
  const shared = visibility !== "private";

  async function handleShare() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      if (form.scope === "private") {
        setVisibility("private");
        setExpiresAt(undefined);
        pushToast("已设为仅自己可见（演示）");
      } else {
        const exp = form.days === "forever" ? undefined : inDays(Number(form.days) || 30);
        setVisibility(form.scope);
        setExpiresAt(exp);
        if (form.scope === "public_link") {
          pushToast("公开链接已生成（演示）");
        } else {
          pushToast("分享范围已更新（演示）");
        }
      }
      setOpen(false);
    } catch {
      pushToast("分享失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [300, 500] });
      setVisibility("private");
      setExpiresAt(undefined);
      pushToast("已撤回分享，原链接失效（演示）");
    } catch {
      pushToast("操作失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={type.tone}>{type.text}</Badge>
        <Badge tone={vis.tone}>{vis.text}</Badge>
        {item.feedbackCount ? <Badge tone="success">{item.feedbackCount} 条反馈</Badge> : null}
      </div>
      <h2 className="mt-2 text-base font-semibold text-ink">{item.title}</h2>
      <p className="mt-1 text-sm text-ink-2">{item.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.skillTags.map((t) => (
          <Badge key={t} tone="neutral">
            {t}
          </Badge>
        ))}
      </div>
      <dl className="mt-3 space-y-1 text-sm text-ink-3">
        <div className="flex flex-wrap gap-1">
          <dt>来源：</dt>
          <dd>{item.sourcePath}</dd>
        </div>
        <div className="flex flex-wrap gap-1">
          <dt>更新：</dt>
          <dd>{relativeTime(item.updatedAt)}</dd>
        </div>
        {shared && expiresAt ? (
          <div className="flex flex-wrap gap-1">
            <dt>分享到期：</dt>
            <dd>{formatDate(expiresAt)}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {shared ? "调整分享" : "分享"}
        </Button>
        {shared ? (
          <Button variant="dangerGhost" size="sm" onClick={handleRevoke} loading={saving}>
            撤回分享
          </Button>
        ) : null}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="分享学习资产"
        description="公开链接默认 30 天，支持撤回；分享前请移除公司机密、个人信息与未授权教材内容。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleShare} loading={saving}>
              确认分享
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="可见范围" htmlFor="share-scope">
            <Select
              id="share-scope"
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as PortfolioItem["visibility"] }))}
            >
              <option value="private">仅自己可见</option>
              <option value="shared">对小队可见</option>
              <option value="public_link">公开链接</option>
            </Select>
          </Field>
          <Field label="有效期" htmlFor="share-days" hint="公开链接到期后立即失效，不再展示缓存正文">
            <Select
              id="share-days"
              value={form.days}
              onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
            >
              <option value="7">7 天</option>
              <option value="30">30 天</option>
              <option value="90">90 天</option>
              <option value="forever">长期有效</option>
            </Select>
          </Field>
          <p className="text-xs text-ink-3">生成后可在资产卡上随时撤回；撤回不等于删除已收到的合规审计记录。</p>
        </div>
      </Modal>
    </Card>
  );
}
