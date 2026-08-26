/**
 * 演示数据（P2 学习空间与协作域）：学习空间、多路径、小队、挑战与同伴反馈、作品集、语义搜索、机构空间。
 */
import type {
  SpaceSummary,
  Crew,
  Challenge,
  PeerReview,
  PortfolioItem,
  SearchResult,
  Tenant,
} from "@/lib/types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

/* ---------------- 学习空间 ---------------- */

export const SPACE_SUMMARY: SpaceSummary = {
  activePath: {
    id: "path-pm",
    title: "AI 产品经理基础能力路径",
    status: "in_progress",
    curriculumVersion: "v1.0",
    goalSummary: "6 周内完成需求分析与基础 PRD",
    weeklyHours: 5,
    deadline: inDays(30),
    estimatedWeeks: 6,
    progress: { completed: 4, total: 19 },
    currentNodeId: "need-signal",
    nodes: [],
    rationale: {
      curriculumTitle: "AI 产品经理基础能力路径",
      curriculumVersion: "v1.0",
      generatedAt: daysAgo(12),
      goalProfile: "在职补强",
      providerLabel: "AI 整理（演示）",
      searchProviderLabel: "Search Mock",
      retainedChapters: [],
      deferredChapters: [],
      skippedOrReview: [],
      evidenceCoverageSummary: "",
    },
    createdAt: daysAgo(12),
    lastActivityAt: daysAgo(0),
    isPrimary: true,
  },
  todayTask: {
    type: "practice",
    nodeId: "need-signal",
    sessionId: "session-active-chen",
    title: "解释「从表象需求到真实需求」",
    reason: "依据第 2 章 · 需求分析；上次停在第 2 个追问",
    estimatedMinutes: 25,
    resumeCursor: "第 2 / 5 轮",
  },
  planHealth: {
    onTrack: false,
    confidence: "medium",
    reason: "本周仅完成 1/3，可用时间少于目标 2 小时",
    showAdjustment: true,
  },
  todayReviewCount: 5,
  recommendedLabId: "scenario-priority",
  recentAssets: [
    { type: "note", title: "从按钮需求回到用户任务", updatedAt: daysAgo(0), href: "/notes?focus=note-01" },
    { type: "scenario", title: "优先级沟通复盘", updatedAt: daysAgo(2), href: "/labs/scenario-priority" },
    { type: "challenge", title: "问题陈述：校园二手交易", updatedAt: daysAgo(1), href: "/crews/crew-pm" },
  ],
  crewTask: { crewId: "crew-pm", title: "为「校园二手交易」写问题陈述", dueAt: "2026-08-14 20:00" },
};

/* ---------------- 小队 / 挑战 / 同伴反馈 ---------------- */

export const CREWS: Crew[] = [
  {
    id: "crew-pm",
    name: "PM 新手冲刺",
    description: "围绕需求分析能力组队，每周一个可验证产出。",
    visibility: "private",
    maxMembers: 6,
    memberCount: 5,
    myRole: "member",
    currentChallengeId: "challenge-campus",
    members: [
      { name: "陈思（你）", role: "成员", progress: "已提交", consentLevel: "聚合" },
      { name: "王敏", role: "成员", progress: "已提交", consentLevel: "聚合" },
      { name: "赵言", role: "成员", progress: "进行中", consentLevel: "节点级" },
      { name: "林然", role: "成员", progress: "未开始", consentLevel: "聚合" },
      { name: "导师·张晴", role: "导师", progress: "点评中", consentLevel: "仅授权提交物" },
    ],
    policyNote: "只点评作品，不评价人格；默认不展示练习对话。",
    status: "active",
  },
  {
    id: "crew-book",
    name: "产品方案读书会",
    description: "每周分享一次信息架构练习，互相给结构化反馈。",
    visibility: "private",
    maxMembers: 8,
    memberCount: 3,
    myRole: "member",
    members: [
      { name: "陈思（你）", role: "成员", progress: "本周未提交", consentLevel: "聚合" },
      { name: "李想", role: "成员", progress: "待加入", consentLevel: "聚合" },
      { name: "王敏", role: "成员", progress: "待加入", consentLevel: "聚合" },
    ],
    policyNote: "内容仅限小队成员；可随时退出。",
    status: "active",
  },
];

