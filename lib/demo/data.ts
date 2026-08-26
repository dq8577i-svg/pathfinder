/**
 * 演示数据（P0 核心域）：教材能力骨架、知识节点、学习路径、费曼练习与笔记。
 * 所有内容均为演示数据，不接入真实 DeepSeek / 搜索 API / 数据库。
 */
import type {
  KnowledgeNode,
  ResourceEvidence,
  LearningPath,
  PathRationale,
  PracticeSession,
  PracticeFeedback,
  FeynmanNote,
  PracticeMessage,
  NodeStatus,
} from "@/lib/types";

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86400000));
const inDays = (n: number) => iso(new Date(Date.now() + n * 86400000));

/* ---------------- 资源证据（按等级） ---------------- */

export const resA1: ResourceEvidence = {
  id: "res-a1",
  title: "Google UX Research Guide：Learn about Users",
  domain: "google.com",
  grade: "A",
  sourceType: "official_docs",
  sourceName: "Google",
  checkedAt: daysAgo(0),
  retrievedAt: daysAgo(0),
  reason: "作为「用户研究与需求假设」的方法补充，已通过可访问性校验。",
  url: "https://developers.google.com/ux-research/engage",
  accessibilityStatus: "verified",
  licenseNote: "站外公开资料，版权归原机构；仅以跳转方式访问。",
};

export const resA2: ResourceEvidence = {
  id: "res-a2",
  title: "教材 §3.1 需求的表象与底层任务",
  domain: "textbook.internal",
  grade: "A",
  sourceType: "textbook",
  sourceName: "《AI 产品经理训练营》教材",
  checkedAt: daysAgo(2),
  retrievedAt: daysAgo(2),
  reason: "核心教材依据，对应「从表象需求到真实需求」能力目标。",
  url: "https://demo.pathfinder.local/curriculum/v1.0/ch2/3.1",
  accessibilityStatus: "verified",
  licenseNote: "自有权教材内容。",
};

export const resB1: ResourceEvidence = {
  id: "res-b1",
  title: "用户访谈与需求验证方法",
  domain: "nngroup.com",
  grade: "B",
  sourceType: "article",
  sourceName: "Nielsen Norman Group",
  checkedAt: daysAgo(3),
  retrievedAt: daysAgo(3),
  reason: "用于补充访谈方法、避免诱导性问题，支持可验证假设的写法。",
  url: "https://www.nngroup.com/articles/asking-users-questions/",
  accessibilityStatus: "verified",
  licenseNote: "站外公开资料，版权归 NN/g；仅保存元数据与链接。",
};

export const resC1: ResourceEvidence = {
  id: "res-c1",
  title: "播客：从功能请求到用户任务",
  domain: "podcasts.example.com",
  grade: "C",
  sourceType: "podcast",
  sourceName: "产品思维漫谈",
  checkedAt: daysAgo(7),
  retrievedAt: daysAgo(7),
  reason: "延伸参考，帮助理解团队语境中的需求拆解，不作为核心完成依据。",
  url: "https://podcasts.example.com/pm-08",
  accessibilityStatus: "verified",
  licenseNote: "站外公开内容；仅跳转收听。",
};

export const resC2: ResourceEvidence = {
  id: "res-c2",
  title: "视频：PRD 评审常见翻车现场",
  domain: "bilibili.example.com",
  grade: "C",
  sourceType: "video",
  sourceName: "产品经理实战频道",
  checkedAt: daysAgo(10),
  retrievedAt: daysAgo(10),
  reason: "延伸参考：评审沟通与结构化表达。",
  url: "https://bilibili.example.com/video/prd-review",
  accessibilityStatus: "pending",
  licenseNote: "站外公开内容；仅跳转查看。",
};

export const resB2: ResourceEvidence = {
  id: "res-b2",
  title: "写好 PRD：结构、标准与验收",
  domain: "pmthought.example.com",
  grade: "B",
  sourceType: "article",
  sourceName: "专业产品社区",
  checkedAt: daysAgo(5),
  retrievedAt: daysAgo(5),
  reason: "补充 PRD 结构与验收标准写法，配合教材第五章。",
  url: "https://pmthought.example.com/prd-guide",
  accessibilityStatus: "verified",
  licenseNote: "站外公开文章；仅保存元数据。",
};

