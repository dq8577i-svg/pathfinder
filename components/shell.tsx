/**
 * AppShell：桌面 Topbar 56px + Sidebar 240px + 移动端抽屉；内容区最大 1200px。
 * 导航按功能开关（flag）与角色过滤。
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import type { Flag } from "@/lib/types";
import { Badge } from "@/components/ui";
import { Drawer } from "@/components/overlay";
import { DemoTag } from "@/components/states";
import { TENANT } from "@/lib/demo";
import { isApiMode } from "@/lib/data-source";

/* ---------------- 导航配置 ---------------- */

export interface NavItem {
  label: string;
  href: string;
  flag?: Flag;
  /** 仅指定角色可见（其余角色隐藏） */
  roles?: Role[];
  /** 内容管理员等专用页在导航上高亮标识 */
  adminOnly?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "主流程",
    items: [
      { label: "首页", href: "/home" },
      { label: "学习路径", href: "/path" },
      { label: "费曼笔记", href: "/notes" },
    ],
  },
  {
    label: "强化学习",
    items: [
      { label: "复习中心", href: "/review", flag: "review_center" },
      { label: "情境练习场", href: "/labs", flag: "scenario_labs" },
      { label: "技能雷达", href: "/skills", flag: "skill_radar" },
      { label: "个人资料库", href: "/library", flag: "personal_library" },
      { label: "内容运营台", href: "/admin/content", flag: "content_console", roles: ["content_admin"] },
    ],
  },
  {
    label: "空间与协作",
    items: [
      { label: "学习空间", href: "/space", flag: "learning_space" },
      { label: "多路径", href: "/paths", flag: "multi_path" },
      { label: "小队", href: "/crews", flag: "crews" },
      { label: "作品集", href: "/portfolio", flag: "portfolio" },
      { label: "语义搜索", href: "/search", flag: "semantic_search" },
      { label: "机构空间", href: `/org/${TENANT.slug}`, flag: "tenant_workspace", roles: ["org_admin"] },
    ],
  },
];

export function visibleNavGroups(role: Role, flags: Record<Flag, boolean>) {
  return NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter(
      (item) =>
        (!item.flag || flags[item.flag]) &&
        (!item.roles || item.roles.includes(role)),
    ),
  })).filter((g) => g.items.length > 0);
}

/* ---------------- Topbar ---------------- */

function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const profile = useAppStore((s) => s.profile);
  const demoState = useAppStore((s) => s.demoState);
  const signOut = useAppStore((s) => s.signOut);
  const logout = useAppStore((s) => s.logout);
  const router = useRouter();

  async function handleLogout() {
    try {
      if (isApiMode) await signOut();
      else logout();
    } finally {
      router.replace("/login");
    }
  }
  const setDemoState = useAppStore((s) => s.setDemoState);
  const setConsoleOpen = useAppStore((s) => s.setConsoleOpen);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-line bg-surface">
      <div className="flex h-full items-center gap-3 px-4">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="打开导航"
          className="flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-subtle md:hidden"
        >
          <span className="text-xl leading-none">☰</span>
        </button>

        <Link href="/home" className="flex min-w-0 items-center gap-2">
          <span className="text-base font-semibold tracking-tight text-ink">知径 Pathfinder</span>
        </Link>

        <div className="flex-1" />

        {demoState !== "normal" ? (
          <button
            type="button"
            onClick={() => setDemoState("normal")}
            className="hidden h-11 items-center gap-1.5 rounded-md px-2 text-xs text-warning hover:bg-warning-bg sm:flex"
            title="点击恢复正常演示状态"
          >
            <Badge tone="warning">演示态 · {demoState === "offline" ? "离线" : demoState === "ai_error" ? "AI 故障" : demoState}</Badge>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setConsoleOpen(true)}
          className="hidden h-11 items-center gap-1.5 rounded-md px-2 text-xs text-ink-2 hover:bg-subtle sm:flex"
          aria-label="打开演示控制台"
        >
          演示控制台
        </button>

        <div className="flex h-11 items-center gap-2 rounded-md px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-medium text-white" aria-hidden="true">
            {profile.displayName.slice(0, 1)}
          </div>
          <span className="hidden text-sm text-ink sm:inline">{profile.displayName}</span>
          <DemoTag />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="hidden h-11 items-center rounded-md px-3 text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink sm:flex"
          aria-label="退出登录"
        >
          退出
        </button>
      </div>
    </header>
  );
}

/* ---------------- Sidebar ---------------- */

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const role = useAppStore((s) => s.role);
  const flags = useAppStore((s) => s.flags);
  const pathname = usePathname();
  const groups = visibleNavGroups(role, flags);

  return (
    <nav aria-label="主导航" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-medium text-ink-3">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex h-11 items-center justify-between rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2",
                      active ? "bg-subtle text-ink" : "text-ink-2 hover:bg-subtle hover:text-ink",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                    {item.roles ? <span className="text-[10px] text-ink-3">管理</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ---------------- PageHeader ---------------- */

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------- 演示状态横幅 ---------------- */

export function StateBanner({ state }: { state?: string }) {
  const demoState = useAppStore((s) => s.demoState);
  const current = state ?? demoState;
  if (current === "normal") return null;
  const map: Record<string, { label: string; text: string }> = {
    offline: { label: "当前离线演示", text: "写入操作不会保存到云端，恢复联网后可同步。" },
    ai_error: { label: "AI 暂不可用", text: "当前演示模拟 AI 服务故障，已回退到本地兜底。" },
    evidence_insufficient: { label: "证据不足", text: "该节点缺少可解释的公开资料证据。" },
    empty: { label: "空状态", text: "当前没有可展示的内容。" },
    forbidden: { label: "无权限", text: "当前演示角色无权访问该内容。" },
  };
  const item = map[current];
  if (!item) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
      <span aria-hidden="true">!</span>
      <span className="font-medium">{item.label}</span>
      <span className="text-ink-2">· {item.text}</span>
    </div>
  );
}

/* ---------------- 兼容导出（旧 stub 引用，页面重写后由子代理移除） ---------------- */

export const Shell = AppShell;

/* ---------------- AppShell ---------------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // 落地页（落地页/登录/注册）与费曼专注模式对话页不套用工作台外壳
  const isLanding = pathname === "/" || pathname === "/login" || pathname === "/register";
  const isFocus = /^\/practice\/[^/]+$/.test(pathname);
  if (isLanding || isFocus) return <>{children}</>;

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar onOpenNav={() => setMobileNavOpen(true)} />

      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto pf-scroll-thin p-3">
            <SidebarNav />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>

      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="导航" side="left" width="w-72">
        <div className="p-3">
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Drawer>
    </div>
  );
}
