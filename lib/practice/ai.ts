/**
 * 知径 Pathfinder — 练习 AI 编排（M5：真实 AI + Mock 兜底）
 *
 * 三个纯函数统一走 LlmProvider（DEEPSEEK_ENABLED=true 时为 DeepSeek，否则 /
 * 任何失败时为 Mock）。真实 AI 抛错（非法 JSON / 超时 / 5xx / quota）时降级 Mock，
 * 练习流程绝不因 AI 中断。错误只记录可诊断信息，不记录密钥。
 */
import { getAiProvider, getAiStatus } from "@/lib/ai";
import { MockProvider } from "@/lib/ai/mock";
import type { AiChatMessage } from "@/lib/ai/types";
import type { PracticeMessage } from "@/lib/types";

export interface PracticeNodeContext {
  id: string;
  title?: string;
  capabilityGoal?: string;
}

export interface PracticeEvaluationInput {
  clear: string[];
  toAdd: string[];
  notCovered: string[];
  dimensions: {
    completeness: { label: string; level: number; note: string };
    accuracy: { label: string; level: number; note: string };
    clarity: { label: string; level: number; note: string };
  };
  evidenceRounds: number;
  providerLabel: string;
  promptVersion: string;
  confidenceNotice: string;
  nextStep: { label: string; nodeId?: string; type: "node" | "practice" | "review" }[];
}

const mockProvider = new MockProvider();
const TOTAL_ROUNDS = 5;

/** 依据当前引擎标注 providerLabel：Mock 必须带「（演示）」，真实 AI 不带 */
function providerLabelFor(isDemo: boolean): string {
  return isDemo ? "AI 整理（演示）· Mock 编排" : "AI 整理";
}

/** 开场 AI 追问（turn 1）：每次新会话由 AI 学生先抛出第一个问题 */
export async function generatePracticeOpening(node: PracticeNodeContext): Promise<string> {
  try {
    const out = await getAiProvider().continuePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history: [],
      round: 1,
      totalRounds: TOTAL_ROUNDS,
      isLastRound: false,
    });
    return out.content;
  } catch (e) {
    console.error("[M5] practice opening 降级 Mock:", e instanceof Error ? e.message : String(e));
    const out = await mockProvider.continuePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history: [],
      round: 1,
      totalRounds: TOTAL_ROUNDS,
      isLastRound: false,
    });
    return out.content;
  }
}

/** 依据对话历史生成 AI 追问（最后一轮收束总结） */
export async function generatePracticeFollowUp(
  node: PracticeNodeContext,
  messages: PracticeMessage[],
): Promise<string> {
  const history = toAiHistory(messages);
  const round = messages.length ? Math.max(...messages.map((m) => m.turnIndex)) : 1;
  try {
    const out = await getAiProvider().continuePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history,
      round,
      totalRounds: TOTAL_ROUNDS,
      isLastRound: round >= TOTAL_ROUNDS,
    });
    return out.content;
  } catch (e) {
    console.error("[M5] practice follow-up 降级 Mock:", e instanceof Error ? e.message : String(e));
    const out = await mockProvider.continuePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history,
      round,
      totalRounds: TOTAL_ROUNDS,
      isLastRound: round >= TOTAL_ROUNDS,
    });
    return out.content;
  }
}

/** 生成练习评价；nodeId 归属校验由调用方（service）统一处理 */
export async function generatePracticeEvaluation(
  node: PracticeNodeContext,
  messages: PracticeMessage[],
): Promise<PracticeEvaluationInput> {
  const evidenceRounds = messages.filter((m) => m.role === "user").length;
  const history = toAiHistory(messages);
  const isDemoEngine = getAiStatus().isDemo;
  try {
    const out = await getAiProvider().evaluatePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history,
      evidenceRounds,
    });
    return {
      ...out,
      evidenceRounds,
      providerLabel: providerLabelFor(isDemoEngine),
      promptVersion: "feynman-evaluate v1.0",
      // node 类型下一步强制指向当前节点，避免模型输出不存在的 nodeId 造成死链
      nextStep: out.nextStep.map((s) =>
        s.type === "node" ? { ...s, nodeId: node.id } : s,
      ),
    };
  } catch (e) {
    console.error("[M5] practice evaluate 降级 Mock:", e instanceof Error ? e.message : String(e));
    const out = await mockProvider.evaluatePractice({
      node: { title: node.title ?? "", capabilityGoal: node.capabilityGoal ?? "" },
      history,
      evidenceRounds,
    });
    return {
      ...out,
      evidenceRounds,
      providerLabel: providerLabelFor(true),
      promptVersion: "feynman-evaluate v1.0",
      nextStep: out.nextStep.map((s) =>
        s.type === "node" ? { ...s, nodeId: node.id } : s,
      ),
    };
  }
}

/** PracticeMessage[] → AiChatMessage[]（领域 → provider 契约） */
function toAiHistory(messages: PracticeMessage[]): AiChatMessage[] {
  return messages.map((m) => ({
    role: m.role === "ai" ? "assistant" : "user",
    content: m.content,
  }));
}