export const resB3: ResourceEvidence = {
  id: "res-b3",
  title: "可用性测试方法与低保真原型",
  domain: "uxstudy.example.edu",
  grade: "B",
  sourceType: "university",
  sourceName: "某高校公开课讲义",
  checkedAt: daysAgo(6),
  retrievedAt: daysAgo(6),
  reason: "高校公开课资料，补充原型与可用性验证方法。",
  url: "https://uxstudy.example.edu/wireframe",
  accessibilityStatus: "verified",
  licenseNote: "高校公开讲义；按授权摘要引用。",
};

/* ---------------- 知识节点工厂 ---------------- */

interface NodeSeed {
  id: string;
  title: string;
  chapter: string;
  sequence: number;
  status: NodeStatus;
  prerequisites: string[];
  minutes: number;
  goal: string;
  criteria: string[];
  scenario?: string;
  section?: string;
  resources: ResourceEvidence[];
  insufficient?: boolean;
}

function makeNode(s: NodeSeed): KnowledgeNode {
  const aCount = s.resources.filter((r) => r.grade === "A").length;
  const bCount = s.resources.filter((r) => r.grade === "B").length;
  const cCount = s.resources.filter((r) => r.grade === "C").length;
  return {
    id: s.id,
    title: s.title,
    chapter: s.chapter,
    sequence: s.sequence,
    status: s.status,
    prerequisiteIds: s.prerequisites,
    estimatedMinutes: s.minutes,
    capabilityGoal: s.goal,
    completionCriteria: s.criteria,
    evidenceCoverage: {
      hasAB: aCount + bCount > 0 && !s.insufficient,
      aCount,
      bCount,
      cCount,
      insufficient: !!s.insufficient,
    },
    resources: s.resources,
    scenario: s.scenario,
    curriculumSection: s.section,
  };
}

export const CURRICULUM_TITLE = "AI 产品经理基础能力路径";
export const CURRICULUM_VERSION = "v1.0";
export const CURRICULUM_TOTAL_NODES = 19;

