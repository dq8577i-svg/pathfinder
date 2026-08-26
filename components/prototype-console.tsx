/**
 * 隐藏原型控制台：左下角「···」入口。
 * 用于切换演示角色 / 演示状态 / 功能开关，并展示当前 AI 引擎来源。
 * 纯演示辅助，不包含、不读取任何密钥。
 */
"use client";

import { useEffect } from "react";
import { ALL_FLAGS, FLAG_DEFAULTS } from "@/lib/types";
import type { DemoState, Flag, Role } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { roleLabel } from "@/lib/demo";
import { useAiEngineStatus } from "@/lib/hooks/use-ai";
import { Drawer } from "@/components/overlay";
import { Badge } from "@/components/ui";
import { AiNote, DemoTag } from "@/components/states";

const DEMO_STATES: { value: DemoState; label: string }[] = [
  { value: "normal", label: "正常" },
  { value: "offline", label: "离线" },
  { value: "ai_error", label: "AI 故障" },
  { value: "evidence_insufficient", label: "证据不足" },
  { value: "empty", label: "空状态" },
  { value: "forbidden", label: "无权限" },
];

const ROLES: Role[] = ["new_learner", "learner", "practice_learner", "content_admin", "org_admin"];

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md px-2 hover:bg-subtle">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-action" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

export function PrototypeConsole() {
  const open = useAppStore((s) => s.consoleOpen);
  const setOpen = useAppStore((s) => s.setConsoleOpen);
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const demoState = useAppStore((s) => s.demoState);
  const setDemoState = useAppStore((s) => s.setDemoState);
  const flags = useAppStore((s) => s.flags);
  const setFlag = useAppStore((s) => s.setFlag);
  const engine = useAiEngineStatus();

  useEffect(() => {
    if (open) engine.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {/* 悬浮入口 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="演示控制台"
        title="演示控制台"
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-md hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-2"
      >
        <span className="text-lg leading-none">···</span>
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="演示控制台" side="left" width="w-[22rem] max-w-[90vw]">
        <div className="space-y-6 p-4">
          <div className="rounded-md bg-subtle px-3 py-2 text-xs text-ink-2">
            演示辅助工具：切换角色、演示状态与功能开关。所有数据均为演示数据，不含真实密钥。
          </div>

          {/* AI 引擎 */}
          <section aria-label="AI 引擎">
            <h3 className="mb-2 text-sm font-semibold text-ink">AI 引擎</h3>
            <div className="flex items-center justify-between rounded-md border border-line px-3 py-2">
              {engine.info ? (
                <span className="text-sm text-ink">
                  {engine.info.isDemo ? (
                    <AiNote>Mock 演示引擎（无外发请求）</AiNote>
                  ) : (
                    <Badge tone="success">DeepSeek 已接入 · {engine.info.model ?? "deepseek-chat"}</Badge>
                  )}
                </span>
              ) : (
                <span className="text-sm text-ink-3">检测中…</span>
              )}
              <button type="button" onClick={engine.refresh} className="text-xs text-ink-2 hover:text-ink">
                刷新
              </button>
            </div>
          </section>

          {/* 角色 */}
          <section aria-label="演示角色">
            <h3 className="mb-2 text-sm font-semibold text-ink">演示角色</h3>
            <div className="space-y-1">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={role === r}
                  className={`flex min-h-[44px] w-full items-center justify-between rounded-md px-3 text-sm transition-colors hover:bg-subtle ${
                    role === r ? "bg-subtle font-medium text-ink" : "text-ink-2"
                  }`}
                >
                  <span>{roleLabel(r)}</span>
                  {role === r ? <span className="text-xs text-ink-3">当前</span> : null}
                </button>
              ))}
            </div>
          </section>

          {/* 演示状态 */}
          <section aria-label="演示状态">
            <h3 className="mb-2 text-sm font-semibold text-ink">演示状态</h3>
            <div className="flex flex-wrap gap-2">
              {DEMO_STATES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setDemoState(s.value)}
                  aria-pressed={demoState === s.value}
                  className={`min-h-[44px] rounded-md border px-3 text-sm transition-colors ${
                    demoState === s.value
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-surface text-ink-2 hover:bg-subtle"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* 功能开关 */}
          <section aria-label="功能开关">
            <h3 className="mb-2 text-sm font-semibold text-ink">功能开关</h3>
            <div className="space-y-0.5">
              {ALL_FLAGS.map((f) => (
                <Toggle key={f} checked={flags[f]} onChange={(v) => setFlag(f, v)} label={flagLabel(f)} />
              ))}
            </div>
          </section>

          {/* 重置 */}
          <section aria-label="重置">
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem("pf-store-v1");
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              className="min-h-[44px] w-full rounded-md border border-line bg-surface text-sm text-ink-2 hover:bg-subtle hover:text-ink"
            >
              重置演示并刷新
            </button>
          </section>

          <p className="text-xs text-ink-3">
            <DemoTag /> 本控制台仅影响前端演示状态。
          </p>
        </div>
      </Drawer>
    </>
  );
}

function flagLabel(flag: Flag): string {
  const map: Record<Flag, string> = {
    review_center: "复习中心",
    scenario_labs: "情境练习场",
    multi_path: "多路径",
    crews: "小队与同伴反馈",
    semantic_search: "语义搜索",
    tenant_workspace: "机构空间",
    skill_radar: "技能雷达",
    personal_library: "个人资料库",
    content_console: "内容运营台",
    learning_space: "学习空间",
    adaptive_plan: "自适应计划调整",
    portfolio: "作品集",
    peer_feedback: "同伴反馈",
  };
  return map[flag] ?? flag;
}

// 保持 FLAG_DEFAULTS 被引用，避免未使用告警
void FLAG_DEFAULTS;
