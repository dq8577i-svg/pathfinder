"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag } from "@/components/states";
import { FeatureGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { isApiMode } from "@/lib/data-source";
import { CHALLENGE, CREWS } from "@/lib/demo";
import { mockFetch } from "@/lib/utils";
import type { Crew } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = { member: "成员", captain: "队长", mentor: "导师" };
const STATUS_LABEL: Record<string, { text: string; tone: "success" | "warning" | "neutral" }> = {
  active: { text: "活跃", tone: "success" },
  pending_invite: { text: "待接受邀请", tone: "warning" },
  full: { text: "已满员", tone: "warning" },
  left: { text: "已退出", tone: "neutral" },
};

function challengeTitleFor(crew: Crew): string | null {
  return crew.currentChallengeId === CHALLENGE.id ? CHALLENGE.title : null;
}

export default function CrewsPage() {
  if (isApiMode) {
    return (
      <FeatureGate flag="crews">
        <PageHeader title="小队空间" description="与目标一致的同伴组成小队，围绕共同截止日完成挑战并互相给结构化反馈。" />
        <Card className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">小队功能未实现（P2）</p>
          <p className="max-w-md text-sm text-ink-2">
            本轮 api 模式暂不开放小队。请先使用学习路径、真实资料、情境练习与复习来推进当前主题；小队将在后续阶段按学习路径与目标进行绑定。
          </p>
          <Badge tone="neutral">占位说明</Badge>
        </Card>
      </FeatureGate>
    );
  }
  const demoState = useAppStore((s) => s.demoState);

  return (
    <FeatureGate
      flag="crews"
      title="小队空间暂未开放"
      description="小规模、目标一致的学习协作，不做开放社交广场。可通过演示控制台开启。"
    >
      <PageHeader
        title="小队空间"
        description="与目标一致的同伴组成小队，围绕共同截止日完成挑战并互相给结构化反馈。"
        meta={<DemoTag />}
        actions={<CreateCrewButton />}
      />
      <StateBanner state={demoState} />

      <ul className="space-y-3">
        {CREWS.map((crew) => {
          const st = STATUS_LABEL[crew.status] ?? STATUS_LABEL.active;
          const challenge = challengeTitleFor(crew);
          return (
            <li key={crew.id}>
              <Link
                href={`/crews/${crew.id}`}
                className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">{crew.name}</h2>
                  <Badge tone={st.tone}>{st.text}</Badge>
                  <Badge tone="info">我的角色：{ROLE_LABEL[crew.myRole] ?? crew.myRole}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-2">{crew.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                  <span>
                    成员 {crew.memberCount} / {crew.maxMembers}
                  </span>
                  <span>{challenge ? `当前挑战：${challenge}` : "暂无当前挑战"}</span>
                </div>
                <p className="mt-2 text-xs text-ink-3">{crew.policyNote}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-ink-3">
        进度仅显示成员明确同意的聚合层级；退出小队不删除本人作品与历史路径。
      </p>
    </FeatureGate>
  );
}

function CreateCrewButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", maxMembers: "6" });
  const pushToast = useAppStore((s) => s.pushToast);
  const demoState = useAppStore((s) => s.demoState);

  async function handleCreate() {
    if (saving) return;
    if (demoState === "offline") {
      pushToast("离线演示状态，写入未保存", "warning");
      return;
    }
    if (!form.name.trim() || !form.description.trim()) {
      pushToast("请填写小队名称与描述", "warning");
      return;
    }
    setSaving(true);
    try {
      await mockFetch(null, { latency: [350, 550] });
      setOpen(false);
      setForm({ name: "", description: "", maxMembers: "6" });
      pushToast(`小队「${form.name.trim()}」已创建（演示）`);
    } catch {
      pushToast("创建失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>创建小队</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="创建小队"
        description="个人用户可创建私有小队；邀请链接一次性、可过期。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="小队名称" htmlFor="crew-name">
            <Input
              id="crew-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：需求分析共修小组"
            />
          </Field>
          <Field label="小队描述" htmlFor="crew-desc" hint="写清本周主题与协作目标，便于同伴判断是否加入">
            <Input
              id="crew-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="例如：每周一个可验证产出，互相给结构化反馈"
            />
          </Field>
          <Field label="成员上限" htmlFor="crew-max">
            <Select
              id="crew-max"
              value={form.maxMembers}
              onChange={(e) => setForm((f) => ({ ...f, maxMembers: e.target.value }))}
            >
              <option value="4">4 人</option>
              <option value="6">6 人</option>
              <option value="8">8 人</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