export const KNOWLEDGE_NODES: KnowledgeNode[] = [
  makeNode({
    id: "role-basics",
    title: "产品经理角色与工作边界",
    chapter: "产品经理角色与产品思维",
    sequence: 1,
    status: "completed",
    prerequisites: [],
    minutes: 30,
    goal: "说明产品经理在需求、设计、研发、运营中的协作边界。",
    criteria: ["复述产品经理的主要职责", "区分产品经理与项目经理的差异"],
    section: "第 1 章",
    resources: [resA2, resB1],
  }),
  makeNode({
    id: "pm-mindset",
    title: "产品思维：问题先于方案",
    chapter: "产品经理角色与产品思维",
    sequence: 2,
    status: "completed",
    prerequisites: ["role-basics"],
    minutes: 40,
    goal: "在讨论方案前先澄清用户问题、场景与约束。",
    criteria: ["对任意需求先写问题而非方案", "能识别“方案化表述”"],
    scenario: "同事说“我们加一个暗黑模式吧”",
    section: "第 1 章",
    resources: [resA1, resC1],
  }),
  makeNode({
    id: "decision-boundary",
    title: "决策边界与优先级判断",
    chapter: "产品经理角色与产品思维",
    sequence: 3,
    status: "completed",
    prerequisites: ["pm-mindset"],
    minutes: 35,
    goal: "用影响与成本两个维度解释一个决策的优先级。",
    criteria: ["给出至少一条优先级判断的理由", "识别不可量化时的不确定性"],
    section: "第 1 章",
    resources: [resB1],
  }),
  makeNode({
    id: "user-research-basics",
    title: "用户研究基础与问题定义",
    chapter: "用户研究与需求分析",
    sequence: 4,
    status: "completed",
    prerequisites: ["decision-boundary"],
    minutes: 45,
    goal: "界定一个待研究的问题，并选择合适的研究方法。",
    criteria: ["把模糊主题改写为可研究的问题", "说明所选方法与问题的匹配"],
    section: "第 2 章 2.1",
    resources: [resA1, resB1],
  }),
  makeNode({
    id: "need-signal",
    title: "从表象需求到真实需求",
    chapter: "用户研究与需求分析",
    sequence: 5,
    status: "current",
    prerequisites: ["user-research-basics"],
    minutes: 35,
    goal: "区分用户提出的方案与底层任务，并写出至少一条可验证的需求假设。",
    criteria: ["区分表象诉求与底层任务", "写出一条可验证需求假设", "说明假设的成功标准"],
    scenario: "用户说「我想要一个一键导出按钮」",
    section: "第 2 章 2.3",
    resources: [resA2, resA1, resB1, resC1],
  }),
  makeNode({
    id: "user-research-hypothesis",
    title: "用户研究与需求假设",
    chapter: "用户研究与需求分析",
    sequence: 6,
    status: "available",
    prerequisites: ["need-signal"],
    minutes: 50,
    goal: "把用户洞察组织为可验证的需求假设（用户—场景—动机—验证）。",
    criteria: ["写出一条包含场景与动机的假设", "说明如何验证"],
    section: "第 2 章 2.4",
    resources: [resA1, resB1, resC1],
  }),
  makeNode({
    id: "interview-methods",
    title: "访谈方法与避免诱导",
    chapter: "用户研究与需求分析",
    sequence: 7,
    status: "locked",
    prerequisites: ["user-research-hypothesis"],
    minutes: 40,
    goal: "设计一份不带诱导的非引导式访谈提纲。",
    criteria: ["改写 3 条诱导性问题", "给出访谈开场脚本"],
    section: "第 2 章 2.5",
    resources: [resB1],
  }),
  makeNode({
    id: "persona-stories",
    title: "用户画像与用户故事",
    chapter: "用户研究与需求分析",
    sequence: 8,
    status: "locked",
    prerequisites: ["interview-methods"],
    minutes: 35,
    goal: "从访谈数据中提炼用户画像与用户故事。",
    criteria: ["写出一条基于证据的用户故事", "标注故事中的待验证假设"],
    section: "第 2 章 2.6",
    resources: [resA2],
  }),
  makeNode({
    id: "info-arch",
    title: "信息架构与内容组织",
    chapter: "产品方案与信息架构",
    sequence: 9,
    status: "locked",
    prerequisites: ["persona-stories"],
    minutes: 45,
    goal: "根据用户任务组织信息架构，并说明导航原则。",
    criteria: ["为示例产品画出一层信息架构", "解释两个导航决策"],
    section: "第 3 章",
    resources: [resB3],
  }),
  makeNode({
    id: "solution-boundary",
    title: "方案与功能边界定义",
    chapter: "产品方案与信息架构",
    sequence: 10,
    status: "locked",
    prerequisites: ["info-arch"],
    minutes: 50,
    goal: "把需求收敛为功能范围，并明确不在范围内的内容。",
    criteria: ["写出功能范围清单", "明确两条明确的非目标"],
    section: "第 3 章",
    resources: [resA2, resB2],
  }),
  makeNode({
    id: "workflow-design",
    title: "业务流程与状态设计",
    chapter: "产品方案与信息架构",
    sequence: 11,
    status: "locked",
    prerequisites: ["solution-boundary"],
    minutes: 45,
    goal: "描述一条主业务流程及其异常分支。",
    criteria: ["画出主流程", "列出至少两个异常分支"],
    section: "第 3 章",
    resources: [resB2],
  }),
  makeNode({
    id: "wireframe-ux",
    title: "低保真原型与关键路径",
    chapter: "原型设计与用户体验",
    sequence: 12,
    status: "locked",
    prerequisites: ["workflow-design"],
    minutes: 55,
    goal: "为关键路径制作低保真原型并说明设计取舍。",
    criteria: ["完成主任务 3 屏线框", "说明两处取舍"],
    section: "第 4 章",
    resources: [resB3, resC2],
  }),
  makeNode({
    id: "usability-testing",
    title: "可用性测试与结果分析",
    chapter: "原型设计与用户体验",
    sequence: 13,
    status: "locked",
    prerequisites: ["wireframe-ux"],
    minutes: 50,
    goal: "设计一次 5 用户可用性测试并归类问题。",
    criteria: ["写出测试任务", "把发现归类为可用性问题"],
    section: "第 4 章",
    resources: [resB3],
  }),
  makeNode({
    id: "ux-principles",
    title: "体验原则与认知负荷",
    chapter: "原型设计与用户体验",
    sequence: 14,
    status: "locked",
    prerequisites: ["usability-testing"],
    minutes: 40,
    goal: "用体验原则解释界面设计决策。",
    criteria: ["用两条原则解释一个界面"],
    section: "第 4 章",
    resources: [resC2],
  }),
  makeNode({
    id: "prd-structure",
    title: "PRD 结构与问题定义",
    chapter: "PRD 撰写与需求评审",
    sequence: 15,
    status: "locked",
    prerequisites: ["ux-principles"],
    minutes: 45,
    goal: "写出一份 PRD 的问题定义与背景章节。",
    criteria: ["写出背景与问题定义", "说明目标与成功指标"],
    section: "第 5 章",
    resources: [resA2, resB2],
  }),
  makeNode({
    id: "prd-writing",
    title: "PRD 撰写：需求描述与验收",
    chapter: "PRD 撰写与需求评审",
    sequence: 16,
    status: "locked",
    prerequisites: ["prd-structure"],
    minutes: 60,
    goal: "用可验证语言撰写需求描述与验收标准。",
    criteria: ["改写一条模糊需求为可验证描述", "为它写两条验收标准"],
    section: "第 5 章",
    resources: [resB2],
  }),
  makeNode({
    id: "req-review",
    title: "需求评审与反馈吸收",
    chapter: "PRD 撰写与需求评审",
    sequence: 17,
    status: "locked",
    prerequisites: ["prd-writing"],
    minutes: 45,
    goal: "组织一次需求评审并分类吸收反馈。",
    criteria: ["列出评审议程", "把反馈归类为采纳/讨论/暂缓"],
    section: "第 5 章",
    resources: [resC2],
  }),
  makeNode({
    id: "project-sync",
    title: "项目协同与站会机制",
    chapter: "项目协同、上线与复盘",
    sequence: 18,
    status: "locked",
    prerequisites: ["req-review"],
    minutes: 35,
    goal: "说明产品经理在迭代协同中的信息同步职责。",
    criteria: ["描述一次站会的信息结构"],
    section: "第 6 章",
    resources: [resC1],
    insufficient: true, // 演示「待补充资料」
  }),
  makeNode({
    id: "launch-retro",
    title: "上线与迭代复盘",
    chapter: "项目协同、上线与复盘",
    sequence: 19,
    status: "locked",
    prerequisites: ["project-sync"],
    minutes: 40,
    goal: "用一次复盘模板分析上线后的数据与问题。",
    criteria: ["写出一条基于数据的复盘结论"],
    section: "第 6 章",
    resources: [resC1],
  }),
];

