"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Tabs } from "@/components/ui";
import { ConfirmDialog } from "@/components/overlay";
import { DemoTag, ForbiddenState } from "@/components/states";
import { FeatureGate, RoleGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { TENANT } from "@/lib/demo";
import { mockFetch, formatDate } from "@/lib/utils";
import type { ResourceFlag } from "@/lib/types";

export default function OrgAdminPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const demoState = useAppStore((s) => s.demoState);
  const tenant = tenantSlug === TENANT.slug ? TENANT : null;

  return (
    <FeatureGate flag="tenant_workspace" title="机构空间暂未开放" description="机构管理与内容治理仅对机构管理员开放。">
      <RoleGate allowed={["org_admin"]} reason="机构数据仅机构成员可见，当前演示角色无权访问。">
        {tenant ? (
          <>
            <PageHeader
              title={`${tenant.name} · 管理台`}
              description="管理本机构成员、聚合数据、资源审核与隐私政策；只以最小必要粒度了解学习运行情况。"
              meta={
                <>
                  <Badge tone="info">机构管理员</Badge>
                  <DemoTag />
                </>
              }
            />
            <StateBanner state={demoState} />
            <AdminTabs />
          </>
        ) : (
          <ForbiddenState reason="机构数据仅机构成员可见，当前演示角色无权访问。" />
        )}
      </RoleGate>
    </FeatureGate>
  );
}

function AdminTabs() {
  const [queue, setQueue] = useState<ResourceFlag[]>(TENANT.resourceReviewQueue);
  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const [tab, setTab] = useState("members");
  const [dialog, setDialog] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [policyConfirmed, setPolicyConfirmed] = useState(!TENANT.pendingPolicy);
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  async function handleReview(id: string, action: "approve" | "reject") {
    if (processing) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setProcessing(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      setQueue((qs) =>
        qs.map((q) =>
          q.id === id
            ? { ...q, status: action === "approve" ? "resolved" : "dismissed", resolutionNote: action === "approve" ? "审核通过" : "退回重核" }
            : q,
        ),
      );
      setDialog(null);
      pushToast(action === "approve" ? "已通过审核（演示）" : "已退回（演示）");
    } catch {
      pushToast("操作失败，请重试", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleAcceptPolicy() {
    if (processing) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    setProcessing(true);
    try {
      await mockFetch(null, { latency: [300, 500] });
      setPolicyConfirmed(true);
      pushToast("已确认新隐私政策（演示）");
    } catch {
      pushToast("操作失败，请重试", "error");
    } finally {
      setProcessing(false);
    }
  }

  const tabs = [
    { value: "members", label: "成员", count: TENANT.members.length },
    { value: "metrics", label: "聚合数据" },
    { value: "resources", label: "资源审核", count: pendingCount },
    { value: "policy", label: "政策" },
  ];

  const target = dialog ? queue.find((q) => q.id === dialog.id) : null;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === "members" ? (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">成员管理</h2>
          <p className="mt-1 text-sm text-ink-2">支持停用与角色变更并记录审计；不删除学习证据。</p>
          <ul className="mt-2 divide-y divide-line">
            {TENANT.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="ml-2 text-ink-2">{m.role}</span>
                </div>
                <Badge tone={m.status === "active" ? "success" : "warning"}>
                  {m.status === "active" ? "正常" : "已停用"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "metrics" ? (
        <Card className="p-4 sm:p-5">
          <div className="rounded-md bg-subtle px-3 py-2 text-sm text-ink-2">
            隐私说明：只能看到本机构脱敏聚合数据，无法查看单个学习者的私人笔记或完整练习对话。
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TENANT.aggregateMetrics.map((m) => (
              <div key={m.label} className="rounded-md bg-subtle p-3">
                <dt className="text-xs text-ink-3">{m.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-ink">{m.suppressed ? "—（脱敏）" : m.value}</dd>
                {m.suppressed ? (
                  <p className="mt-1 text-xs text-ink-3">因样本过小不展示 · 仅机构管理员可见</p>
                ) : null}
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {tab === "resources" ? (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">资源审核队列</h2>
          <p className="mt-1 text-sm text-ink-2">展示来源等级、版权备注、可访问性与 AI 推荐理由；拒绝必须填写原因。</p>
          {queue.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">当前没有待审核资源。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{q.resourceTitle}</span>
                      <Badge tone="neutral">资料等级 {q.grade}</Badge>
                      <Badge tone={q.status === "pending" ? "warning" : q.status === "resolved" ? "success" : "neutral"}>
                        {q.status === "pending" ? "待审核" : q.status === "resolved" ? "已通过" : "已退回"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-ink-2">
                      原因：{q.reason} · {q.note}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      提交于 {formatDate(q.createdAt)}
                      <a href={q.url} target="_blank" rel="noreferrer" className="ml-2 text-ink-2 underline hover:text-ink">
                        查看链接
                      </a>
                    </p>
                  </div>
                  {q.status === "pending" ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDialog({ id: q.id, action: "reject" })}
                      >
                        退回
                      </Button>
                      <Button size="sm" onClick={() => setDialog({ id: q.id, action: "approve" })}>
                        通过
                      </Button>
                    </div>
                  ) : (
                    <p className="shrink-0 text-xs text-ink-3">{q.resolutionNote ?? "已处理"}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "policy" ? (
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold text-ink">隐私与分享政策</h2>
          <p className="mt-1 text-sm text-ink-2">
            当前政策版本：{TENANT.policyVersion}。机构管理员需在政策更新后确认，Token 永不在页面显示或提交。
          </p>
          {policyConfirmed ? (
            <div className="mt-3 rounded-md border border-success/30 bg-success-bg px-3 py-2.5 text-sm text-success">
              已确认当前隐私政策（演示）。
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5 text-sm text-warning">
              有新的隐私政策待确认：请阅读更新说明后接受。
              <div className="mt-2">
                <Button size="sm" onClick={handleAcceptPolicy} loading={processing}>
                  接受新隐私政策
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog && handleReview(dialog.id, dialog.action)}
        title={dialog?.action === "approve" ? "通过该资源？" : "退回该资源？"}
        description={
          dialog?.action === "approve"
            ? `确认后「${target?.resourceTitle ?? ""}」将上线为机构资源。`
            : `确认后退回「${target?.resourceTitle ?? ""}」重新核验。`
        }
        confirmLabel={dialog?.action === "approve" ? "确认通过" : "确认退回"}
        danger={dialog?.action === "reject"}
        loading={processing}
      />
    </div>
  );
}
