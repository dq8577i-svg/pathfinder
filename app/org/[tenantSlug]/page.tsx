"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, StateBanner } from "@/components/shell";
import { Badge, Card, SectionHeading } from "@/components/ui";
import { DemoTag, ForbiddenState } from "@/components/states";
import { FeatureGate, RoleGate } from "@/components/guards";
import { useAppStore } from "@/lib/store";
import { TENANT } from "@/lib/demo";
import { formatDate } from "@/lib/utils";

export default function OrgHomePage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const demoState = useAppStore((s) => s.demoState);
  const tenant = tenantSlug === TENANT.slug ? TENANT : null;

  return (
    <FeatureGate flag="tenant_workspace" title="机构空间暂未开放" description="机构空间为机构成员提供品牌化入口与已发布路径。">
      <RoleGate allowed={["org_admin"]} reason="机构数据仅机构成员可见，当前演示角色无权访问。">
        {tenant ? (
          <>
            <PageHeader
              title={tenant.name}
              description={tenant.brandingNote}
              meta={
                <>
                  <Badge tone="info">我的角色：机构管理员</Badge>
                  <Badge tone="neutral">隐私政策 {tenant.policyVersion}</Badge>
                  <DemoTag />
                </>
              }
              actions={
                <Link
                  href={`/org/${tenant.slug}/admin`}
                  className="flex h-11 min-w-[44px] items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2"
                >
                  进入管理台
                </Link>
              }
            />
            <StateBanner state={demoState} />
            <OrgContent />
          </>
        ) : (
          <ForbiddenState reason="机构数据仅机构成员可见，当前演示角色无权访问。" />
        )}
      </RoleGate>
    </FeatureGate>
  );
}

function OrgContent() {
  return (
    <div className="space-y-5">
      {/* 课程计划 */}
      <Card className="p-4 sm:p-5">
        <SectionHeading title="课程计划" description="机构已发布路径与当前教学周。" />
        <ul className="mt-2 divide-y divide-line">
          {TENANT.programs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink">{p.title}</span>
                <span className="ml-2 text-ink-2">
                  {p.curriculumVersion} · {p.week}
                </span>
              </div>
              <Badge tone={p.enrolled ? "success" : "neutral"}>{p.enrolled ? "已加入" : "未加入"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* 公告 */}
      <Card className="p-4 sm:p-5">
        <SectionHeading title="机构公告" description="仅管理员发布；学习者可见本机构已发布公告。" />
        <ul className="mt-2 divide-y divide-line">
          {TENANT.announcements.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{a.title}</span>
                <span className="text-xs text-ink-3">{formatDate(a.publishedAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-2">{a.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* 聚合指标 */}
      <Card className="p-4 sm:p-5">
        <SectionHeading title="机构聚合指标" description="仅显示脱敏聚合数据；样本过小不展示，无法据此推断单个学习者。" />
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TENANT.aggregateMetrics.map((m) => (
            <div key={m.label} className="rounded-md bg-subtle p-3">
              <dt className="text-xs text-ink-3">{m.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{m.value}</dd>
              {m.suppressed ? <p className="mt-1 text-xs text-ink-3">因样本过小不展示（脱敏）</p> : null}
            </div>
          ))}
        </dl>
      </Card>

      {/* 成员列表（仅管理员可见） */}
      <Card className="p-4 sm:p-5">
        <SectionHeading title="机构成员" description="仅机构管理员可见成员列表。" />
        <ul className="mt-2 divide-y divide-line">
          {TENANT.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-ink">{m.name}</span>
                <span className="ml-2 text-ink-2">{m.role}</span>
              </div>
              <Badge tone={m.status === "active" ? "success" : "neutral"}>
                {m.status === "active" ? "正常" : "已停用"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