/* ---------------- 学习路径（按角色） ---------------- */

export const PATH_RATIONALE: PathRationale = {
  curriculumTitle: CURRICULUM_TITLE,
  curriculumVersion: CURRICULUM_VERSION,
  generatedAt: daysAgo(12),
  goalProfile: "在职补强 · 每周 5 小时 · 6 周完成需求分析与基础 PRD",
  providerLabel: "AI 整理（演示）· DeepSeek 编排",
  searchProviderLabel: "Search Provider Mock",
  retainedChapters: ["用户研究与需求分析", "产品方案与信息架构"],
  deferredChapters: ["原型设计与用户体验", "PRD 撰写与需求评审"],
  skippedOrReview: ["项目协同、上线与复盘 已后置，建议先补需求分析"],
  evidenceCoverageSummary: "重点节点均有 A/B 级来源；1 个节点外部资料待补充。",
};

export function buildPathNodeStatuses(completedIds: string[], currentId: string): Record<string, NodeStatus> {
  const map: Record<string, NodeStatus> = {};
  let active = false;
  for (const n of KNOWLEDGE_NODES) {
    if (completedIds.includes(n.id)) {
      map[n.id] = "completed";
      continue;
    }
    if (n.id === currentId) {
      map[n.id] = "current";
      active = true;
      continue;
    }
    if (active) {
      map[n.id] = n.prerequisiteIds.length === 0 ? "available" : "locked";
      continue;
    }
    map[n.id] = "locked";
  }
  return map;
}

export const PATH_PM: LearningPath = (() => {
  const completedIds = ["role-basics", "pm-mindset", "decision-boundary", "user-research-basics"];
  const currentId = "need-signal";
  const statusMap = buildPathNodeStatuses(completedIds, currentId);
  const nodes = KNOWLEDGE_NODES.map((n) => ({ ...n, status: statusMap[n.id] }));
  return {
    id: "path-pm",
    title: CURRICULUM_TITLE,
    status: "in_progress",
    curriculumVersion: CURRICULUM_VERSION,
    goalSummary: "6 周内完成有证据的需求分析与基础 PRD；每周 5 小时。",
    weeklyHours: 5,
    deadline: inDays(30),
    estimatedWeeks: 6,
    progress: { completed: completedIds.length, total: nodes.length },
    currentNodeId: currentId,
    nodes,
    rationale: PATH_RATIONALE,
    createdAt: daysAgo(12),
    lastActivityAt: daysAgo(0),
    isPrimary: true,
  };
})();

