/**
 * 知径 Pathfinder — 全局领域类型
 * 与 PRD 中的 PostgreSQL / 接口契约对齐，仅用于前端 Mock Demo。
 * 所有演示数据统一标注 isDemo 语义（见 lib/demo）。
 */

export type DemoState =
  | "normal"
  | "offline"
  | "ai_error"
  | "evidence_insufficient"
  | "empty"
  | "forbidden";

/** 演示角色：与 URL query ?role= 及隐藏原型控制台联动 */
export type Role =
  | "guest"
  | "new_learner" // 林然：无路径
  | "learner" // 陈思：4/18 已完成，当前节点需信号
  | "practice_learner" // 周宁：3 轮未完成费曼会话 + 本地草稿
  | "content_admin" // 内容管理员：脱敏资源审核
  | "org_admin"; // 机构管理员：仅本租户聚合

export type Flag =
  | "review_center"
  | "scenario_labs"
  | "multi_path"
  | "crews"
  | "semantic_search"
  | "tenant_workspace"
  | "skill_radar"
  | "personal_library"
  | "content_console"
  | "learning_space"
  | "adaptive_plan"
  | "portfolio"
  | "peer_feedback";

export const ALL_FLAGS: Flag[] = [
  "review_center",
  "scenario_labs",
  "multi_path",
  "crews",
  "semantic_search",
  "tenant_workspace",
  "skill_radar",
  "personal_library",
  "content_console",
  "learning_space",
  "adaptive_plan",
  "portfolio",
  "peer_feedback",
];

/** 每个模块的默认开关状态（演示默认开启以便全量体验；控制台可关闭） */
export const FLAG_DEFAULTS: Record<Flag, boolean> = {
  review_center: true,
  scenario_labs: true,
  multi_path: true,
  crews: true,
  semantic_search: true,
  tenant_workspace: true,
  skill_radar: true,
  personal_library: true,
  content_console: true,
  learning_space: true,
  adaptive_plan: true,
  portfolio: true,
  peer_feedback: true,
};

/** 路由 → 依赖的 Feature Flag（用于直达路由门禁） */
export const ROUTE_FLAG: Record<string, Flag> = {
  "/review": "review_center",
  "/labs": "scenario_labs",
  "/skills": "skill_radar",
  "/library": "personal_library",
  "/admin/content": "content_console",
  "/space": "learning_space",
  "/paths": "multi_path",
  "/crews": "crews",
  "/portfolio": "portfolio",
  "/search": "semantic_search",
  "/org": "tenant_workspace",
};

/* ---------------- 教材与路径 ---------------- */

export type NodeStatus =
  | "locked"
  | "available"
  | "current"
  | "in_progress"
  | "completed";

export type Grade = "A" | "B" | "C";

export type AccessibilityStatus =
  | "verified"
  | "pending"
  | "unavailable"
  | "flagged";

export type ResourceType =
  | "official_docs"
  | "textbook"
  | "course"
  | "article"
  | "podcast"
  | "video"
  | "blog"
  | "university"
  | "tool";

export interface ResourceEvidence {
  id: string;
  title: string;
  domain: string;
  grade: Grade;
  sourceType: ResourceType;
  sourceName: string; // 归属机构/作者
  checkedAt: string; // 校验时间 ISO
  retrievedAt: string; // 检索时间 ISO
  reason: string; // 推荐理由
  url: string;
  accessibilityStatus: AccessibilityStatus;
  licenseNote: string;
}

export interface KnowledgeNode {
  id: string;
  title: string;
  chapter: string; // 阶段/章节名
  sequence: number;
  status: NodeStatus;
  prerequisiteIds: string[];
  estimatedMinutes: number;
  capabilityGoal: string;
  completionCriteria: string[];
  evidenceCoverage: {
    hasAB: boolean;
    aCount: number;
    bCount: number;
    cCount: number;
    insufficient: boolean;
  };
  resources: ResourceEvidence[];
  scenario?: string; // 真实场景示例
  curriculumSection?: string; // 教材对应章节
}

