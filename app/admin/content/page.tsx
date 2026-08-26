"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { FeatureGate, RoleGate } from "@/components/guards";
import { PageHeader } from "@/components/shell";
import { Badge, Button, Card, Field, Tabs, Textarea } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { DemoTag } from "@/components/states";
import { ADMIN_FLAGS, ADMIN_RELEASES, SOURCE_DOMAIN_RULES } from "@/lib/demo";
import type { BadgeTone } from "@/components/ui";
import type { CurriculumRelease, ResourceFlag, SourceDomainRule } from "@/lib/types";
import { gradeLabel, mockFetch, relativeTime, throwByState } from "@/lib/utils";

type FlagAction = { flag: ResourceFlag; type: "approve" | "reject" | "ignore" };

const FLAG_STATUS: Record<ResourceFlag["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "待处理", tone: "warning" },
  resolved: { label: "已解决", tone: "success" },
  dismissed: { label: "已忽略", tone: "neutral" },
};

const RELEASE_STATUS: Record<CurriculumRelease["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "草稿", tone: "neutral" },
  pending_review: { label: "待审核", tone: "warning" },
  published: { label: "已发布", tone: "success" },
  rejected: { label: "已驳回", tone: "danger" },
  archived: { label: "已归档", tone: "neutral" },
};

const RULE_STATUS: Record<SourceDomainRule["reviewStatus"], { label: string; tone: BadgeTone }> = {
  approved: { label: "已批准", tone: "success" },
  pending: { label: "待审核", tone: "warning" },
  blocked: { label: "已拦截", tone: "danger" },
};

const GRADE_TONE: Record<"A" | "B" | "C", BadgeTone> = { A: "success", B: "info", C: "warning" };

export default function ContentAdminPage() {
  return (
    <FeatureGate flag="content_console">
      <RoleGate allowed={["content_admin"]} reason="该页面仅内容管理员可访问。">
        <ContentConsole />
      </RoleGate>
    </FeatureGate>
  );
}

