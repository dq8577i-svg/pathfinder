/**
 * 知径 Pathfinder — demo 模式主题数据包生成器（P1/P2 全模块主题一致）
 *
 * 用户可输入任意学习主题；产品经理主题复用已策展教材骨架，其他主题
 * 使用确定性演示生成器，保持路径及 P1/P2 模块内容一致。
 * 完整 LearningPath + skills / cards / scenarios / library / portfolio / search 全部模块数据。
 * 纯函数、零 DB、零网络，可被 Node（e2e 单元脚本）与浏览器（模块页）共同 import。
 *
 * 镜像 api 模式派生逻辑：
 *  - lib/path/service.ts buildSkillItems（plan 技能 → 节点）
 *  - lib/ai/mock.ts generateLearningPlan / generateReviewCards / generateScenario（节点 → 内容）
 *  - lib/library/service.ts favoriteResource（路径资源 → 资料库收藏）
 * 全部字符串由 goal.topic 构成，零「产品经理」PM 内容。
 */
import type {
  KnowledgeNode,
  LearningPath,
  LibraryItem,
  MemoryCard,
  PathRationale,
  PortfolioItem,
  ResourceEvidence,
  Scenario,
  SearchResult,
  SkillDimension,
} from "@/lib/types";
import { goalProfileOf, type LearningGoalInput } from "@/lib/plan/goal";
import { PATH_PM } from "./data";

export interface DemoTopicBundle {
  goal: LearningGoalInput;
  generatedAt: string;
  title: string;
  path: LearningPath;
  skills: SkillDimension[];
  cards: MemoryCard[];
  scenarios: Scenario[];
  library: LibraryItem[];
  portfolio: PortfolioItem[];
}

const DEMO_PROVIDER_LABEL = "AI 整理（演示）· Mock 编排";
const DEMO_SEARCH_LABEL = "Search Provider Mock";

function isProductManagerTopic(topic: string): boolean {
  return /产品经理|product\s*manager|\bpm\b/i.test(topic.trim());
}

function productManagerPhases(): { name: string; reason: string }[] {
  return [
    { name: "产品思维与角色边界", reason: "建立问题、价值、用户与产品决策的基础框架" },
    { name: "需求与竞品分析", reason: "从表象诉求识别真实任务，并形成可验证的需求假设" },
    { name: "原型、体验与 PRD", reason: "把方案转成可评审、可实现、可验收的产品表达" },
    { name: "AI 产品落地与数据验证", reason: "理解模型边界、数据指标、风险与迭代闭环" },
  ];
}

/** 稳定 id 用 slug：保留字母/数字/中日韩文字，其余转中划线（本地副本，不动 api 实现） */
function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "topic"
  );
}

function topicSkills(topic: string): { name: string; reason: string }[] {
  return [
    { name: `${topic} 基础入门`, reason: `建立「${topic}」的概念与最小知识闭环` },
    { name: `${topic} 核心方法`, reason: `掌握${topic}最关键的方法与工具` },
    { name: `${topic} 综合实战`, reason: `通过真实任务把前两步串起来` },
  ];
}

/** 规划预览（title + generic rationale）——onboarding 预览与确认共用同一来源 */
export function demoPlanOf(goal: LearningGoalInput): { title: string; rationale: PathRationale } {
  const isPm = isProductManagerTopic(goal.topic);
  const skills = isPm ? productManagerPhases() : topicSkills(goal.topic);
  const weeks = skills.map((skill, index) => ({ week: index + 1, skills: [skill.name] }));
  const title = isPm ? "AI 产品经理基础能力路径" : `${goal.topic}学习路径`;
  return {
    title,
    rationale: {
      kind: isPm ? "curriculum" : "generic",
      curriculumTitle: isPm ? "AI 产品经理训练营" : undefined,
      curriculumVersion: isPm ? "v1.0" : undefined,
      topic: goal.topic,
      goal: goal.goal,
      currentLevel: goal.currentLevel,
      weeklyHours: goal.weeklyHours,
      deadlineWeeks: goal.deadlineWeeks,
      preferences: goal.preferences,
      title,
      rationale: isPm
        ? `以产品经理教材的 19 个知识节点为能力骨架，根据你的基础与每周 ${goal.weeklyHours} 小时投入安排顺序；AI 只调整节奏，不删除核心章节。`
        : `围绕「${goal.topic}」，按「基础 → 方法 → 实战」推进；每周 ${goal.weeklyHours} 小时，共 ${goal.deadlineWeeks} 周。`,
      skills,
      weeks,
      goalProfile: goalProfileOf(goal),
      providerLabel: DEMO_PROVIDER_LABEL,
      searchProviderLabel: DEMO_SEARCH_LABEL,
      generatedAt: new Date().toISOString(),
    },
  };
}

