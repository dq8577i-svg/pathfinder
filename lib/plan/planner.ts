/**
 * 知径 Pathfinder — 学习路径规划器（通用学习规划阶段）
 *
 * 依据用户输入的学习目标（任意主题）生成「预览/保存」所需的路径结构。
 * 编排决策（title / rationale / skills / weeks）交给 LlmProvider.generateLearningPlan
 * （DEEPSEEK_ENABLED=true 时为 DeepSeek，否则 / 失败时为 Mock）；
 * 节点 id 由服务端确定性映射生成（见 lib/path/service.ts），绝不信任模型输出的节点引用。
 */
import type { GeneratedSkill, GeneratedWeek } from "@/lib/ai/types";
import type { LearningGoalInput } from "./goal";
import { goalProfileOf } from "./goal";
import { getAiProvider } from "@/lib/ai";
import { MockProvider } from "@/lib/ai/mock";

/** 兜底 Mock（真实 AI 失败时使用；标注不伪装成 DeepSeek） */
const mockProvider = new MockProvider();

export interface GeneratedPlan {
  /** 用户目标画像摘要（topic · 目标 · 水平 · 时间 · 周期） */
  goalProfile: string;
  /** 路径标题（含主题） */
  title: string;
  /** 一句话规划理由 */
  rationale: string;
  /** 核心技能/知识点（按认知顺序） */
  skills: GeneratedSkill[];
  /** 按周排布 */
  weeks: GeneratedWeek[];
  providerLabel: string;
  searchProviderLabel: string;
}

export async function generatePlan(
  goal: LearningGoalInput,
  existingNodeTitles: string[],
): Promise<GeneratedPlan> {
  const goalProfile = goalProfileOf(goal);
  const plan = await runPlanner({ goal, existingNodeTitles });
  return {
    goalProfile,
    title: plan.title,
    rationale: plan.rationale,
    skills: plan.skills,
    weeks: plan.weeks,
    providerLabel: plan.providerLabel,
    searchProviderLabel: plan.searchProviderLabel,
  };
}

/** 真实 AI 编排，失败降级 Mock；错误只记可诊断信息（不含密钥） */
async function runPlanner(req: { goal: LearningGoalInput; existingNodeTitles: string[] }) {
  try {
    return await getAiProvider().generateLearningPlan(req);
  } catch (e) {
    console.error("[M5] generateLearningPlan 降级 Mock:", e instanceof Error ? e.message : String(e));
    return mockProvider.generateLearningPlan(req);
  }
}