export const PATH_PAUSED: LearningPath = {
  id: "path-research",
  title: "用户研究方法补强",
  status: "paused",
  curriculumVersion: "v1.2",
  goalSummary: "基于《访谈与洞察》教材补充用户研究方法，暂停中。",
  weeklyHours: 3,
  deadline: inDays(45),
  estimatedWeeks: 6,
  progress: { completed: 2, total: 9 },
  currentNodeId: null,
  nodes: [],
  rationale: {
    curriculumTitle: "用户研究方法补强",
    curriculumVersion: "v1.2",
    generatedAt: daysAgo(20),
    goalProfile: "访谈、洞察、假设验证专项",
    providerLabel: "AI 整理（演示）",
    searchProviderLabel: "Search Provider Mock",
    retainedChapters: [],
    deferredChapters: [],
    skippedOrReview: [],
    evidenceCoverageSummary: "核心节点有 B 级来源。",
  },
  createdAt: daysAgo(20),
  lastActivityAt: daysAgo(9),
  isPrimary: false,
};

/* ---------------- 费曼练习 ---------------- */

const mkMsg = (id: string, role: PracticeMessage["role"], content: string, turnIndex: number, status: PracticeMessage["status"] = "sent"): PracticeMessage => ({
  id, role, content, turnIndex, status, createdAt: daysAgo(0),
});

/** 陈思：已完成并获得评价的会话（对应 need-signal 的费曼练习） */
export const PRACTICE_DONE: PracticeSession = {
  id: "session-done-01",
  nodeId: "need-signal",
  status: "completed",
  currentRound: 4,
  totalRounds: 5,
  startedAt: daysAgo(1),
  updatedAt: daysAgo(0),
  draft: "",
  draftSavedAt: null,
  syncState: "saved",
  messages: [
    mkMsg("m1", "ai", "用户说想要「一键导出按钮」，为什么不能直接把它写进 PRD 里的需求描述？", 1),
    mkMsg("m2", "user", "因为「按钮」只是用户想到的一个方案。用户的底层任务可能是：把当前筛选结果带走，用于跨团队沟通或归档。", 2),
    mkMsg("m3", "ai", "那你怎么判断底层任务到底是什么？会不会是你的猜测？", 2),
    mkMsg("m4", "user", "需要回到用户任务。我可以问目标用户：什么时候、多久导出一次、导出后拿去做什么；再看是哪个环节产生这个动作。", 3),
    mkMsg("m5", "ai", "如果要写成可验证的需求假设，你会怎么写成功标准？", 3),
    mkMsg("m6", "user", "假设：如果用户能保存并分享带筛选条件的结果链接，每周手动导出请求会下降 30%。验证：上线后观察导出按钮点击率与分享链接使用量。", 4),
    mkMsg("m7", "ai", "清楚，你已经把方案、任务和验证方法串起来了。这一轮到这里，可以结束并生成反馈。", 4),
  ],
};

export const PRACTICE_FEEDBACK_DONE: PracticeFeedback = {
  id: "eval-done-01",
  sessionId: "session-done-01",
  clear: [
    "表象诉求（按钮）与底层任务（带走筛选结果）的区别",
    "通过追问目标用户、使用情境来判断底层任务",
    "给出可验证假设的结构（用户—动作—指标）",
  ],
  toAdd: [
    "假设成功标准的基线设定（当前导出频率是多少）",
    "验证失败后的回退判断",
  ],
  notCovered: [
    "对不同导出需求分层的处理（一次性 vs 周期性）",
  ],
  dimensions: {
    completeness: { label: "完整性", level: 4, note: "覆盖了任务识别、验证方法；成功标准基线略缺。" },
    accuracy: { label: "准确性", level: 4, note: "概念表述准确，与教材 2.3 一致。" },
    clarity: { label: "清晰度", level: 4, note: "结构清楚；可补充一句场景示例让表述更具体。" },
  },
  evidenceRounds: 4,
  providerLabel: "AI 整理（演示）· DeepSeek",
  promptVersion: "feynman-evaluate v1.0",
  generatedAt: daysAgo(0),
  confidenceNotice: "基于本次 4 轮讲解与节点资料给出；为学习建议，不是能力认证。",
  nextStep: [
    { label: "重写一条需求假设（返回节点）", type: "node", nodeId: "need-signal" },
    { label: "进入下一节点：用户研究与需求假设", type: "node", nodeId: "user-research-hypothesis" },
  ],
};

