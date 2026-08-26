/**
 * 页面级状态组件：加载、空、错误、离线、无权限，以及演示标识。
 * 关键约定：所有状态必须带文字说明，不只用颜色/图标。
 */
"use client";

import { cn } from "@/lib/utils";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { DATA_SOURCE_LABEL, isApiMode } from "@/lib/data-source";

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-ink-2" role="status">
      <Spinner className="size-6" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  icon?: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
      {icon ? <div className="text-3xl text-ink-3" aria-hidden="true">{icon}</div> : null}
      <p className="text-base font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <ButtonLink href={action.href} variant="secondary" className="mt-2">{action.label}</ButtonLink> : null}
    </div>
  );
}

export function ErrorState({
  title = "暂时无法加载",
  description = "请稍后重试，或返回上一页。",
  retry,
  backTo,
  backLabel = "返回",
}: {
  title?: string;
  description?: string;
  retry?: () => void;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-sm text-danger" role="alert">加载失败</div>
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm text-ink-2">{description}</p>
      <div className="mt-2 flex gap-2">
        {retry ? (
          <Button variant="secondary" onClick={retry}>
            重试
          </Button>
        ) : null}
        {backTo ? <ButtonLink href={backTo} variant="ghost">{backLabel}</ButtonLink> : null}
      </div>
    </div>
  );
}

export function OfflineState({ description = "当前为离线演示状态，写入操作不会保存到云端。" }: { description?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
      <span aria-hidden="true">!</span>
      <span>当前离线演示</span>
      <span className="text-ink-2">· {description}</span>
    </div>
  );
}

export function ForbiddenState({ reason = "你没有访问该内容的权限。" }: { reason?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
      <div className="text-sm text-danger">无权访问</div>
      <p className="text-base font-medium text-ink">{reason}</p>
      <p className="max-w-sm text-sm text-ink-2">如需访问，请联系机构管理员或切换到对应演示角色。</p>
    </div>
  );
}

/* ---------------- 演示标识 ---------------- */

export function DemoTag({ className, children = DATA_SOURCE_LABEL }: { className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("pf-demo-tag", className)} aria-label={typeof children === "string" ? children : DATA_SOURCE_LABEL}>
      {children}
    </span>
  );
}

/** AI 内容统一标注：真实引擎接入时展示引擎名（api 模式）；demo 模式保留原标注 */
export function AiNote({
  children = isApiMode ? "AI 生成" : "AI 整理（演示）",
  className,
}: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("pf-ai-note", className)}>{children}</span>;
}
