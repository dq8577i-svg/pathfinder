/**
 * AppShell：桌面 Topbar 56px + Sidebar 240px + 移动端抽屉；内容区最大 1200px。
 * 导航按功能开关（flag）与角色过滤。
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenText,
  Briefcase,
  Buildings,
  Command,
  GearSix,
  House,
  List,
  MagnifyingGlass,
  Notebook,
  Path,
  PresentationChart,
  Repeat,
  SignOut,
  Sparkle,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import type { Flag } from "@/lib/types";
import { Badge, Input } from "@/components/ui";
import { Drawer, Modal } from "@/components/overlay";
import { DemoTag } from "@/components/states";
import { ThemeToggle } from "@/components/theme";
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
  icon: React.ElementType;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "主流程",
    items: [
      { label: "首页", href: "/home", icon: House },
      { label: "学习路径", href: "/path", icon: Path },
      { label: "费曼笔记", href: "/notes", icon: Notebook },
    ],
  },
  {
    label: "强化学习",
    items: [
      { label: "复习中心", href: "/review", flag: "review_center", icon: Repeat },
      { label: "情境练习场", href: "/labs", flag: "scenario_labs", icon: Sparkle },
      { label: "技能雷达", href: "/skills", flag: "skill_radar", icon: PresentationChart },
      { label: "个人资料库", href: "/library", flag: "personal_library", icon: BookOpenText },
      { label: "内容运营台", href: "/admin/content", flag: "content_console", roles: ["content_admin"], icon: SquaresFour },
    ],
  },
  {
    label: "空间与协作",
    items: [
      { label: "学习空间", href: "/space", flag: "learning_space", icon: SquaresFour },
      { label: "多路径", href: "/paths", flag: "multi_path", icon: Path },
      { label: "小队", href: "/crews", flag: "crews", icon: UsersThree },
      { label: "作品集", href: "/portfolio", flag: "portfolio", icon: Briefcase },
      { label: "语义搜索", href: "/search", flag: "semantic_search", icon: MagnifyingGlass },
      { label: "机构空间", href: `/org/${TENANT.slug}`, flag: "tenant_workspace", roles: ["org_admin"], icon: Buildings },
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

function Topbar({ onOpenNav, onOpenCommand }: { onOpenNav: () => void; onOpenCommand: () => void }) {
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
    <header className="sticky top-0 z-40 h-[72px] border-b border-line bg-[var(--pf-header)] backdrop-blur-xl">
      <div className="flex h-full items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="打开导航"
          className="pf-interactive flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-subtle md:hidden"
        >
          <List size={21} />
        </button>

        <Link href="/home" className="flex min-w-[150px] items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-subtle text-action">
            <Path size={19} weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold tracking-tight text-ink">知径 Pathfinder</span>
            <span className="hidden text-[10px] tracking-wide text-ink-3 xl:block">PERSONAL LEARNING OS</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenCommand}
          className="pf-command-surface mx-auto hidden h-11 min-w-0 max-w-[600px] flex-1 items-center gap-3 rounded-lg px-4 text-left text-sm text-ink-2 md:flex"
          aria-label="打开全局搜索和快捷操作"
        >
          <MagnifyingGlass size={17} />
          <span className="truncate">搜索、提问或切换路径…</span>
          <kbd className="ml-auto inline-flex items-center gap-1 rounded border border-line bg-subtle px-2 py-1 font-mono text-[11px] text-ink-2">
            <Command size={12} /> K
          </kbd>
        </button>

        <div className="flex-1 md:hidden" />

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
          className="pf-interactive hidden h-11 items-center gap-1.5 rounded-md px-2 text-xs text-ink-2 hover:bg-subtle lg:flex"
          aria-label="打开演示控制台"
        >
          演示控制台
        </button>

        <ThemeToggle compact />

        <div className="flex h-11 items-center gap-2 rounded-md px-1 sm:px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-subtle text-sm font-medium text-ink" aria-hidden="true">
            {profile.displayName.slice(0, 1)}
          </div>
          <span className="hidden text-sm text-ink sm:inline">{profile.displayName}</span>
          <span className="hidden xl:inline"><DemoTag /></span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="pf-interactive hidden h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-2 hover:bg-subtle hover:text-ink lg:flex"
          aria-label="退出登录"
        >
          <SignOut size={16} /> 退出
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
    <nav aria-label="主导航" className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-3">{group.label}</p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "pf-interactive group flex h-11 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-medium",
                      active
                        ? "border-line bg-[var(--pf-active-soft)] text-ink shadow-sm"
                        : "text-ink-2 hover:bg-[var(--pf-hover)] hover:text-ink",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} weight={active ? "fill" : "regular"} className={active ? "text-action" : "text-ink-3 group-hover:text-action"} />
                    <span className="flex-1">{item.label}</span>
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const pathname = usePathname();
  const role = useAppStore((s) => s.role);
  const flags = useAppStore((s) => s.flags);
  const commandItems = useMemo(
    () => visibleNavGroups(role, flags).flatMap((group) => group.items),
    [flags, role],
  );
  const filteredCommands = commandItems.filter((item) =>
    item.label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 落地页（落地页/登录/注册）与费曼专注模式对话页不套用工作台外壳
  const isLanding = pathname === "/" || pathname === "/login" || pathname === "/register";
  const isFocus = /^\/practice\/[^/]+$/.test(pathname);
  if (isLanding || isFocus) return <>{children}</>;

  return (
    <div className="pf-app-canvas min-h-screen bg-canvas">
      <Topbar onOpenNav={() => setMobileNavOpen(true)} onOpenCommand={() => setCommandOpen(true)} />

      <div className="flex">
        <aside className="hidden w-[184px] shrink-0 border-r border-line bg-[var(--pf-sidebar)] backdrop-blur-xl md:block">
          <div className="sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto p-3 pf-scroll-thin">
            <SidebarNav />
            <div className="mt-6 border-t border-line pt-3">
              <Link href="/home" className="pf-interactive flex h-11 items-center gap-3 rounded-md px-3 text-sm text-ink-2 hover:bg-subtle hover:text-ink">
                <GearSix size={18} className="text-ink-3" /> 设置
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 md:py-7 xl:px-8">{children}</div>
        </main>
      </div>

      <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="导航" side="left" width="w-72">
        <div className="p-3">
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Drawer>

      <Modal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        title="搜索与快捷操作"
        description="输入页面名称，或使用快捷入口继续学习。"
        width="max-w-xl"
      >
        <Input
          autoFocus
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder="搜索学习路径、资料或功能…"
          aria-label="搜索功能"
        />
        <div className="mt-3 max-h-80 overflow-y-auto pf-scroll-thin">
          {filteredCommands.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCommandOpen(false)}
                className="pf-interactive flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-ink-2 hover:bg-subtle hover:text-ink"
              >
                <Icon size={18} className="text-action" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/onboarding"
            onClick={() => setCommandOpen(false)}
            className="pf-interactive mt-2 flex min-h-11 items-center gap-3 border-t border-line px-3 pt-2 text-sm font-medium text-action"
          >
            <Sparkle size={18} /> 创建新的学习路径
          </Link>
        </div>
      </Modal>
    </div>
  );
}
