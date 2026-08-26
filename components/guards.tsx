/**
 * 路由守卫：鉴权、功能开关、角色。
 * 401 → 跳转登录并携带 returnTo；Flag 关闭 → 「功能暂未开放」而非 404；
 * 角色不符 → 403 说明原因，不泄露数据。
 */
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Flag, Role } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { Button, ButtonLink } from "@/components/ui";
import { ForbiddenState } from "@/components/states";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setAuthReturnTo = useAppStore((s) => s.setAuthReturnTo);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 水合完成前不重定向，避免把已持久化登录的用户弹回登录页
    if (!hydrated) return;
    if (!isAuthenticated) {
      setAuthReturnTo(pathname);
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAuthenticated, pathname, router, setAuthReturnTo]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-3">
        加载中…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // 跳转中
  }

  return <>{children}</>;
}

export function FeatureGate({ flag, title, description, children }: { flag: Flag; title?: string; description?: string; children: React.ReactNode }) {
  const enabled = useAppStore((s) => s.flags[flag]);
  const setFlag = useAppStore((s) => s.setFlag);

  if (!enabled) {
    return (
      <div className="pf-card flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-base font-medium text-ink">{title ?? "功能暂未开放"}</p>
        <p className="max-w-md text-sm text-ink-2">
          {description ?? "该模块在当前演示中尚未开启。你可以通过顶部「演示控制台」打开对应功能开关后重试。"}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/home" variant="secondary">返回首页</ButtonLink>
          <Button variant="ghost" onClick={() => setFlag(flag, true)}>在当前演示中开启</Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function RoleGate({ allowed, reason, children }: { allowed: Role[]; reason?: string; children: React.ReactNode }) {
  const role = useAppStore((s) => s.role);
  if (!allowed.includes(role)) {
    return (
      <ForbiddenState
        reason={
          reason ??
          `该页面仅对「${allowed
            .map((r) => (r === "content_admin" ? "内容管理员" : r === "org_admin" ? "机构管理员" : r))
            .join("、")}」开放，当前演示角色无权访问。`
        }
      />
    );
  }
  return <>{children}</>;
}