export interface PathSkillPhase {
  name: string;
  reason: string;
}

export interface PathWeekPhase {
  week: number;
  skills: string[];
}

export interface PathRationale {
  /** curriculum：给定课程内的章节编排；generic：任意主题生成 */
  kind?: "curriculum" | "generic";
  curriculumTitle?: string;
  curriculumVersion?: string;
  generatedAt: string;
  goalProfile: string;
  providerLabel: string;
  searchProviderLabel: string;
  /** 路径确认前的真实检索覆盖；可信度由来源覆盖规则计算，不采用模型自报置信度。 */
  evidenceConfidence?: "high" | "medium" | "low";
  searchedNodeCount?: number;
  nodesWithResources?: number;
  totalResourceCount?: number;
  searchQueries?: string[];
  retainedChapters?: string[];
  deferredChapters?: string[];
  skippedOrReview?: string[];
  evidenceCoverageSummary?: string;
  /** generic 形状（kind === "generic" 时使用） */
  topic?: string;
  goal?: string;
  currentLevel?: string;
  weeklyHours?: number;
  deadlineWeeks?: number;
  preferences?: string[];
  title?: string;
  rationale?: string;
  skills?: PathSkillPhase[];
  weeks?: PathWeekPhase[];
}

export interface LearningPath {
  id: string;
  title: string;
  status: "in_progress" | "paused" | "completed" | "archived" | "draft";
  curriculumVersion: string;
  goalSummary: string;
  weeklyHours: number;
  deadline: string;
  estimatedWeeks: number;
  progress: { completed: number; total: number };
  currentNodeId: string | null;
  nodes: KnowledgeNode[];
  rationale: PathRationale;
  createdAt: string;
  lastActivityAt: string;
  isPrimary?: boolean;
  isAssignedByOrg?: boolean;
  planVersions?: PlanVersion[];
  adjustmentProposal?: PlanAdjustmentProposal | null;
}

export interface PlanVersion {
  id: string;
  version: number;
  weeklyHours: number;
  deadline: string;
  reason: string;
  createdAt: string;
  source: "initial" | "ai_proposal" | "custom";
}

export interface PlanAdjustmentProposal {
  id: string;
  generatedAt: string;
  reason: string;
  assumptions: string[];
  affectedNodes: { title: string; before: string; after: string }[];
  impacts: string[]; // 例如「完成日期延后 1 周」
  confidence: string;
  proposedDeadline: string;
  proposedWeeklyHours: number;
}

/* ---------------- 费曼练习与评价 ---------------- */

export type PracticeMessageRole = "user" | "ai";
export type PracticeMessageStatus = "sent" | "sending" | "failed" | "unsynced";

export interface PracticeMessage {
  id: string;
  role: PracticeMessageRole;
  content: string;
  turnIndex: number;
  createdAt: string;
  status: PracticeMessageStatus;
}

export type PracticeSessionStatus =
  | "in_progress"
  | "evaluating"
  | "completed"
  | "abandoned";

export interface PracticeSession {
  id: string;
  nodeId: string;
  status: PracticeSessionStatus;
  currentRound: number;
  totalRounds: number;
  startedAt: string;
  updatedAt: string;
  draft: string; // 本地草稿
  draftSavedAt: string | null;
  syncState: "saved" | "local_only" | "unsynced";
  messages: PracticeMessage[];
  aiThinking?: boolean;
}

export interface EvaluationDimension {
  label: string;
  level: 1 | 2 | 3 | 4 | 5;
  note: string;
}

export interface PracticeFeedback {
  id: string;
  sessionId: string;
  /** 已讲清 / 待补充 / 尚未覆盖 */
  clear: string[];
  toAdd: string[];
  notCovered: string[];
  dimensions: {
    completeness: EvaluationDimension;
    accuracy: EvaluationDimension;
    clarity: EvaluationDimension;
  };
  evidenceRounds: number;
  providerLabel: string;
  promptVersion: string;
  generatedAt: string;
  confidenceNotice: string;
  nextStep: { label: string; nodeId?: string; type: "node" | "practice" | "review" }[];
}

