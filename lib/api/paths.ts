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

/** 无状态预览（POST /paths/preview），不写库 */
export async function previewPath(goal: LearningGoalInput): Promise<LearningPath> {
  const d = await api<{ preview: LearningPath }>("/paths/preview", { method: "POST", body: goal });
  return d.preview;
}

/** 确认路径（POST /paths/confirm）。已存在主路径 → 返回 { conflict: code } */
export async function confirmPath(
  goal: LearningGoalInput,
): Promise<LearningPath | { conflict: string }> {
  try {
    const d = await api<{ path: LearningPath }>("/paths/confirm", { method: "POST", body: goal });
    return d.path;
  } catch (e) {
    if (e instanceof Error && "status" in e && (e as { status: number }).status === 409) {
      return { conflict: (e as unknown as { code?: string }).code ?? "CONFLICT" };
    }
    throw e;
  }
}