/** 为节点生成 2 条主题化资源证据（A 级教材 + B 级文章），供资料库收藏与技能证据 */
function nodeResources(
  topicSlug: string,
  skillSlug: string,
  skillName: string,
  now: string,
): ResourceEvidence[] {
  const a: ResourceEvidence = {
    id: `res-${topicSlug}-${skillSlug}-a`,
    title: `${skillName} 教材章节`,
    domain: "教材",
    grade: "A",
    sourceType: "textbook",
    sourceName: "知径演示资料",
    checkedAt: now,
    retrievedAt: now,
    reason: `围绕「${skillName}」的基础概念，A 级教材优先。`,
    url: `https://example.org/learn/${topicSlug}/${skillSlug}`,
    accessibilityStatus: "verified",
    licenseNote: "演示资源，仅用于展示。",
  };
  const b: ResourceEvidence = {
    id: `res-${topicSlug}-${skillSlug}-b`,
    title: `${skillName} 精选文章`,
    domain: "公开资料",
    grade: "B",
    sourceType: "article",
    sourceName: "公开文章",
    checkedAt: now,
    retrievedAt: now,
    reason: `补充「${skillName}」的方法与实践视角。`,
    url: `https://example.org/learn/${topicSlug}/${skillSlug}/method`,
    accessibilityStatus: "verified",
    licenseNote: "演示资源，仅用于展示。",
  };
  return [a, b];
}

