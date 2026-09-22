"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag, EmptyState, ErrorState } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { CHALLENGE, CREWS } from "@/lib/demo";
import { mockFetch } from "@/lib/utils";
import type { Crew } from "@/lib/types";

const CONSENT_LABEL: Record<string, string> = {
  聚合: "聚合进度",
  节点级: "节点级",
  仅授权提交物: "仅授权提交物",
};

export default function CrewDetailPage() {
  const { crewId } = useParams<{ crewId: string }>();
  const crew = CREWS.find((c) => c.id === crewId) ?? null;
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="crews"
      title="小队空间暂未开放"
      description="小队详情用于查看成员、同意级别与当前挑战。可通过演示控制台开启。"
    >
      {crew ? <CrewDetail key={crew.id} crew={crew} /> : <ErrorState title="未找到该小队" description="该小队不存在或你已退出。" backTo="/crews" />}
      <StateBanner state={demoState} />
    </FeatureGate>
  );
}

function CrewDetail({ crew }: { crew: Crew }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={crew.name}
        description={crew.description}
        meta={
          <>
            <Badge tone="success">活跃</Badge>
            <Badge tone="info">我的角色：{crew.myRole === "member" ? "成员" : crew.myRole === "captain" ? "队长" : "导师"}</Badge>
            <Badge tone="neutral">
              成员 {crew.memberCount} / {crew.maxMembers}
            </Badge>
            <DemoTag />
          </>
        }
      />

      {/* 政策说明 */}
      <Card className="border-warning/30 bg-warning-bg p-4">
        <p className="text-sm font-medium text-warning">小队约定</p>
        <p className="mt-1 text-sm text-ink-2">{crew.policyNote}</p>
      </Card>

      {/* 成员列表 */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-ink">成员与同意级别</h2>
        <ul className="mt-2 divide-y divide-line">
          {crew.members.map((m) => (
            <li key={m.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink">{m.name}</span>
                <span className="ml-2 text-ink-2">{m.role}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{m.progress}</Badge>
                <Badge tone="info">{CONSENT_LABEL[m.consentLevel] ?? m.consentLevel}</Badge>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-3">
          进度仅显示成员明确同意的聚合层级；撤回同意后立即隐藏，仅保留合规审计事件。
        </p>
      </Card>

      {/* 当前挑战 */}
      {crew.currentChallengeId === CHALLENGE.id ? <ChallengeSection /> : <NoChallenge />}
    </div>
  );
}

function NoChallenge() {
  return (
    <Card className="p-4">
      <EmptyState
        title="当前暂无挑战"
        description="队长创建挑战后，这里会展示任务简报、量规与截止时间。"
        action={{ label: "返回小队列表", href: "/crews" }}
      />
    </Card>
  );
}

function ChallengeSection() {
  const [mySubmission, setMySubmission] = useState(CHALLENGE.mySubmission);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", visibility: "小队可见" });
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  async function handleSubmit() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      pushToast("请填写作品标题与正文", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      const nextVersion = (mySubmission?.version ?? 0) + 1;
      setMySubmission({ version: nextVersion, feedbackCount: 0, visibility: form.visibility });
      setOpen(false);
      setForm({ title: "", body: "", visibility: "小队可见" });
      pushToast(`已提交 v${nextVersion}（演示）`);
    } catch {
      pushToast("提交失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">当前挑战</Badge>
            <Badge tone="neutral">截止 {CHALLENGE.dueAt}</Badge>
            <Badge tone="success">{CHALLENGE.status === "submitted" ? "已提交" : CHALLENGE.status}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">{CHALLENGE.title}</h2>
        </div>
        <Button onClick={() => setOpen(true)}>提交我的作品</Button>
      </div>

      <p className="mt-2 text-sm text-ink-2">{CHALLENGE.brief}</p>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-subtle p-3">
          <dt className="text-xs text-ink-3">能力目标</dt>
          <dd className="mt-0.5 text-ink">{CHALLENGE.capabilityGoal}</dd>
        </div>
        <div className="rounded-md bg-subtle p-3">
          <dt className="text-xs text-ink-3">交付物</dt>
          <dd className="mt-0.5 text-ink">{CHALLENGE.delivery}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-sm font-medium text-ink">评审量规</p>
        <ul className="mt-1.5 space-y-1 text-sm text-ink-2">
          <li>· 清晰度：{CHALLENGE.rubric.clarity}</li>
          <li>· 证据意识：{CHALLENGE.rubric.evidence}</li>
          <li>· 边界定义：{CHALLENGE.rubric.boundary}</li>
        </ul>
      </div>

      {mySubmission ? (
        <p className="mt-3 rounded-md border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
          我的作品：v{mySubmission.version} · {mySubmission.visibility} · 已获 {mySubmission.feedbackCount} 条反馈
        </p>
      ) : null}

      <h3 className="mt-4 text-sm font-semibold text-ink">同伴作品</h3>
      <ul className="mt-1 divide-y divide-line">
        {CHALLENGE.submissions.map((s) => (
          <li key={`${s.author}-${s.title}`}>
            <Link
              href="/reviews/review-need-01"
              className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 py-2.5 text-sm transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
            >
              <span className="min-w-0">
                <span className="font-medium text-ink">{s.title}</span>
                <span className="ml-2 text-ink-2">{s.author} · v{s.version}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
                <span>{s.visibility}</span>
                <span>{s.feedbackCount} 条反馈</span>
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">
        反馈采用「一个亮点 + 一条可执行改进 + 对应量规」结构；AI 不自动发布为同伴反馈。
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="提交我的作品"
        description="提交前请确认分享范围；撤回分享不等于删除已收到的合规审计记录。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              提交作品
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="作品标题" htmlFor="submission-title">
            <Input
              id="submission-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例如：问题陈述：让每次导出都带走上下文"
            />
          </Field>
          <Field label="作品正文" htmlFor="submission-body" hint="300–500 字问题陈述 + 1 条证据假设">
            <Textarea
              id="submission-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="区分用户痛点、业务目标与方案假设……"
            />
          </Field>
          <Field label="分享范围" htmlFor="submission-visibility">
            <Select
              id="submission-visibility"
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
            >
              <option value="仅自己">仅自己</option>
              <option value="小队可见">小队可见</option>
              <option value="导师可见">导师可见</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
