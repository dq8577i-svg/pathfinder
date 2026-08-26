/**
 * 知径 Pathfinder — 练习 API 客户端（M7）
 */
import { api, apiOrNull } from "./client";
import type { PracticeFeedback, PracticeMessage, PracticeSession } from "@/lib/types";

export interface PracticeSessionDetail {
  session: PracticeSession;
  feedback: PracticeFeedback | null;
}

export async function createPracticeSession(input: {
  nodeId: string;
  pathId?: string;
}): Promise<PracticeSession> {
  const d = await api<{ session: PracticeSession }>("/practice/sessions", { method: "POST", body: input });
  return d.session;
}

export async function getPracticeSession(sessionId: string): Promise<PracticeSessionDetail | null> {
  const d = await apiOrNull<PracticeSessionDetail>(
    `/practice/sessions/${encodeURIComponent(sessionId)}`,
  );
  return d;
}

export async function sendPracticeMessage(
  sessionId: string,
  input: { content: string; clientId?: string },
): Promise<{ userMessage: PracticeMessage; aiMessage: PracticeMessage; idempotent?: boolean }> {
  return api(`/practice/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    body: input,
  });
}

export async function evaluatePracticeSession(
  sessionId: string,
): Promise<{ feedback: PracticeFeedback; idempotent?: boolean }> {
  return api(`/practice/sessions/${encodeURIComponent(sessionId)}/evaluate`, { method: "POST" });
}

export async function patchPracticeSession(
  sessionId: string,
  patch: { draft?: string; draftSavedAt?: string; syncState?: "saved" | "local_only" | "unsynced"; status?: "abandoned" },
): Promise<PracticeSessionDetail | null> {
  return apiOrNull(`/practice/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: patch,
  });
}