/** 由学习目标确定性生成完整 demo 主题数据包 */
export function buildDemoTopicBundle(goal: LearningGoalInput): DemoTopicBundle {
  const generatedAt = new Date().toISOString();
  const topicSlug = slugify(goal.topic);
  const isPm = isProductManagerTopic(goal.topic);
  const skills = isPm ? productManagerPhases() : topicSkills(goal.topic);
  const title = isPm ? "AI 产品经理基础能力路径" : `${goal.topic}学习路径`;
  const now = generatedAt;

  // 产品经理主题复用已策展的完整 19 节点教材；其他主题使用三段式派生。
  const nodes: KnowledgeNode[] = isPm
    ? PATH_PM.nodes.map((node, index) => ({
        ...node,
        status: index === 0 ? ("available" as const) : ("locked" as const),
        resources: node.resources.map((resource) => ({ ...resource })),
      }))
    : skills.map((skill, i) => {
        const skillSlug = slugify(skill.name);
        const nodeId = `gen-${topicSlug}-${skillSlug}`;
        const prerequisiteIds =
          i === 0 ? [] : [`gen-${topicSlug}-${slugify(skills[i - 1].name)}`];
        return {
          id: nodeId,
          title: skill.name,
          chapter: `第 ${i + 1} 周`,
          sequence: i + 1,
          status: i === 0 ? ("available" as const) : ("locked" as const),
          prerequisiteIds,
          estimatedMinutes: Math.max(20, Math.round(goal.weeklyHours * 60)),
          capabilityGoal: skill.reason,
          completionCriteria: [`能用自己的话讲清「${skill.name}」的核心概念`, "完成对应练习并自评"],
          evidenceCoverage: { hasAB: true, aCount: 1, bCount: 1, cCount: 0, insufficient: false },
          resources: nodeResources(topicSlug, skillSlug, skill.name, now),
          scenario: `同事问你「${skill.name}」里一个概念怎么理解，你要用一次真实对话把它讲清。`,
        };
      });

  // 2) 完整路径
  const path: LearningPath = {
    id: isPm ? "demo-path-ai-pm-curriculum" : `demo-path-${topicSlug}`,
    title,
    status: "in_progress",
    curriculumVersion: isPm ? "v1.0" : "demo-v1",
    goalSummary: goal.goal || `系统学习「${goal.topic}」`,
    weeklyHours: goal.weeklyHours,
    deadline: new Date(new Date(generatedAt).getTime() + goal.deadlineWeeks * 7 * 86400000).toISOString(),
    estimatedWeeks: goal.deadlineWeeks,
    progress: { completed: 0, total: nodes.length },
    currentNodeId: nodes[0]?.id ?? null,
    nodes,
    rationale: demoPlanOf(goal).rationale,
    createdAt: generatedAt,
    lastActivityAt: generatedAt,
    isPrimary: true,
  };

  // 3) 技能雷达：一节点一维（镜像 lib/skills/service.ts）
  const skillDims: SkillDimension[] = nodes.map((n) => ({
    id: n.id,
    name: n.title,
    level: n.status === "available" ? "学习中" : "待开始",
    evidenceCount: n.resources.length,
    confidence: n.resources.length >= 3 ? "high" : n.resources.length >= 1 ? "medium" : "low",
    evidences: n.resources.map((r) => ({
      sourceType: `资料·${r.grade}级`,
      claim: r.title,
      sourceId: r.id,
      createdAt: r.checkedAt,
    })),
    recommendation:
      n.status === "locked"
        ? {
            gapType: "证据不足",
            nextAction: `完成「${n.title}」的练习并复盘`,
            reason: `当前仅有基础资料，建议通过实战补充证据。`,
          }
        : undefined,
  }));

  // 4) 复习卡片：一节点一卡（镜像 MockProvider.generateReviewCards）
  const cards: MemoryCard[] = nodes.map((n) => ({
    id: `card-${n.id}`,
    nodeId: n.id,
    front: `用自己的话解释：「${n.title}」的核心要点是什么？`,
    backSummary: `${n.capabilityGoal}。自查：${n.completionCriteria.slice(0, 2).join("；")}`,
    sourceKind: "node",
    sourceTitle: title,
    tags: [goal.topic],
    dueAt: generatedAt,
    intervalDays: 1,
    easeFactor: 2.5,
    status: "due",
  }));

  // 5) 情境练习：一节点一场景（镜像 templateScenarioForNode）
  const scenarios: Scenario[] = nodes.map((n) => ({
    id: `scen-${n.id}`,
    title: `${n.title}实战练习`,
    summary: `围绕「${n.title}」的工作场景练习澄清、解释与辩护。`,
    persona: "业务协作方（演示）",
    personaRole: "业务方",
    skillTags: [goal.topic],
    difficulty: "初级",
    estimatedMinutes: n.estimatedMinutes,
    sourceNodeId: n.id,
    competencyId: n.id,
    task: `结合「${n.title}」：先澄清任务背景与约束，再说明你打算如何达成「${n.capabilityGoal}」。`,
    goal: n.capabilityGoal,
    completionCriteria: [`围绕「${n.title}」组织思路`, "交代方法与依据", "把目标落实为可执行步骤"],
    openingLine: `业务协作方：你接到一个与「${n.title}」相关的真实任务，我们开始吧。`,
    scenarioVersion: "demo-v1",
    auxiliaryDocs: [
      { label: `${n.title} 背景资料`, content: `围绕「${n.title}」的演示情境说明。`, isFictional: true },
    ],
    status: "published",
  }));

  // 6) 个人资料库：路径资源收藏（source_type=resource）+ 手动 note/file（镜像 api 收藏流）
  const library: LibraryItem[] = [
    ...nodes.flatMap((n) =>
      n.resources.map((r) => ({
        id: `lib-${r.id}`,
        kind: "link" as const,
        title: r.title,
        url: r.url,
        sourceName: r.sourceName,
        tags: [goal.topic],
        linkedNodeIds: [n.id],
        visibility: "private" as const,
        checkedAt: r.checkedAt,
        status: "verified" as const,
        memo: r.reason,
        licenseNote: r.licenseNote,
      })),
    ),
    {
      id: `lib-${topicSlug}-note`,
      kind: "note",
      title: `${goal.topic} 学习摘记`,
      sourceName: "手动添加",
      tags: [goal.topic],
      linkedNodeIds: [],
      visibility: "private",
      checkedAt: generatedAt,
      status: "verified",
      memo: `记录「${goal.topic}」学习中的要点与疑问。`,
      licenseNote: "由用户添加；请确保你拥有保存与分享的权利。",
    },
    {
      id: `lib-${topicSlug}-file`,
      kind: "file",
      title: `${goal.topic} 复习清单.pdf`,
      objectKey: `demo/${topicSlug}-notes.pdf`,
      size: "2.4 MB",
      sourceName: "本人上传",
      tags: [goal.topic],
      linkedNodeIds: [],
      visibility: "private",
      checkedAt: generatedAt,
      status: "verified",
      memo: `${goal.topic} 复习要点清单`,
      licenseNote: "本人上传，仅自己可见。",
    },
  ];

  // 7) 作品集：主题化挑战 + 笔记
  const portfolio: PortfolioItem[] = [
    {
      id: `pf-${topicSlug}-challenge`,
      type: "challenge",
      title: `${goal.topic} 实战项目`,
      summary: `把「${goal.topic}」的基础、方法与实战综合成一个可交付的小项目。`,
      skillTags: [goal.topic],
      sourcePath: title,
      visibility: "private",
      updatedAt: generatedAt,
    },
    {
      id: `pf-${topicSlug}-note`,
      type: "note",
      title: `${goal.topic} 学习笔记`,
      summary: `整理「${goal.topic}」的核心概念与自己的理解，沉淀成可回顾的笔记。`,
      skillTags: [goal.topic],
      sourcePath: title,
      visibility: "private",
      updatedAt: generatedAt,
    },
  ];

  return {
    goal,
    generatedAt,
    title,
    path,
    skills: skillDims,
    cards,
    scenarios,
    library,
    portfolio,
  };
}

