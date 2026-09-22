/**
 * 客户端 AI 调用 Hook。
 * 只与 /api/ai/chat 通信；密钥永远不进入前端。
 * 演示态 state=ai_error 时模拟失败，供页面渲染「AI 暂不可用」失败状态。
 */
"use client";

import { useCallback, useState } from "react";
import type { AiChatRequest, AiChatResult } from "@/lib/ai/types";
import { useAppStore } from "@/lib/store";

export type AiEngineInfo = { provider: "demo" | "deepseek"; model?: string; isDemo: boolean };

export function useAiChat() {
  const demoState = useAppStore((s) => s.demoState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (req: AiChatRequest): Promise<AiChatResult> => {
      if (demoState === "ai_error") {
        // 演示态：模拟真实失败，前端渲染失败状态而非真实请求
        await new Promise((r) => setTimeout(r, 300));
        setError("ai_unavailable");
        throw new Error("ai_unavailable");
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data) {
          const errorCode = typeof json?.error === "string" ? json.error : json?.error?.code;
          throw new Error(errorCode === "AI_UNAVAILABLE" || errorCode === "ai_unavailable" ? "ai_unavailable" : "request_failed");
        }
        return json.data as AiChatResult;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "request_failed";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [demoState],
  );

  return { send, loading, error };
}

/** 读取当前 AI 引擎来源（原型控制台展示用）。失败时静默返回 demo。 */
export function useAiEngineStatus() {
  const [info, setInfo] = useState<AiEngineInfo | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/status");
      const json = await res.json();
      setInfo(json?.data ?? null);
    } catch {
      setInfo({ provider: "demo", model: "mock", isDemo: true });
    }
  }, []);
  return { info, refresh };
}
