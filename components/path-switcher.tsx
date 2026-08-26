"use client";

import { Badge } from "@/components/ui";
import type { LearningPath } from "@/lib/types";

/**
 * 多路径「当前路径」选择器（api 模式）。
 * 切换后写入 localStorage pf-active-path，由调用方触发 useCurrentPathId 重新解析，
 * 技能/复习/练习/作品集等模块随之绑定新路径。仅一条路径时不显示。
 */
export function PathSwitcher({
  pathId,
  paths,
  onChange,
  label = "当前路径",
}: {
  pathId: string | null;
  paths: LearningPath[];
  onChange: (id: string) => void;
  label?: string;
}) {
  if (paths.length <= 1) return null;
  const current = paths.find((p) => p.id === pathId) ?? null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-line bg-subtle/40 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-ink-2">{label}</span>
      <select
        value={pathId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="切换当前学习路径"
        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-2 focus:outline-offset-1 focus:outline-ink-2"
      >
        {!pathId ? <option value="">选择路径…</option> : null}
        {paths.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.isPrimary ? " · 主路径" : ""}
          </option>
        ))}
      </select>
      {current ? (
        <Badge tone={current.isPrimary ? "success" : "info"}>
          {current.isPrimary ? "主路径" : "当前路径"}
        </Badge>
      ) : null}
    </div>
  );
}