export interface FeynmanNote {
  id: string;
  sessionId: string;
  nodeId: string;
  title: string;
  content: string;
  keyTerms: string[];
  pendingQuestions: string[];
  selfAssessed: boolean;
  updatedAt: string;
  statusFilter: "all" | "to_add" | "self_assessed" | "archived";
  sourceTag: "ai_draft" | "user_edit" | "mixed";
}

/* ---------------- 复习中心 ---------------- */

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface MemoryCard {
  id: string;
  nodeId: string;
  front: string;
  backSummary: string;
  sourceKind: "node" | "practice_gap" | "user_added";
  sourceTitle: string;
  tags: string[];
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  status: "due" | "scheduled" | "paused" | "personal";
}

export interface ReviewSession {
  id: string;
  startedAt: string;
  cardIds: string[];
  answeredCount: number;
  progress: { answered: number; total: number };
}

/* ---------------- 情境练习场 ---------------- */

export interface Scenario {
  id: string;
  title: string;
  summary: string;
  persona: string; // AI 扮演角色，如「增长负责人林岚」
  personaRole: "业务方" | "研发" | "用户" | "主管" | "设计";
  skillTags: string[];
  difficulty: "初级" | "中级" | "高级";
  estimatedMinutes: number;
  sourceNodeId: string | null;
  competencyId: string;
  task: string;
  goal: string;
  completionCriteria: string[];
  openingLine: string;
  scenarioVersion: string;
  auxiliaryDocs: { label: string; content: string; isFictional: boolean }[];
  status: "published" | "draft" | "offline";
}

export interface ScenarioSession {
  id: string;
  scenarioId: string;
  status: "in_progress" | "completed" | "abandoned";
  round: number;
  maxRounds: number;
  messages: PracticeMessage[];
  startedAt: string;
  updatedAt: string;
  draft: string;
  rubricScores?: {
    clarity: number;
    evidence: number;
    boundary: number;
  };
  report?: ScenarioReport;
}

export interface ScenarioReport {
  id: string;
  achieved: { claim: string; messageIds: string[] }[];
  toProbe: string[];
  nextActions: { label: string; href: string; type: "node" | "review" | "labs" }[];
  confidenceNote: string;
  generatedAt: string;
  providerLabel: string;
}

/* ---------------- 技能雷达 ---------------- */

export type SkillLevel = "待开始" | "学习中" | "已有基础" | "证据不足";

export interface SkillDimension {
  id: string;
  name: string;
  level: SkillLevel;
  evidenceCount: number;
  confidence: "high" | "medium" | "low";
  evidences: { sourceType: string; claim: string; sourceId: string; createdAt: string }[];
  recommendation?: { gapType: string; nextAction: string; reason: string };
}

/* ---------------- 个人资料库 ---------------- */

export interface LibraryItem {
  id: string;
  kind: "link" | "file" | "note";
  title: string;
  url?: string;
  objectKey?: string;
  sourceName: string;
  tags: string[];
  linkedNodeIds: string[];
  visibility: "private";
  checkedAt: string;
  status: "verified" | "pending" | "unavailable" | "scanning";
  memo: string;
  licenseNote: string;
  size?: string;
}

/* ---------------- 内容运营台 ---------------- */

export interface ResourceFlag {
  id: string;
  resourceId: string;
  resourceTitle: string;
  url: string;
  grade: Grade;
  reason: string;
  note: string;
  createdAt: string;
  status: "pending" | "resolved" | "dismissed";
  resolutionNote?: string;
}

export interface CurriculumRelease {
  id: string;
  title: string;
  version: string;
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  updatedAt: string;
  affectedNewPathEstimate: number;
}

export interface SourceDomainRule {
  id: string;
  domain: string;
  allowedTypes: string[];
  tier: Grade;
  licensePolicy: string;
  checkedAt: string;
  reviewStatus: "approved" | "pending" | "blocked";
}

/* ---------------- P2 学习空间与协作 ---------------- */

