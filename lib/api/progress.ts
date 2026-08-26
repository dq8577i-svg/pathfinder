/**
 * 知径 Pathfinder — 学习进度 API 客户端（M7）
 */
import { api } from "./client";

export interface LearnerProgress {
  path: {
    exists: boolean;
    id?: string;
    title?: string;
    status?: string;
    completed?: number;
    total?: number;
    currentNodeId?: string | null;
    lastActivityAt?: string;
  };
  practice: { total: number; inProgress: number; completed: number; evaluations: number };
  notes: { total: number; selfAssessed: number; pending: number };
}

export async function getProgress(): Promise<LearnerProgress> {
  const d = await api<{ progress: LearnerProgress }>("/me/progress");
  return d.progress;
}
