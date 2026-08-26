/**
 * 知径 Pathfinder — Drizzle PostgreSQL Schema（M1）
 *
 * 依据：
 *  - BACKEND-AUDIT.md §10（11 核心表 + 附加 P0 表）
 *  - BACKEND-IMPLEMENTATION-PLAN.md §I
 *  - site/lib/types.ts 领域契约
 *  - site/lib/demo/* 演示数据（seed 对拍来源）
 *
 * 与审计的差异（均记录在案，M1 记录中有说明）：
 *  - 主键采用 demo 业务 id（text），而非审计建议的 uuid —— 演示数据 id 即稳定业务键
 *    （nodeId / sessionId 直接出现在 URL 与前端契约中），text 主键可保证 seed 严格对拍。
 *  - 新增 node_resources 关联表：demo 数据中 ResourceEvidence 为多对多（同一资源
 *    被多个节点引用），非审计草稿假设的 Resource.node_id 一对多。
 *  - feynman_notes.session_id 为无 FK 的可空 text：demo 笔记引用 4 个历史会话，
 *    其中 3 个（session-done-prev*）不在 seed 的 practice_sessions 中，不可加 FK。
 *
 * 所有演示数据行以 is_demo=true 标识；主键均稳定，便于幂等 seed。
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  serial,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ---------------- 账户 ---------------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(), // 业务 id：u-linran / u-chensi / …
  email: text("email").unique(),
  passwordHash: text("password_hash"), // 演示用户 M1 不设口令，M2 认证时按需填充
  displayName: text("display_name").notNull(),
  role: text("role").notNull(), // Role：guest|new_learner|learner|practice_learner|content_admin|org_admin
  avatarUrl: text("avatar_url"),
  weeklyHours: integer("weekly_hours").notNull().default(0),
  goalSummary: text("goal_summary"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- 课程与知识节点 ---------------- */

export const curricula = pgTable("curricula", {
  id: text("id").primaryKey(), // curriculum-v1
  title: text("title").notNull(),
  description: text("description"),
  version: text("version").notNull(), // v1.0
  status: text("status").notNull().default("published"), // draft|published|…
  createdBy: text("created_by"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: text("id").primaryKey(), // role-basics / need-signal / …
    curriculumId: text("curriculum_id")
      .notNull()
      .references(() => curricula.id),
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    sequence: integer("sequence").notNull(),
    status: text("status").notNull(), // NodeStatus：locked|available|current|in_progress|completed
    prerequisites: jsonb("prerequisites").notNull().default([]), // string[]
    estimatedMinutes: integer("estimated_minutes").notNull(),
    capabilityGoal: text("capability_goal").notNull(),
    completionCriteria: jsonb("completion_criteria").notNull().default([]), // string[]
    evidenceCoverage: jsonb("evidence_coverage").notNull().default({}), // hasAB/aCount/bCount/cCount/insufficient
    scenario: text("scenario"),
    curriculumSection: text("curriculum_section"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("knowledge_nodes_curriculum_idx").on(t.curriculumId)],
);

/* ---------------- 资源证据（多对多：节点 ↔ 资源） ---------------- */

export const resources = pgTable("resources", {
  id: text("id").primaryKey(), // res-a1 / res-b1 / …
  title: text("title").notNull(),
  domain: text("domain").notNull(),
  grade: text("grade").notNull(), // Grade：A|B|C
  sourceType: text("source_type").notNull(), // ResourceType
  sourceName: text("source_name").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  reason: text("reason").notNull(),
  url: text("url").notNull(),
  accessibilityStatus: text("accessibility_status").notNull(), // verified|pending|unavailable|flagged
  licenseNote: text("license_note"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nodeResources = pgTable(
  "node_resources",
  {
    nodeId: text("node_id")
      .notNull()
      .references(() => knowledgeNodes.id),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.nodeId, t.resourceId] })],
);

/* ---------------- 学习路径 ---------------- */

export const learningPaths = pgTable(
  "learning_paths",
  {
    id: text("id").primaryKey(), // path-pm / path-research
    userId: text("user_id").references(() => users.id),
    title: text("title").notNull(),
    status: text("status").notNull(), // in_progress|paused|completed|archived|draft
    curriculumVersion: text("curriculum_version"),
    goalSummary: text("goal_summary"),
    weeklyHours: integer("weekly_hours").notNull().default(0),
    deadline: timestamp("deadline", { withTimezone: true }),
    estimatedWeeks: integer("estimated_weeks").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    currentNodeId: text("current_node_id"),
    rationale: jsonb("rationale"), // PathRationale
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // M3: 按用户列路径（GET /api/v1/paths）
    index("learning_paths_user_idx").on(t.userId),
    // M3: 每用户至多一条主路径（confirm 幂等/并发兜底）
    uniqueIndex("learning_paths_one_primary_user_idx")
      .on(t.userId)
      .where(sql`${t.isPrimary} = true`),
  ],
);

export const learningPathNodes = pgTable(
  "learning_path_nodes",
  {
    pathId: text("path_id")
      .notNull()
      .references(() => learningPaths.id),
    nodeId: text("node_id")
      .notNull()
      .references(() => knowledgeNodes.id),
    status: text("status").notNull(), // 路径内节点状态（含 completed/current）
    sortOrder: integer("sort_order").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.pathId, t.nodeId] })],
);