function ContentConsole() {
  const demoState = useAppStore((s) => s.demoState);
  const pushToast = useAppStore((s) => s.pushToast);
  const profile = useAppStore((s) => s.profile);

  const [tab, setTab] = useState("flags");
  const [flags, setFlags] = useState<ResourceFlag[]>(ADMIN_FLAGS);
  const [releases, setReleases] = useState<CurriculumRelease[]>(ADMIN_RELEASES);
  const [action, setAction] = useState<FlagAction | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [publishTarget, setPublishTarget] = useState<CurriculumRelease | null>(null);
  const [publishing, setPublishing] = useState(false);

  const pendingFlags = flags.filter((f) => f.status === "pending").length;
  const pendingReleases = releases.filter((r) => r.status === "pending_review" || r.status === "draft").length;

  async function handleFlagConfirm() {
    if (!action || savingAction) return;
    setSavingAction(true);
    try {
      throwByState(demoState);
      await mockFetch(null, { latency: [400, 700] });
      const { flag, type } = action;
      setFlags((prev) =>
        prev.map((f) =>
          f.id === flag.id
            ? {
                ...f,
                status: type === "ignore" ? "dismissed" : "resolved",
                resolutionNote:
                  type === "approve" || type === "reject"
                    ? resolutionNote.trim() || undefined
                    : f.resolutionNote,
              }
            : f,
        ),
      );
      pushToast(
        type === "approve" ? "已通过该审核项" : type === "reject" ? "已驳回该审核项" : "已忽略该审核项",
        "success",
      );
      setAction(null);
      setResolutionNote("");
    } catch {
      pushToast("保存失败：未同步，请重试", "error");
    } finally {
      setSavingAction(false);
    }
  }

  async function handlePublish() {
    if (!publishTarget || publishing) return;
    setPublishing(true);
    try {
      throwByState(demoState);
      await mockFetch(null, { latency: [400, 700] });
      setReleases((prev) =>
        prev.map((r) =>
          r.id === publishTarget.id
            ? { ...r, status: "published", updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      pushToast(`已发布 ${publishTarget.title} ${publishTarget.version}`, "success");
      setPublishTarget(null);
    } catch {
      pushToast("发布失败：未同步，请重试", "error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="内容运营台"
        description="维护教材能力骨架、来源白名单与举报处理。仅展示资源元数据与脱敏审核状态，不展示学习者私人内容。"
        meta={
          <>
            <Badge tone="neutral">管理员：{profile.displayName}</Badge>
            <DemoTag />
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
        <span aria-hidden="true">!</span>
        <p>
          <span className="font-medium">权限说明：</span>
          内容管理员可查看资源元数据与审核状态，不可查看普通用户私人笔记正文或完整费曼对话。
        </p>
      </div>

      <Tabs
        items={[
          { value: "flags", label: "资源审核", count: pendingFlags },
          { value: "releases", label: "教材版本", count: pendingReleases },
          { value: "rules", label: "来源域规则" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === "flags" ? (
        <FlagsTab flags={flags} onAction={setAction} />
      ) : tab === "releases" ? (
        <ReleasesTab releases={releases} onPublish={setPublishTarget} />
      ) : (
        <RulesTab />
      )}

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action
            ? action.type === "approve"
              ? "通过该审核项"
              : action.type === "reject"
                ? "驳回该审核项"
                : "忽略该审核项"
            : ""
        }
        description={
          action
            ? `「${action.flag.resourceTitle}」${
                action.type === "ignore" ? "将被标记为已忽略，不再进入待处理队列。" : "处理结果会记录在审核状态中。"
              }`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              取消
            </Button>
            <Button
              variant={action?.type === "reject" ? "danger" : "primary"}
              onClick={handleFlagConfirm}
              loading={savingAction}
            >
              {action?.type === "approve" ? "确认通过" : action?.type === "reject" ? "确认驳回" : "确认忽略"}
            </Button>
          </>
        }
      >
        {action && action.type !== "ignore" ? (
          <Field label="处理说明（可选）" hint="会随审核状态保存，便于追溯。">
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="例如：已更换为同等级官方资料，待新版本发布…"
              className="min-h-[88px]"
            />
          </Field>
        ) : null}
      </Modal>

      <Modal
        open={publishTarget !== null}
        onClose={() => setPublishTarget(null)}
        title="发布教材版本"
        description={
          publishTarget
            ? `「${publishTarget.title} ${publishTarget.version}」发布后将供新建学习路径使用，已在学用户的路径快照与完成记录不受影响。`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishTarget(null)}>
              取消
            </Button>
            <Button onClick={handlePublish} loading={publishing}>
              确认发布
            </Button>
          </>
        }
      />
    </>
  );
}

function FlagsTab({ flags, onAction }: { flags: ResourceFlag[]; onAction: (a: FlagAction) => void }) {
  if (flags.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-base font-medium text-ink">当前无待处理资源</p>
        <p className="mt-1 text-sm text-ink-2">资源校验完成后会回到这里。</p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {flags.map((f) => (
        <Card key={f.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-ink">{f.resourceTitle}</span>
                <Badge tone={GRADE_TONE[f.grade]}>{gradeLabel(f.grade)}</Badge>
              </div>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block max-w-full truncate text-xs text-ink-3 hover:text-ink"
                >
                  {f.url} ↗
                </a>
              ) : null}
            </div>
            <Badge tone={FLAG_STATUS[f.status].tone}>{FLAG_STATUS[f.status].label}</Badge>
          </div>

          <div className="mt-3 rounded-md border border-line bg-subtle px-3 py-2 text-sm">
            <p className="text-ink">
              <span className="text-ink-3">原因：</span>
              {f.reason}
            </p>
            {f.note ? (
              <p className="mt-1 text-ink-2">
                <span className="text-ink-3">备注：</span>
                {f.note}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-ink-3">提交于 {relativeTime(f.createdAt)}</p>
          </div>

          {f.resolutionNote ? <p className="mt-2 text-xs text-ink-3">处理说明：{f.resolutionNote}</p> : null}

          {f.status === "pending" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onAction({ flag: f, type: "approve" })}>
                通过
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onAction({ flag: f, type: "reject" })}>
                驳回
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onAction({ flag: f, type: "ignore" })}>
                忽略
              </Button>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function ReleasesTab({ releases, onPublish }: { releases: CurriculumRelease[]; onPublish: (r: CurriculumRelease) => void }) {
  return (
    <div className="space-y-3">
      {releases.map((r) => (
        <Card key={r.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-ink">{r.title}</span>
                <Badge tone="neutral">{r.version}</Badge>
                <Badge tone={RELEASE_STATUS[r.status].tone}>{RELEASE_STATUS[r.status].label}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-2">
                更新于 {relativeTime(r.updatedAt)} · 影响未来新路径约 {r.affectedNewPathEstimate} 个
                {r.affectedNewPathEstimate === 0 ? "（已在学路径不受影响）" : ""}
              </p>
            </div>
            {r.status === "published" ? null : (
              <Button size="sm" onClick={() => onPublish(r)}>
                发布
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function RulesTab() {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="px-4 py-3 font-medium">域名</th>
            <th className="px-4 py-3 font-medium">允许类型</th>
            <th className="px-4 py-3 font-medium">等级</th>
            <th className="px-4 py-3 font-medium">授权政策</th>
            <th className="px-4 py-3 font-medium">最近校验</th>
            <th className="px-4 py-3 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          {SOURCE_DOMAIN_RULES.map((rule) => (
            <tr key={rule.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-mono text-ink">{rule.domain}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {rule.allowedTypes.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={GRADE_TONE[rule.tier]}>{gradeLabel(rule.tier)}</Badge>
              </td>
              <td className="px-4 py-3 text-ink-2">{rule.licensePolicy}</td>
              <td className="px-4 py-3 text-ink-3">{relativeTime(rule.checkedAt)}</td>
              <td className="px-4 py-3">
                <Badge tone={RULE_STATUS[rule.reviewStatus].tone}>{RULE_STATUS[rule.reviewStatus].label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
