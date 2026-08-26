/**
 * 演示数据聚合出口。
 * 页面只应从这里读取数据；角色相关的数据一律通过 profileFor / pathFor /
 * currentNodeFor / practiceSessionFor 等选择器取，保证按角色隔离。
 */
import type {
  KnowledgeNode,
  LearningPath,
  PracticeSession,
  Role,
  UserProfile,
} from "@/lib/types";
import { PRACTICE_ACTIVE, PRACTICE_DONE, PRACTICE_UNFINISHED, PATH_PM } from "./data";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, USER_PROFILES } from "./users";

export * from "./data";
export * from "./users";
export * from "./p1-data";
export * from "./p2-data";

/* ---------------- 角色选择器 ---------------- */

export function profileFor(role: Role): UserProfile {
  return USER_PROFILES[role];
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function roleDescription(role: Role): string {
  return ROLE_DESCRIPTIONS[role];
}

/** 学习中的角色返回主路径；无路径角色返回 null */
export function pathFor(role: Role): LearningPath | null {
  if (role === "learner" || role === "practice_learner") return PATH_PM;
  return null;
}

/** 学习中角色的当前节点；无路径或已完成返回 null */
export function currentNodeFor(role: Role): KnowledgeNode | null {
  const path = pathFor(role);
  if (!path || !path.currentNodeId) return null;
  return path.nodes.find((n) => n.id === path.currentNodeId) ?? null;
}

export function nodeById(path: LearningPath, nodeId: string): KnowledgeNode | null {
  return path.nodes.find((n) => n.id === nodeId) ?? null;
}

/** 练习中角色（周宁）返回未完成会话；其他角色返回 null */
export function practiceSessionFor(role: Role): PracticeSession | null {
  if (role === "practice_learner") return PRACTICE_UNFINISHED;
  return null;
}

const ALL_SESSIONS: PracticeSession[] = [PRACTICE_DONE, PRACTICE_ACTIVE, PRACTICE_UNFINISHED];

/** 按会话 ID 解析练习会话；未知 ID 返回 null */
export function resolvePracticeSession(sessionId: string): PracticeSession | null {
  return ALL_SESSIONS.find((s) => s.id === sessionId) ?? null;
}
