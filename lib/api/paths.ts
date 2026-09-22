/**
 * 知径 Pathfinder — 学习路径 API 客户端（M7 / 通用学习规划阶段）
 */
import { api, apiOrNull } from "./client";
import type { LearningPath } from "@/lib/types";
import type { LearningGoalInput } from "@/lib/plan/goal";

export async function listPaths(): Promise<LearningPath[]> {
  const d = await api<{ paths: LearningPath[] }>("/paths");
  return d.paths;
}

export async function getPath(pathId: string): Promise<LearningPath | null> {
  const d = await apiOrNull<{ path: LearningPath }>(`/paths/${encodeURIComponent(pathId)}`);
  return d ? d.path : null;
}

export type UpdatePathInput = {
  title?: string;
  weeklyHours?: number;
  deadline?: string;
  status?: "in_progress" | "paused" | "completed" | "archived";
  setPrimary?: boolean;
};

export async function updatePath(pathId: string, input: UpdatePathInput): Promise<LearningPath> {
  const d = await api<{ path: LearningPath }>(`/paths/${encodeURIComponent(pathId)}`, {
    method: "PATCH",
    body: input,
  });
  return d.path;
}

/** 无状态预览（POST /paths/preview），不写库 */
export async function previewPath(goal: LearningGoalInput): Promise<LearningPath> {
  const d = await api<{ preview: LearningPath }>("/paths/preview", { method: "POST", body: goal });
  return d.preview;
}

/** 确认路径（POST /paths/confirm）。第一条为主路径，后续路径并行保留；并发异常才返回 conflict。 */
export async function confirmPath(
  goal: LearningGoalInput,
  previewId?: string,
): Promise<LearningPath | { conflict: string }> {
  try {
    const body = previewId ? { goal, previewId } : goal;
    const d = await api<{ path: LearningPath }>("/paths/confirm", { method: "POST", body });
    return d.path;
  } catch (e) {
    if (e instanceof Error && "status" in e && (e as { status: number }).status === 409) {
      return { conflict: (e as unknown as { code?: string }).code ?? "CONFLICT" };
    }
    throw e;
  }
}
