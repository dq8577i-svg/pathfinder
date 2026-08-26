/**
 * Mock AI Provider（演示默认 / 真实引擎失败时的兜底）。
 * 纯本地确定性回复：无任何外发请求、无密钥、无网络依赖。
 * 所有输出以「AI 整理（演示）」为标识，绝不伪装成 DeepSeek。
 */
import type {
  AiChatRequest,
  AiChatResult,
  AiProvider,
  ContinuePracticeOutput,
  ContinuePracticeRequest,
  EvaluatePracticeOutput,
  EvaluatePracticeRequest,
  GenerateLearningPlanOutput,
  GenerateLearningPlanRequest,
  GenerateReviewCardsOutput,
  GenerateReviewCardsRequest,
  GenerateScenarioOutput,
  GenerateScenarioRequest,
  GeneratedSkill,
  GeneratedWeek,
} from "./types";

const FEYNMAN_QUESTIONS = [
  "能用你自己的话，把「表象需求」和「真实需求」各举一个例子讲清楚吗？",
  "如果用户坚持要「一键导出」这个按钮，你会用什么方法确认他背后的真实任务是什么？",
  "要写出一条可验证的需求假设，成功标准应该怎么定？验证失败时回退的判断又是什么？",
  "这条假设和你当前节点的能力目标有什么关系？完成它需要具备哪些前置知识？",
  "用你自己的话总结一下：这个节点最重要、最想让我记住的一个概念是什么？",
];

const DEMO_PREFACE = "AI 整理（演示）";
const MOCK_PROVIDER_LABEL = "AI 整理（演示）· Mock 编排";
const MOCK_SEARCH_LABEL = "Search Provider Mock";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export class MockProvider implements AiProvider {
  readonly kind = "demo" as const;

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const last = req.messages[req.messages.length - 1]?.content ?? "";
    const topic = req.context?.nodeTitle ?? "当前主题";
    let content: string;

    if (req.mode === "feynman") {
      const idx = hash(last + topic) % FEYNMAN_QUESTIONS.length;
      content = `${DEMO_PREFACE}｜${FEYNMAN_QUESTIONS[idx]}`;
    } else {
      content =
        `${DEMO_PREFACE}｜围绕「${topic}」的目标与能力骨架，为你梳理学习要点与下一步：\n` +
        `1. 核心概念：先把方案与底层任务分开，写出可验证的需求假设；\n` +
        `2. 关键证据：A 级教材章节优先，公开资料作为补充并标注来源等级；\n` +
        `3. 建议练习：用费曼追问检验是否真的讲清，再进入下一个节点。`;
    }

    return {
      content,
      provider: "demo",
      model: "mock",
      generatedAt: new Date().toISOString(),
      isDemo: true,
    };
  }

  /* ---------------- M5：LlmProvider 三方法（确定性降级） ---------------- */

  async generateLearningPlan(req: GenerateLearningPlanRequest): Promise<GenerateLearningPlanOutput> {
    const topic = req.goal.topic;
    const preferences = req.goal.preferences.length > 0 ? req.goal.preferences.join("、") : "项目驱动";
    // 确定性骨架：围绕用户 topic 的三段式（基础 → 方法 → 实战），诚实标注为演示编排
    const skills: GeneratedSkill[] = [
      { name: `${topic} 基础入门`, reason: `建立「${topic}」的概念与最小知识闭环` },
      { name: `${topic} 核心方法`, reason: `掌握${topic}最关键的方法与工具` },
      { name: `${topic} 综合实战`, reason: `通过真实任务把前两步串起来` },
    ];
    const weeks: GeneratedWeek[] = [
      { week: 1, skills: [skills[0].name] },
      { week: 2, skills: [skills[1].name] },
      { week: 3, skills: [skills[2].name] },
    ];
    return {
      title: `${topic}学习路径`,
      rationale: `围绕「${topic}」，按「基础 → 方法 → 实战」推进；每周 ${req.goal.weeklyHours} 小时，共 ${req.goal.deadlineWeeks} 周，偏好：${preferences}。`,
      skills,
      weeks,
      providerLabel: MOCK_PROVIDER_LABEL,
      searchProviderLabel: MOCK_SEARCH_LABEL,
    };
  }

  /* ---------------- P1/P2：复习卡片 + 情境练习场景（确定性模板，围绕真实节点内容） ---------------- */

  async generateReviewCards(req: GenerateReviewCardsRequest): Promise<GenerateReviewCardsOutput> {
    const cards = req.nodes.slice(0, 3).map((n) => ({
      question: `用自己的话解释：「${n.title}」的核心要点是什么？`,
      answer:
        (n.capabilityGoal || `能独立完成「${n.title}」相关任务`) +
        `。自查：` +
        ((n.completionCriteria || []).slice(0, 2).join("；") || "对照该节点能力目标逐项核对"),
    }));
    return { cards };
  }

  async generateScenario(req: GenerateScenarioRequest): Promise<GenerateScenarioOutput> {
    const t = req.node.title;
    const g = req.node.capabilityGoal || `应用「${t}」解决实际问题`;
    return {
      title: `${t}实战练习`,
      situation: `你在工作中接到一个与「${t}」相关的真实任务。对方对你并不熟悉，需要你一边沟通一边完成。`,
      task: `结合「${t}」：先澄清任务背景与约束，再说明你打算如何达成「${g}」。`,
      aiRole: `AI 扮演一位需要你协助的业务协作方，会追问你的做法与依据。`,
      rubric: `1) 是否围绕「${t}」组织思路；2) 是否交代了方法与依据；3) 能否把目标「${g}」落实为可执行步骤。`,
    };
  }

  async continuePractice(req: ContinuePracticeRequest): Promise<ContinuePracticeOutput> {
    const last = req.history[req.history.length - 1]?.content ?? "";
    const idx = hash(last + req.node.title) % FEYNMAN_QUESTIONS.length;
    const content = `${DEMO_PREFACE}｜${FEYNMAN_QUESTIONS[idx]}`;
    return { content };
  }

  async evaluatePractice(req: EvaluatePracticeRequest): Promise<EvaluatePracticeOutput> {
    const rounds = req.evidenceRounds;
    const base = Math.min(5, 2 + Math.floor(rounds / 2));
    const lv = (clamp: number) => Math.min(5, Math.max(1, clamp));
    const last = req.history.filter((m) => m.role === "user").pop()?.content ?? "";
    const head = last.replace(/\s+/g, " ").trim();
    const clear = head ? [head.length > 24 ? `${head.slice(0, 24)}…` : head] : [];
    return {
      clear,
      toAdd: [
        `围绕「${req.node.title}」补充一个可验证的量化成功标准`,
        "给出验证失败后的回退判断",
      ],
      notCovered: rounds < 3 ? ["用情境示例串起完整任务链路"] : [],
      dimensions: {
        completeness: { label: "完整性", level: lv(base), note: rounds ? "覆盖了任务识别与验证方法；成功标准基线可再细化。" : "暂无用户讲解可供判定。" },
        accuracy: { label: "准确性", level: lv(base - 1), note: "概念表述与教材一致，未见明显偏离。" },
        clarity: { label: "清晰度", level: lv(base), note: "结构清楚；补充一个场景示例会让表述更具体。" },
      },
      confidenceNotice: `基于本次 ${rounds} 轮讲解与节点资料给出；为学习建议，不是能力认证。`,
      nextStep: [
        { label: `返回节点：${req.node.title} 复习要点`, type: "node", nodeId: "unknown" },
        { label: "再开一轮练习，检验掌握度", type: "practice" },
      ],
    };
  }
}
