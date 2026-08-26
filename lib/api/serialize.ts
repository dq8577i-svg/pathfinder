/**
 * 知径 Pathfinder — DB 行 → API/领域形状 序列化（M3）
 *
 * 只做字段映射，不做业务判断。形状对齐 lib/types.ts（KnowledgeNode /
 * ResourceEvidence / LearningPath / PathRationale / PlanVersion）。
 * 数据来源始终是 PostgreSQL pathfinder，不以 lib/demo/* 为 runtime 数据源。
 */
import type {
  AccessibilityStatus,
  FeynmanNote,
  Grade,
  KnowledgeNode,
  LearningPath,
  NodeStatus,
  PathRationale,
  PlanVersion,
  PracticeFeedback,
  PracticeMessage,
  PracticeSession,
  ResourceEvidence,
  ResourceType,
} from "@/lib/types";
import type {
  feynmanNotes,
  knowledgeNodes,
  learningPaths,
  practiceEvaluations,
  practiceMessages,
  practiceSessions,
  resources,
} from "@/lib/db/schema";

/** ResourceEvidence：resources 行 → 领域对象 */
export function serializeResource(r: typeof resources.$inferSelect): ResourceEvidence {
  return {
    id: r.id,
    title: r.title,
    domain: r.domain,
    grade: r.grade as Grade,
    sourceType: r.sourceType as ResourceType,
    sourceName: r.sourceName,
    checkedAt: r.checkedAt?.toISOString() ?? "",
    retrievedAt: r.retrievedAt?.toISOString() ?? "",
    reason: r.reason,
    url: r.url,
    accessibilityStatus: r.accessibilityStatus as AccessibilityStatus,
    licenseNote: r.licenseNote ?? "",
  };
}

/** KnowledgeNode：knowledge_nodes 行 + 资源列表（pathStatus 覆盖课程基础状态） */
export function serializeNode(
  n: typeof knowledgeNodes.$inferSelect,
  nodeResources: ResourceEvidence[],
  pathStatus?: NodeStatus,
): KnowledgeNode {
  return {
    id: n.id,
    title: n.title,
    chapter: n.chapter,
    sequence: n.sequence,
    status: pathStatus ?? (n.status as NodeStatus),
    prerequisiteIds: (n.prerequisites ?? []) as string[],
    estimatedMinutes: n.estimatedMinutes,
    capabilityGoal: n.capabilityGoal,
    completionCriteria: (n.completionCriteria ?? []) as string[],
    evidenceCoverage: (n.evidenceCoverage ?? {}) as KnowledgeNode["evidenceCoverage"],
    resources: nodeResources,
    ...(n.scenario ? { scenario: n.scenario } : {}),
    ...(n.curriculumSection ? { curriculumSection: n.curriculumSection } : {}),
  };
}

/** 路径列表项（GET /paths）：不含 nodes/rationale 的轻量形状 */
export function serializePathSummary(p: typeof learningPaths.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    status: p.status as LearningPath["status"],
    curriculumVersion: p.curriculumVersion ?? "",
    goalSummary: p.goalSummary ?? "",
    weeklyHours: p.weeklyHours,
    deadline: p.deadline?.toISOString() ?? "",
    estimatedWeeks: p.estimatedWeeks,
    progress: { completed: p.completedCount, total: p.totalCount },
    currentNodeId: p.currentNodeId,
    isPrimary: p.isPrimary,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
  };
}