/** 周宁：3 轮未完成会话 + 本地草稿，用于离线/恢复演示 */
export const PRACTICE_UNFINISHED: PracticeSession = {
  id: "session-unfin-zhou",
  nodeId: "need-signal",
  status: "in_progress",
  currentRound: 3,
  totalRounds: 5,
  startedAt: daysAgo(1),
  updatedAt: daysAgo(0),
  draft: "底层任务可能是把筛选结果带到跨部门周报里，这样就不用每次重选条件……",
  draftSavedAt: daysAgo(0),
  syncState: "local_only",
  messages: [
    mkMsg("z1", "ai", "用户说想要「一键导出按钮」，为什么不能直接把它写进 PRD？", 1),
    mkMsg("z2", "user", "因为导出按钮只是用户想到的方案，不是需求本身。", 2),
    mkMsg("z3", "ai", "好。那你认为底层任务可能是什么？有没有证据？", 2),
    mkMsg("z4", "user", "我猜可能是要定期把筛选结果分享给其他人，比如每周发一次报表。", 3),
  ],
};

/** 陈思：另一条进行中的会话（用于首页「继续讲解」场景） */
export const PRACTICE_ACTIVE: PracticeSession = {
  id: "session-active-chen",
  nodeId: "need-signal",
  status: "in_progress",
  currentRound: 2,
  totalRounds: 5,
  startedAt: daysAgo(0),
  updatedAt: daysAgo(0),
  draft: "",
  draftSavedAt: null,
  syncState: "saved",
  messages: [
    mkMsg("a1", "ai", "想象你是第一次接手「导出」需求。用户说想要按钮，你第一步会问什么？", 1),
    mkMsg("a2", "user", "我会先问用户什么时候、在哪里需要导出，以及导出后做什么用。", 2),
  ],
};

export const NOTES: FeynmanNote[] = [
  {
    id: "note-01",
    sessionId: "session-done-01",
    nodeId: "need-signal",
    title: "从按钮需求回到用户任务",
    content:
      "我理解的是：按钮只是一个可能方案，用户的底层任务是把筛选结果带走用于沟通或归档。\n\n我的例子：市场同学每周做一次渠道数据汇报，手动导出很麻烦。\n\n待验证问题：如何量化「每周导出」的基线？成功标准怎么定？",
    keyTerms: ["表象诉求", "底层任务", "可验证假设"],
    pendingQuestions: ["假设成功标准的基线设定"],
    selfAssessed: false,
    updatedAt: daysAgo(0),
    statusFilter: "all",
    sourceTag: "mixed",
  },
  {
    id: "note-02",
    sessionId: "session-done-prev",
    nodeId: "user-research-basics",
    title: "用户访谈如何避免诱导性问题",
    content:
      "避免问「你介意这个功能没有吗」这类引导句。用开放问题 + 具体情境让用户描述行为。\n\n我的例子：改写「你觉得这个按钮有用吗」为「上次你导出数据是什么场景」。",
    keyTerms: ["访谈", "诱导性问题"],
    pendingQuestions: ["访谈记录如何快速归类"],
    selfAssessed: true,
    updatedAt: daysAgo(1),
    statusFilter: "all",
    sourceTag: "user_edit",
  },
  {
    id: "note-03",
    sessionId: "session-done-prev2",
    nodeId: "pm-mindset",
    title: "问题先于方案",
    content:
      "「加个暗黑模式」是方案。要先澄清是阅读场景下的亮度问题，还是减少夜间打扰。",
    keyTerms: ["问题", "方案"],
    pendingQuestions: [],
    selfAssessed: true,
    updatedAt: daysAgo(3),
    statusFilter: "all",
    sourceTag: "ai_draft",
  },
  {
    id: "note-04",
    sessionId: "session-done-prev3",
    nodeId: "role-basics",
    title: "产品经理的协作边界",
    content:
      "负责需求与方案，对结果负责；不替代研发做技术方案，不替代设计做视觉。",
    keyTerms: ["协作边界"],
    pendingQuestions: [],
    selfAssessed: true,
    updatedAt: daysAgo(5),
    statusFilter: "all",
    sourceTag: "ai_draft",
  },
];

export { daysAgo, inDays, iso };
