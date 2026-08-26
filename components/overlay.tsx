/**
 * 浮层与反馈：Modal、Drawer、ConfirmDialog、Toast 视口、FocusTrap。
 * 语义化关闭：Esc 关闭、遮罩点击关闭、可聚焦元素受控。
 */
"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useAppStore } from "@/lib/store";

/* ---------------- FocusTrap ---------------- */

export function FocusTrap({ children, active }: { children: React.ReactNode; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", handleKey);
    const raf = requestAnimationFrame(() => focusables()[0]?.focus());
    return () => {
      node.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  return <div ref={ref}>{children}</div>;
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="关闭" className="pf-backdrop absolute inset-0 bg-black/40" onClick={onClose} tabIndex={-1} />
      <FocusTrap active>
        <div className={cn("relative w-full rounded-lg bg-surface p-5 shadow-xl", width)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭对话框"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-2"
            >
              ×
            </button>
          </div>
          {children ? <div className="mt-4">{children}</div> : null}
          {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
        </div>
      </FocusTrap>
    </div>
  );
}

/* ---------------- Drawer（移动端/侧栏） ---------------- */

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  width = "w-80",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title ?? "侧边抽屉"}>
      <button aria-label="关闭抽屉" className="pf-backdrop absolute inset-0 bg-black/40" onClick={onClose} tabIndex={-1} />
      <div
        className={cn(
          "absolute inset-y-0 flex flex-col bg-surface shadow-xl",
          side === "right" ? "right-0" : "left-0",
          width,
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="text-sm font-semibold text-ink">{title ?? ""}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭抽屉"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-3 hover:bg-subtle hover:text-ink"
          >
            ×
          </button>
        </div>
        <FocusTrap active>
          <div className="flex-1 overflow-y-auto pf-scroll-thin">{children}</div>
        </FocusTrap>
      </div>
    </div>
  );
}

/* ---------------- ConfirmDialog ---------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ---------------- Toast ---------------- */

export function ToastViewport() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full items-center gap-2 rounded-md border bg-surface px-4 py-3 text-sm shadow-lg",
            t.type === "success" && "border-success/30 text-success",
            t.type === "error" && "border-danger/30 text-danger",
            t.type === "warning" && "border-warning/30 text-warning",
            t.type === "info" && "border-line-strong text-ink-2",
          )}
        >
          <span className="shrink-0">{t.type === "error" ? "×" : t.type === "warning" ? "!" : "✓"}</span>
          <span className="flex-1 text-ink">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="关闭提示"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-subtle hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