export const CHALLENGE: Challenge = {
  id: "challenge-campus",
  crewId: "crew-pm",
  title: "校园二手交易：写出可验证的问题陈述",
  brief: "为一款校园二手交易产品写问题陈述：区分用户痛点、业务目标与方案假设。",
  capabilityGoal: "区分用户痛点、业务目标与方案假设",
  delivery: "300–500 字问题陈述 + 1 条证据假设",
  rubric: {
    clarity: "问题陈述清晰，读者能复述",
    evidence: "痛点有证据支撑，不是空泛断言",
    boundary: "明确范围与非目标",
  },
  dueAt: "2026-08-14 20:00",
  status: "submitted",
  submissions: [
    { author: "王敏", title: "导出不是任务", version: 2, feedbackCount: 3, visibility: "小队可见" },
    { author: "林然", title: "校园二手交易的信任问题", version: 1, feedbackCount: 0, visibility: "小队可见" },
  ],
  mySubmission: { version: 2, feedbackCount: 3, visibility: "小队可见" },
};

export const PEER_REVIEW: PeerReview = {
  id: "review-need-01",
  challengeId: "challenge-campus",
  submissionAuthor: "陈思（你）",
  submissionTitle: "问题陈述：让每次导出都带走上下文",
  submissionBody:
    "当市场同学需要把筛选结果用于跨团队周报时，手动重新选择条件并截图成本高、易漏。\n假设：若用户能保存并分享带筛选条件的结果链接，每周手动导出请求会下降 30%。\n成功标准：上线两周内，导出按钮点击率下降且分享链接使用率上升。",
  rubric: ["清晰度", "证据意识", "边界定义"],
  feedbacks: [
    {
      author: "王敏",
      highlight: "「手动重选条件成本高」点出了真实场景，很有代入感。",
      improvement: "建议补充当前手动导出频率的基线，让 30% 这个数字更可信。",
      criterion: "证据意识",
      helpful: true,
    },
    {
      author: "赵言",
      highlight: "假设结构完整（用户—动作—指标）。",
      improvement: "可以说明验证失败后的回退判断，比如两周后看什么指标决定是否放弃。",
      criterion: "边界定义",
    },
    {
      author: "导师·张晴",
      highlight: "把方案（按钮）与任务（带走上下文）分开讲清楚了。",
      improvement: "再补一句非目标，例如「不做批量标签」，边界会更完整。",
      criterion: "边界定义",
      helpful: true,
    },
  ],
  myFeedbackStatus: "submitted",
  visibility: "小队可见",
};

/* ---------------- 作品集 ---------------- */

export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: "pf-01",
    type: "challenge",
    title: "问题陈述：校园二手交易",
    summary: "区分用户痛点、业务目标与方案假设的挑战作品，获 3 条结构化反馈。",
    skillTags: ["需求分析", "问题定义"],
    sourcePath: "AI 产品经理基础能力路径 v1.0",
    visibility: "private",
    updatedAt: daysAgo(1),
    feedbackCount: 3,
  },
  {
    id: "pf-02",
    type: "note",
    title: "用户访谈提纲",
    summary: "从按钮需求回到用户任务的费曼笔记与访谈方法整理。",
    skillTags: ["用户研究"],
    sourcePath: "AI 产品经理基础能力路径 v1.0",
    visibility: "shared",
    updatedAt: daysAgo(0),
    shareExpiresAt: inDays(30),
  },
  {
    id: "pf-03",
    type: "template",
    title: "PRD 评审清单",
    summary: "评审前逐项核对的结构化模板，来自个人资料库。",
    skillTags: ["PRD"],
    sourcePath: "个人资料库",
    visibility: "private",
    updatedAt: daysAgo(2),
  },
];

/* ---------------- 语义搜索 ---------------- */

