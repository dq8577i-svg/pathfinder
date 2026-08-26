/**
 * AI Provider 抽象层类型契约。
 * 兼容未来真实 DeepSeek / 任意 Anthropic 兼容端点；
 * 演示环境默认使用 MockProvider，全部输出标注「AI 整理（演示）」。
 * 密钥只存在于服务端环境变量，绝不下发到客户端。
 */
import type { LearningGoalInput } from "@/lib/plan/goal";

export type AiProviderKind = "demo" | "deepseek";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AiMode = "feynman" | "chat";

export interface AiChatRequest {
  system?: string;
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /** feynman 模式：模型扮演"一次只问一个问题"的 AI 学生 */
  mode?: AiMode;
  /** 当前上下文，用于 mock 生成更贴合的演示回复 */
  context?: {
    nodeTitle?: string;
    capabilityGoal?: string;
    scenarioTitle?: string;
  };
}

export interface AiChatResult {
  content: string;
  provider: AiProviderKind;
  model?: string;
  generatedAt: string;
  /** 演示模式恒为 true；真实接入后为 false，前端可据此去掉「（演示）」标注 */
  isDemo: boolean;
}

export interface AiProvider {
  readonly kind: AiProviderKind;
  chat(req: AiChatRequest): Promise<AiChatResult>;

  /* ---------- M5+：LlmProvider 三方法（结构化输出，Zod 校验 + Mock 降级） ---------- */

  /** 任意主题学习路径编排：把用户目标拆解为 skills + weeks 阶段 */
  generateLearningPlan(req: GenerateLearningPlanRequest): Promise<GenerateLearningPlanOutput>;

  /** 费曼 AI 学生追问：基于对话历史生成下一句追问（最后一轮改为总结收束） */
  continuePractice(req: ContinuePracticeRequest): Promise<ContinuePracticeOutput>;

  /** 练习评价：依据讲解对话生成三维度判定与下一步 */
  evaluatePractice(req: EvaluatePracticeRequest): Promise<EvaluatePracticeOutput>;

  /* ---------- P1/P2：主题绑定模块生成（复习卡片 / 情境练习场景） ---------- */

  /** 复习卡片生成：基于真实节点内容生成问答卡片（复习中心） */
  generateReviewCards(req: GenerateReviewCardsRequest): Promise<GenerateReviewCardsOutput>;

  /** 情境练习场景生成：基于真实节点能力目标生成一个练习场景（情境练习场） */
  generateScenario(req: GenerateScenarioRequest): Promise<GenerateScenarioOutput>;
}

export interface GenerateReviewCardsRequest {
  /** 当前路径的真实节点内容 —— AI 依据节点生成卡片，禁止编造其他主题 */
  nodes: { title: string; capabilityGoal: string; completionCriteria: string[] }[];
  /** 近期评价中暴露的薄弱点（可选） */
  weaknesses?: string[];
  /** 期望卡片数（上限 12） */
  count?: number;
}

export interface GeneratedReviewCard {
  question: string;
  answer: string;
}

export interface GenerateReviewCardsOutput {
  cards: GeneratedReviewCard[];
}

export interface GenerateScenarioRequest {
  node: { title: string; capabilityGoal: string };
}

export interface GenerateScenarioOutput {
  title: string;
  situation: string;
  task: string;
  aiRole: string;
  rubric: string;
}

export interface GenerateLearningPlanRequest {
  /** 用户学习目标（任意主题；topic/goal 为用户输入） */
  goal: LearningGoalInput;
  /** 现有知识库节点标题（参考匹配范围；禁止模型输出 nodeId / DB 引用） */
  existingNodeTitles: string[];
}

export interface GeneratedSkill {
  /** 具体可学习的技能/知识点名（会成为 knowledge_node 标题） */
  name: string;
  /** 为什么需要这一步 */
  reason: string;
}

export interface GeneratedWeek {
  /** 第 N 周 */
  week: number;
  /** 本周学习的技能名（必须与 skills[].name 对应） */
  skills: string[];
}

export interface GenerateLearningPlanOutput {
  /** 路径标题（含主题，如「Python 数据分析学习路径」） */
  title: string;
  /** 一句话规划理由 */
  rationale: string;
  skills: GeneratedSkill[];
  weeks: GeneratedWeek[];
  /** 语义：providerLabel 保留为「AI 整理」系列，searchProviderLabel 标注检索来源 */
  providerLabel: string;
  searchProviderLabel: string;
}

export interface ContinuePracticeRequest {
  node: { title: string; capabilityGoal: string };
  history: AiChatMessage[];
  round: number;
  totalRounds: number;
  /** 最后一轮：AI 应总结收束而非继续追问 */
  isLastRound: boolean;
}

export interface ContinuePracticeOutput {
  content: string;
}

export interface EvaluatePracticeRequest {
  node: { title: string; capabilityGoal: string };
  history: AiChatMessage[];
  evidenceRounds: number;
}

export interface EvaluatePracticeOutput {
  clear: string[];
  toAdd: string[];
  notCovered: string[];
  dimensions: {
    completeness: { label: string; level: number; note: string };
    accuracy: { label: string; level: number; note: string };
    clarity: { label: string; level: number; note: string };
  };
  confidenceNotice: string;
  nextStep: { label: string; nodeId?: string; type: "node" | "practice" | "review" }[];
}