/* ---------------- 费曼练习 ---------------- */

export const practiceSessions = pgTable("practice_sessions", {
  id: text("id").primaryKey(), // session-done-01 / session-unfin-zhou / session-active-chen
  userId: text("user_id").references(() => users.id),
  nodeId: text("node_id").references(() => knowledgeNodes.id),
  pathId: text("path_id").references(() => learningPaths.id),
  status: text("status").notNull(), // in_progress|evaluating|completed|abandoned
  currentRound: integer("current_round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull().default(5),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  draft: text("draft").notNull().default(""),
  draftSavedAt: timestamp("draft_saved_at", { withTimezone: true }),
  syncState: text("sync_state").notNull().default("saved"), // saved|local_only|unsynced
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceMessages = pgTable(
  "practice_messages",
  {
    id: text("id").primaryKey(), // m1..m7 / z1..z4 / a1..a2
    sessionId: text("session_id")
      .notNull()
      .references(() => practiceSessions.id),
    role: text("role").notNull(), // user|ai
    content: text("content").notNull(),
    turnIndex: integer("turn_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("sent"), // sent|sending|failed|unsynced
    clientId: text("client_id"), // 客户端幂等键（M4）：重复提交同一 clientId 不产生重复消息
    isDemo: boolean("is_demo").notNull().default(false),
  },
  (t) => [
    index("practice_messages_session_idx").on(t.sessionId),
    uniqueIndex("practice_messages_session_client_idx")
      .on(t.sessionId, t.clientId)
      .where(sql`${t.clientId} IS NOT NULL`),
  ],
);

export const practiceEvaluations = pgTable("practice_evaluations", {
  id: text("id").primaryKey(), // eval-done-01
  sessionId: text("session_id")
    .notNull()
    .references(() => practiceSessions.id),
  clear: jsonb("clear").notNull().default([]), // string[]
  toAdd: jsonb("to_add").notNull().default([]), // string[]
  notCovered: jsonb("not_covered").notNull().default([]), // string[]
  dimensions: jsonb("dimensions").notNull().default({}), // {completeness,accuracy,clarity}
  evidenceRounds: integer("evidence_rounds").notNull().default(0),
  providerLabel: text("provider_label"),
  promptVersion: text("prompt_version"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  confidenceNotice: text("confidence_notice"),
  nextStep: jsonb("next_step").notNull().default([]), // {label,type,nodeId?}[]
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- 费曼笔记 ---------------- */

export const feynmanNotes = pgTable("feynman_notes", {
  id: text("id").primaryKey(), // note-01..note-04
  sessionId: text("session_id"), // 无 FK：demo 引用 3 个未 seed 的历史会话
  nodeId: text("node_id").references(() => knowledgeNodes.id),
  userId: text("user_id").references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  keyTerms: jsonb("key_terms").notNull().default([]),
  pendingQuestions: jsonb("pending_questions").notNull().default([]),
  selfAssessed: boolean("self_assessed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  statusFilter: text("status_filter").notNull().default("all"),
  sourceTag: text("source_tag").notNull().default("ai_draft"), // ai_draft|user_edit|mixed
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- 审计日志 ---------------- */

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  detail: jsonb("detail"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------- P1/P2 学习模块（主题绑定：user_id + path_id） ---------------- */

/** 复习卡片（复习中心）：AI 生成或模板兜底，status 驱动间隔复习流转 */
export const reviewCards = pgTable(
  "review_cards",
  {
    id: text("id").primaryKey(), // rc-<rand>
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    pathId: text("path_id")
      .notNull()
      .references(() => learningPaths.id),
    nodeId: text("node_id"),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    source: text("source").notNull().default("template"), // ai|evaluation|template
    status: text("status").notNull().default("new"), // new|reviewing|mastered
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("review_cards_user_path_idx").on(t.userId, t.pathId)],
);

/** 情境练习场景（情境练习场）：AI 生成或模板兜底 */
export const scenarios = pgTable(
  "scenarios",
  {
    id: text("id").primaryKey(), // sc-<rand>
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    pathId: text("path_id")
      .notNull()
      .references(() => learningPaths.id),
    nodeId: text("node_id"),
    title: text("title").notNull(),
    situation: text("situation").notNull(),
    task: text("task").notNull(),
    aiRole: text("ai_role").notNull(),
    rubric: text("rubric").notNull(),
    sourceType: text("source_type").notNull().default("template"), // ai|template
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scenarios_user_path_idx").on(t.userId, t.pathId)],
);

/** 作品集条目（作品集）：用户主动沉淀的学习资产 */
export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: text("id").primaryKey(), // pf-<rand>
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    pathId: text("path_id")
      .notNull()
      .references(() => learningPaths.id),
    title: text("title").notNull(),
    type: text("type").notNull().default("note"), // project|note|link
    url: text("url"),
    description: text("description").notNull().default(""),
    visibility: text("visibility").notNull().default("private"), // private|shared|public_link
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("portfolio_items_user_path_idx").on(t.userId, t.pathId)],
);

/** 个人资料库条目（个人资料库）：用户私有，绑定当前学习路径（user_id + path_id） */
export const libraryItems = pgTable(
  "library_items",
  {
    id: text("id").primaryKey(), // lib-<rand>
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    pathId: text("path_id")
      .notNull()
      .references(() => learningPaths.id),
    sourceType: text("source_type").notNull().default("link"), // resource|upload|note|link
    resourceId: text("resource_id").references(() => resources.id), // 收藏的路径资源（source_type=resource）
    nodeId: text("node_id"), // 收藏来源节点（信息性）
    title: text("title").notNull(),
    url: text("url"),
    sourceName: text("source_name").notNull().default(""),
    tags: jsonb("tags").notNull().default([]), // string[]
    memo: text("memo").notNull().default(""),
    status: text("status").notNull().default("verified"), // verified|pending
    objectKey: text("object_key"), // 上传元数据（本轮不真上传）
    size: text("size"),
    licenseNote: text("license_note").notNull().default(""),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("library_items_user_path_idx").on(t.userId, t.pathId),
    // 同用户收藏同一资源幂等（favorite 重复调用不产生重复行）
    uniqueIndex("library_items_user_resource_idx")
      .on(t.userId, t.resourceId)
      .where(sql`${t.resourceId} IS NOT NULL`),
  ],
);


/* ---------------- 附加 P0 表（M1 建表，暂不 seed） ---------------- */

/** 知识图谱边（M3 课程树用；demo 以 prerequisiteIds 表达关系，M1 留空） */
export const knowledgeEdges = pgTable("knowledge_edges", {
  id: serial("id").primaryKey(),
  fromNodeId: text("from_node_id").notNull(),
  toNodeId: text("to_node_id").notNull(),
  relationship: text("relationship"),
});

/** 会话令牌（M2 认证用；opaque session，可吊销） */
export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(), // session token hash
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 目标诊断答案（M3/M5 onboarding 用） */
export const onboardingAnswers = pgTable("onboarding_answers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  answers: jsonb("answers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 路径推荐运行记录（M5 用；含 input/output/model/延迟） */
export const recommendationRuns = pgTable("recommendation_runs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  input: jsonb("input"),
  output: jsonb("output"),
  model: text("model"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 路径版本快照（M3+ 计划调整用） */
export const pathSnapshots = pgTable("path_snapshots", {
  id: serial("id").primaryKey(),
  pathId: text("path_id").references(() => learningPaths.id),
  snapshot: jsonb("snapshot").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