export const SEARCH_RESULTS: SearchResult[] = [
  {
    id: "sr-01",
    type: "node",
    title: "从表象需求到真实需求",
    snippet: "区分用户提出的方案与底层任务，并写出可验证需求假设。",
    matchReasons: ["能力目标与「可验证需求假设」直接匹配", "教材 2.3 章节包含假设结构"],
    scoreLabel: "相关度 0.91",
    source: "AI 产品经理教材 v2026.08",
    accessReason: "你当前路径的进行中节点",
  },
  {
    id: "sr-02",
    type: "note",
    title: "从按钮需求回到用户任务",
    snippet: "我理解的是：按钮只是一个可能方案，用户的底层任务是把筛选结果带走用于沟通或归档。",
    matchReasons: ["笔记正文包含「底层任务」与「可验证假设」", "与「需求假设成功标准」概念匹配"],
    scoreLabel: "相关度 0.84",
    source: "我的费曼笔记",
    accessReason: "仅自己可见",
  },
  {
    id: "sr-03",
    type: "resource",
    title: "用户访谈与需求验证方法",
    snippet: "用开放问题与具体情境，请用户描述行为而非评价方案。",
    matchReasons: ["与「访谈」「需求验证」关键词匹配"],
    scoreLabel: "相关度 0.72",
    source: "NN/g · B 级专业方法",
    accessReason: "公开来源",
    tier: "B",
  },
  {
    id: "sr-04",
    type: "crew_work",
    title: "问题陈述：让每次导出都带走上下文",
    snippet: "当市场同学需要把筛选结果用于跨团队周报时……分享链接会下降 30% 的手动导出请求。",
    matchReasons: ["属于你已授权查看的小队提交物", "正文包含「可验证假设」"],
    scoreLabel: "相关度 0.66",
    source: "PM 新手冲刺 · 挑战作品",
    accessReason: "你已在反馈中查看该作品",
  },
];

/* ---------------- 机构空间 ---------------- */

export const TENANT: Tenant = {
  id: "t-xingqiao",
  slug: "xingqiao",
  name: "星桥产品学院",
  brandingNote: "仅本机构成员可见",
  myRole: "admin",
  policyVersion: "2026-07",
  programs: [
    {
      id: "prog-01",
      title: "AI 产品经理训练营",
      curriculumVersion: "v1.0",
      week: "第 3 周：需求分析",
      enrolled: true,
    },
    {
      id: "prog-02",
      title: "用户研究专项",
      curriculumVersion: "v1.2",
      week: "第 1 周",
      enrolled: false,
    },
  ],
  announcements: [
    {
      id: "ann-01",
      title: "8 月 15 日导师答疑",
      publishedAt: daysAgo(1),
      body: "本期答疑聚焦需求假设的验证方法，线上会议室链接见机构公告。",
    },
    {
      id: "ann-02",
      title: "挑战「问题陈述」截止提醒",
      publishedAt: daysAgo(2),
      body: "本周五 20:00 截止，请在小队内提交并互相给结构化反馈。",
    },
  ],
  members: [
    { id: "m1", name: "张磊（你）", role: "机构管理员", status: "active" },
    { id: "m2", name: "陈思", role: "学习者", status: "active" },
    { id: "m3", name: "周宁", role: "学习者", status: "active" },
    { id: "m4", name: "张晴", role: "导师", status: "active" },
    { id: "m5", name: "李想", role: "学习者", status: "paused" },
  ],
  aggregateMetrics: [
    { label: "本周激活学习者", value: "42", suppressed: false },
    { label: "节点完成率", value: "61%", suppressed: false },
    { label: "资源失效反馈 3 日处理率", value: "94%", suppressed: false },
    { label: "某小班完成率", value: "—", suppressed: true },
  ],
  resourceReviewQueue: [
    {
      id: "tr-flag-01",
      resourceId: "res-b1",
      resourceTitle: "用户访谈与需求验证方法（NN/g）",
      url: "https://www.nngroup.com/articles/asking-users-questions/",
      grade: "B",
      reason: "link_unavailable",
      note: "待核验可访问性。",
      createdAt: daysAgo(1),
      status: "pending",
    },
  ],
  pendingPolicy: false,
};