/** 完整路径（GET /paths/:pathId / preview / confirm）：含 nodes 与 rationale */
export function serializePath(
  p: {
    id: string;
    title: string;
    status: string;
    curriculumVersion: string | null;
    goalSummary: string | null;
    weeklyHours: number;
    deadline: Date | null;
    estimatedWeeks: number;
    completedCount: number;
    totalCount: number;
    currentNodeId: string | null;
    rationale: unknown;
    createdAt: Date;
    lastActivityAt: Date;
    isPrimary: boolean;
  },
  nodes: KnowledgeNode[],
  rationale?: PathRationale,
  planVersions?: PlanVersion[],
): LearningPath {
  return {
    id: p.id,
    title: p.title,
    status: p.status as LearningPath["status"],
    curriculumVersion: p.curriculumVersion ?? "",
    goalSummary: p.goalSummary ?? "",
    weeklyHours: p.weeklyHours,
    deadline: p.deadline?.toISOString() ?? "",
    estimatedWeeks: p.estimatedWeeks,
    progress: { completed: p.completedCount, total: p.totalCount },
    currentNodeId: p.currentNodeId,
    nodes,
    rationale: rationale ?? (p.rationale as PathRationale),
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
    isPrimary: p.isPrimary,
    ...(planVersions ? { planVersions } : {}),
  };
}

/* ---------------- 费曼练习（M4） ---------------- */

/** PracticeMessage：practice_messages 行 → 领域对象 */
export function serializePracticeMessage(m: typeof practiceMessages.$inferSelect): PracticeMessage {
  return {
    id: m.id,
    role: m.role as PracticeMessage["role"],
    content: m.content,
    turnIndex: m.turnIndex,
    createdAt: m.createdAt.toISOString(),
    status: m.status as PracticeMessage["status"],
  };
}

/** PracticeSession：practice_sessions 行 + 消息列表 → 领域对象 */
export function serializePracticeSession(
  s: typeof practiceSessions.$inferSelect,
  messages: PracticeMessage[],
): PracticeSession {
  return {
    id: s.id,
    nodeId: s.nodeId ?? "",
    status: s.status as PracticeSession["status"],
    currentRound: s.currentRound,
    totalRounds: s.totalRounds,
    startedAt: s.startedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    draft: s.draft,
    draftSavedAt: s.draftSavedAt?.toISOString() ?? null,
    syncState: s.syncState as PracticeSession["syncState"],
    messages,
  };
}

/** PracticeFeedback：practice_evaluations 行 → 领域对象 */
export function serializePracticeFeedback(
  e: typeof practiceEvaluations.$inferSelect,
): PracticeFeedback {
  const dims = (e.dimensions ?? {}) as PracticeFeedback["dimensions"];
  return {
    id: e.id,
    sessionId: e.sessionId,
    clear: (e.clear ?? []) as string[],
    toAdd: (e.toAdd ?? []) as string[],
    notCovered: (e.notCovered ?? []) as string[],
    dimensions: {
      completeness: dims.completeness ?? { label: "完整性", level: 3, note: "" },
      accuracy: dims.accuracy ?? { label: "准确性", level: 3, note: "" },
      clarity: dims.clarity ?? { label: "清晰度", level: 3, note: "" },
    },
    evidenceRounds: e.evidenceRounds,
    providerLabel: e.providerLabel ?? "",
    promptVersion: e.promptVersion ?? "",
    generatedAt: e.generatedAt?.toISOString() ?? "",
    confidenceNotice: e.confidenceNotice ?? "",
    nextStep: (e.nextStep ?? []) as PracticeFeedback["nextStep"],
  };
}

/* ---------------- 费曼笔记（M6） ---------------- */

/** FeynmanNote：feynman_notes 行 → 领域对象（jsonb 转数组，时间转 ISO 字符串） */
export function serializeFeynmanNote(n: typeof feynmanNotes.$inferSelect): FeynmanNote {
  return {
    id: n.id,
    sessionId: n.sessionId ?? "",
    nodeId: n.nodeId ?? "",
    title: n.title,
    content: n.content,
    keyTerms: (n.keyTerms ?? []) as string[],
    pendingQuestions: (n.pendingQuestions ?? []) as string[],
    selfAssessed: n.selfAssessed,
    updatedAt: n.updatedAt.toISOString(),
    statusFilter: n.statusFilter as FeynmanNote["statusFilter"],
    sourceTag: n.sourceTag as FeynmanNote["sourceTag"],
  };
}
