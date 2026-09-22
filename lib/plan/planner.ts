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
import { searchProviderLabel } from "@/lib/search";

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
  const activeSearchProvider = searchProviderLabel();
  const isPrimaryProductManagerPath = /产品经理/i.test(goal.topic.trim());

  // 产品经理是已策展的推荐模板，不是产品边界。用户选择该主题时复用
  // 19 节点教材；其他主题由 Provider 根据用户输入自由生成。
  if (isPrimaryProductManagerPath && existingNodeTitles.length >= 19) {
    const curatedTitles = existingNodeTitles.slice(0, 19);
    const weekCount = Math.max(1, Math.min(goal.deadlineWeeks, curatedTitles.length));
    const weeks: GeneratedWeek[] = Array.from({ length: weekCount }, (_, index) => ({
      week: index + 1,
      skills: [],
    }));
    curatedTitles.forEach((title, index) => {
      const weekIndex = Math.min(
        weekCount - 1,
        Math.floor((index * weekCount) / curatedTitles.length),
      );
      weeks[weekIndex].skills.push(title);
    });
    return {
      goalProfile,
      title: "AI 产品经理基础能力路径",
      rationale:
        `以经审核的 19 个产品经理教材节点为能力骨架，根据“${goal.currentLevel}”基础、` +
        `每周 ${goal.weeklyHours} 小时和 ${goal.deadlineWeeks} 周期限编排节奏；AI 不删除核心章节。`,
      skills: curatedTitles.map((name) => ({
        name,
        reason: `完成产品经理教材节点「${name}」并形成可验证的学习证据`,
      })),
      weeks,
      providerLabel: plan.providerLabel,
      searchProviderLabel: activeSearchProvider,
    };
  }
  return {
    goalProfile,
    title: plan.title,
    rationale: plan.rationale,
    skills: plan.skills,
    weeks: plan.weeks,
    providerLabel: plan.providerLabel,
    searchProviderLabel: activeSearchProvider,
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