/** 语义搜索数据源：节点 + 资料库收藏 + 作品集笔记（全部来自主题数据包） */
export function topicSearchResults(bundle: DemoTopicBundle): SearchResult[] {
  const { path, library, portfolio } = bundle;
  const nodeHits: SearchResult[] = path.nodes.map((n) => ({
    id: n.id,
    type: "node",
    title: n.title,
    snippet: n.capabilityGoal,
    matchReasons: ["路径节点"],
    scoreLabel: "高",
    source: path.title,
    accessReason: "来自你的学习路径",
    tier: "A",
  }));
  const resourceHits: SearchResult[] = library
    .filter((it) => it.url)
    .map((it) => ({
      id: `res-${it.id}`,
      type: "resource",
      title: it.title,
      snippet: it.memo || it.title,
      matchReasons: ["资料库收藏"],
      scoreLabel: "中",
      source: it.sourceName,
      accessReason: "来自你的个人资料库",
      url: it.url,
    }));
  const noteHits: SearchResult[] = portfolio
    .filter((p) => p.type === "note")
    .map((p) => ({
      id: `note-${p.id}`,
      type: "note",
      title: p.title,
      snippet: p.summary,
      matchReasons: ["作品集"],
      scoreLabel: "中",
      source: "你的作品集",
      accessReason: "来自你的作品集",
    }));
  return [...nodeHits, ...resourceHits, ...noteHits];
}
