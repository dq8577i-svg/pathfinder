/**
 * 知径 Pathfinder — 客户端数据加载 Hook（M7）
 *
 * useAsync：通用「加载中 / 数据 / 错误 / 重载」状态机，供页面在
 * DATA_SOURCE=api 时异步拉取真实数据，加载期间渲染 Skeleton，失败渲染空态。
 * 依赖变化（deps）自动重载；reload 手动重试。
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiMode } from "@/lib/data-source";
import { listPaths } from "@/lib/api/paths";
import type { LearningPath } from "@/lib/types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  opts: { enabled?: boolean } = {},
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [tick, setTick] = useState(0);
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef.current()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** 未登录视为空数据（refresh 场景），其余错误透传 */
export function useAsyncAuth<T>(
  fn: () => Promise<T | null>,
  deps: unknown[] = [],
): AsyncState<T> {
  return useAsync(async () => (await fn()) ?? (null as unknown as T), deps);
}

export interface CurrentPathState {
  pathId: string | null;
  paths: LearningPath[];
  loading: boolean;
  reload: () => void;
}

/** 读取多路径「当前路径」选择（localStorage pf-active-path 优先） */
function readActivePathId(): string | null {
  try {
    return window.localStorage.getItem("pf-active-path");
  } catch {
    return null;
  }
}

/** 从路径列表解析「当前路径」id：localStorage 选择优先，否则主路径，否则第一条 */
export function resolveActivePathId(paths: LearningPath[]): string | null {
  if (paths.length === 0) return null;
  const override = readActivePathId();
  if (override && paths.some((p) => p.id === override)) return override;
  return paths.find((p) => p.isPrimary)?.id ?? paths[0].id;
}

/**
 * 当前用户当前路径（api 模式）。各主题绑定模块（技能/复习/练习/作品集…）共用，
 * 确保全产品数据链绑定到同一条「当前学习路径」。paths 供路径选择器渲染选项。
 */
export function useCurrentPathId(): CurrentPathState {
  const { data, loading, reload } = useAsync<{ paths: LearningPath[]; activeId: string | null }>(
    async () => {
      const list = await listPaths();
      return { paths: list, activeId: resolveActivePathId(list) };
    },
    [],
    { enabled: isApiMode },
  );
  return { pathId: data?.activeId ?? null, paths: data?.paths ?? [], loading, reload };
}
