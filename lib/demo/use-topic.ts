"use client";
/**
 * 知径 Pathfinder — demo 模式主题数据包读写 hook（client only）
 *
 * 读取 onboarding 写入的 pf-onboarded（含 bundle）；旧 payload（无 bundle）用 goal 现场重派生迁移。
 * 仅 new_learner 角色在 demo 模式读取；演示角色 / guest 一律返回 null（保持角色演示秀）。
 * 全部 localStorage 访问在 effect 内完成，SSR/首帧 ready=false，杜绝非 PM 主题下闪现 PM 数据。
 */
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { isApiMode } from "@/lib/data-source";
import { buildDemoTopicBundle, type DemoTopicBundle } from "./topic";

const STORAGE_KEY = "pf-onboarded";

interface OnboardedPayload {
  version?: number;
  goal?: {
    topic?: string;
    goal?: string;
    currentLevel?: string;
    weeklyHours?: number;
    deadlineWeeks?: number;
    preferences?: string[];
  };
  generatedAt?: string;
  title?: string;
  bundle?: DemoTopicBundle;
}

/** 解析并校验 pf-onboarded；旧 payload 无 bundle 时用 goal 现场重派生（迁移） */
export function readDemoTopicBundle(): DemoTopicBundle | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as OnboardedPayload;
    const topic = payload.goal?.topic?.trim();
    if (!topic) return null;
    if (payload.bundle && payload.bundle.path?.nodes?.length > 0) {
      return payload.bundle;
    }
    const goal = {
      topic,
      goal: payload.goal?.goal ?? "",
      currentLevel: payload.goal?.currentLevel || "零基础",
      weeklyHours: payload.goal?.weeklyHours ?? 5,
      deadlineWeeks: payload.goal?.deadlineWeeks ?? 12,
      preferences: payload.goal?.preferences ?? [],
    };
    return buildDemoTopicBundle(goal);
  } catch {
    return null;
  }
}

/** 把 bundle 写回 pf-onboarded（含 goal / title，保持旧读取方兼容） */
export function writeDemoTopicBundle(b: DemoTopicBundle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        goal: b.goal,
        generatedAt: b.generatedAt,
        title: b.title,
        bundle: b,
      }),
    );
  } catch {
    /* ignore storage failure */
  }
}

export interface DemoTopicState {
  data: DemoTopicBundle | null;
  /** 等 store 水合 + localStorage 读取完成后再为 true；此前渲染 LoadingState */
  ready: boolean;
  /** 更新并持久化 bundle（资料库新增等） */
  updateBundle: (b: DemoTopicBundle) => void;
}

export function useDemoTopic(): DemoTopicState {
  const role = useAppStore((s) => s.role);
  const hydrated = useAppStore((s) => s.hydrated);
  const [data, setData] = useState<DemoTopicBundle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      setData(!isApiMode && role === "new_learner" ? readDemoTopicBundle() : null);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, role]);

  const updateBundle = useCallback((b: DemoTopicBundle) => {
    setData(b);
    writeDemoTopicBundle(b);
  }, []);

  return { data, ready, updateBundle };
}