export interface SpaceSummary {
  activePath: LearningPath;
  todayTask: {
    type: "practice" | "node" | "review";
    nodeId?: string;
    sessionId?: string;
    title: string;
    reason: string;
    estimatedMinutes: number;
    resumeCursor: string;
  };
  planHealth: { onTrack: boolean; confidence: string; reason: string; showAdjustment: boolean };
  todayReviewCount: number;
  recommendedLabId: string | null;
  recentAssets: { type: "note" | "scenario" | "challenge"; title: string; updatedAt: string; href: string }[];
  crewTask?: { crewId: string; title: string; dueAt: string };
}

export interface Crew {
  id: string;
  name: string;
  description: string;
  visibility: "private" | "org";
  maxMembers: number;
  memberCount: number;
  myRole: "member" | "captain" | "mentor";
  currentChallengeId?: string;
  members: { name: string; role: string; progress: string; consentLevel: string }[];
  policyNote: string;
  status: "active" | "pending_invite" | "full" | "left";
}

export interface Challenge {
  id: string;
  crewId: string;
  title: string;
  brief: string;
  capabilityGoal: string;
  delivery: string;
  rubric: { clarity: string; evidence: string; boundary: string };
  dueAt: string;
  submissions: { author: string; title: string; version: number; feedbackCount: number; visibility: string }[];
  mySubmission?: { version: number; feedbackCount: number; visibility: string };
  status: "open" | "submitted" | "closed" | "reviewing";
}

export interface PeerReview {
  id: string;
  challengeId: string;
  submissionAuthor: string;
  submissionTitle: string;
  submissionBody: string;
  rubric: string[];
  feedbacks: { author: string; highlight: string; improvement: string; criterion: string; helpful?: boolean }[];
  myFeedbackStatus: "pending" | "submitted";
  visibility: string;
}

export interface PortfolioItem {
  id: string;
  type: "note" | "challenge" | "template";
  title: string;
  summary: string;
  skillTags: string[];
  sourcePath: string;
  visibility: "private" | "shared" | "public_link";
  updatedAt: string;
  shareExpiresAt?: string;
  feedbackCount?: number;
}

export interface SearchResult {
  id: string;
  type: "node" | "note" | "resource" | "crew_work";
  title: string;
  snippet: string;
  matchReasons: string[];
  scoreLabel: string;
  source: string;
  accessReason: string;
  tier?: Grade;
  /** resource 命中可携带真实外部链接（demo 主题包派生） */
  url?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  brandingNote: string;
  myRole: "member" | "mentor" | "admin";
  policyVersion: string;
  programs: { id: string; title: string; curriculumVersion: string; week: string; enrolled: boolean }[];
  announcements: { id: string; title: string; publishedAt: string; body: string }[];
  members: { id: string; name: string; role: string; status: string }[];
  aggregateMetrics: { label: string; value: string; suppressed: boolean }[];
  resourceReviewQueue: ResourceFlag[];
  pendingPolicy: boolean;
}

/* ---------------- AI 输出统一字段 ---------------- */

export interface AiResultMeta {
  generatedAt: string;
  providerLabel: string;
  evidenceRefs: string[];
  confidenceNotice: string;
}

/* ---------------- 账户 ---------------- */

export interface UserProfile {
  id: string;
  role: Role;
  displayName: string;
  email: string;
  weeklyHours: number;
  goalSummary: string;
  hasPath: boolean;
  resume?: { type: "practice" | "node" | "none"; sessionId?: string; nodeId?: string; detail: string };
  isDemo: boolean;
}

export interface OnboardingAnswers {
  goalType: "转行入门" | "在职补强" | "项目实战";
  experience: "零基础" | "有协作经验" | "初级产品经理";
  weeklyHours: number;
  deadlineWeeks: number;
  note: string;
}

/** 学习目标（通用学习规划阶段）：topic/goal 为用户输入，绝不默认「产品」 */
export interface LearningGoalInput {
  topic: string;
  goal: string;
  currentLevel: string;
  weeklyHours: number;
  deadlineWeeks: number;
  preferences: string[];
}
