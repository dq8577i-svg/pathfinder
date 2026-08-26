/**
 * 设计系统原语（编辑式学习工作台 · Minimalism）。
 * 约定：主按钮纯黑 #18181B；点击目标 ≥44×44px；焦点态 2px #52525B；
 * 状态表达必须同时具备文字/图标/标签，不只用颜色。
 */
"use client";

import Link from "next/link";
import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Button ---------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed select-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-action text-white hover:bg-action-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-subtle",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-subtle",
  danger: "bg-danger text-white hover:bg-danger/90",
  dangerGhost: "bg-transparent text-danger border border-danger/40 hover:bg-danger-bg",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm min-w-[44px]",
  sm: "h-9 px-3 text-sm min-w-[36px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

export interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  external?: boolean;
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ariaLabel, external }: ButtonLinkProps) {
  const cls = cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

/* ---------------- Spinner ---------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-current", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- Card ---------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-surface border border-line rounded-lg", className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------------- Badge（状态必须带文字） ---------------- */

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: "bg-success-bg text-success border-success/20",
  warning: "bg-warning-bg text-warning border-warning/20",
  danger: "bg-danger-bg text-danger border-danger/20",
  neutral: "bg-subtle text-ink-2 border-line",
  info: "bg-subtle text-ink border-line-strong",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- 表单控件 ---------------- */

const FIELD_BASE =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 " +
  "focus:outline-none focus:ring-2 focus:ring-ink-2/30 focus:border-ink-2 disabled:opacity-50 min-h-[44px]";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(FIELD_BASE, "resize-y", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(FIELD_BASE, "appearance-none pr-8", className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------------- Tabs ---------------- */

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="页签" className={cn("flex flex-wrap gap-1 border-b border-line", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex h-11 items-center gap-1.5 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink-2",
              active ? "border-b-2 border-ink text-ink" : "border-b-2 border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span className={cn("rounded-md px-1.5 py-0.5 text-xs", active ? "bg-subtle text-ink-2" : "text-ink-3")}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- 进度条 ---------------- */

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "进度"}
        className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"
      >
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
      {label ? <span className="text-xs text-ink-2 whitespace-nowrap">{label}</span> : null}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("pf-skeleton rounded-md bg-subtle", className)} />;
}

/* ---------------- 分隔线 / 区块标题 ---------------- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-line", className)} />;
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------- 列表行 ---------------- */

export function ListRow({
  title,
  meta,
  description,
  right,
  onClick,
  asLink,
  href,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  asLink?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">{title}</span>
          {meta}
        </div>
        {description ? <p className="mt-0.5 text-sm text-ink-2 line-clamp-2">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-4 rounded-md px-3 py-3 text-left transition-colors",
    onClick || asLink ? "hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-2" : "",
  );
  if (asLink && href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
