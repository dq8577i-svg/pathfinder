/**
 * 通用工具：className 合并、Mock 网络延迟/失败模拟、日期与格式化、演示状态短路。
 * 演示数据统一由 mockFetch 返回；离线/故障状态由 demoState 驱动，不伪造成功。
 */
import type { DemoState } from "@/lib/types";

/* ---------------- className ---------------- */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- 延时与 Mock 请求 ---------------- */

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface MockFetchOptions {
  /** 延迟区间（ms） */
  latency?: [number, number];
  /** 模拟失败率 0..1 */
  failRate?: number;
}

/**
 * 模拟一次网络请求：可配置延迟与失败率。
 * 调用方如需按 demoState 强制失败，请用 throwByState。
 */
export async function mockFetch<T>(
  data: T | (() => T),
  opts?: MockFetchOptions,
): Promise<T> {
  const [min, max] = opts?.latency ?? [250, 550];
  await delay(rand(min, max));
  if (opts?.failRate && Math.random() < opts.failRate) {
    throw new Error("network_error");
  }
  return typeof data === "function" ? (data as () => T)() : data;
}

/** 按演示状态短路抛错：offline → 网络失败；ai_error → AI 暂不可用。其余状态放行。 */
export function throwByState(state: DemoState): void {
  if (state === "offline") throw new Error("network_error");
  if (state === "ai_error") throw new Error("ai_unavailable");
  if (state === "forbidden") throw new Error("forbidden");
}

/* ---------------- 日期与格式化 ---------------- */

export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
export const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
export const iso = (d: Date) => d.toISOString();

export function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${formatDate(isoStr)} ${hm}`;
}

/** 相对时间：x 分钟前 / x 小时前 / x 天前 / 具体日期 */
export function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(isoStr);
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
}

/* ---------------- 演示标签 ---------------- */

export const DEMO_TAG = "演示数据";
export const AI_DEMO_LABEL = "AI 整理（演示）";

/** 按分级返回证据等级徽标文案（A/B/C） */
export function gradeLabel(grade: "A" | "B" | "C"): string {
  return `资料等级 ${grade}`;
}
