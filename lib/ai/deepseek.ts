/**
 * DeepSeek Provider（Anthropic 兼容端点）。
 * 仅在服务端 Route Handler 中实例化与调用，密钥取自服务端环境变量，
 * 不进入客户端 bundle、不写入日志、不写入仓库。
 *
 * M5 扩展：LlmProvider 三方法（generateLearningPlan / continuePractice /
 * evaluatePractice）。所有结构化输出在方法内做「提取文本 → 去围栏 → JSON.parse →
 * Zod 校验」，任何一步失败都 throw，由调用方降级 Mock。绝不让坏 JSON 进入业务层。
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
} from "./types";
import {
  continuePracticeSchema,
  evaluatePracticeSchema,
  learningPlanSchema,
  reviewCardsSchema,
  scenarioSchema,
} from "./schemas";
import {
  GENERIC_LEARNING_PLAN_SYSTEM,
  PRACTICE_CLOSING,
  PRACTICE_EVALUATE_SYSTEM,
  REVIEW_CARD_SYSTEM,
  SCENARIO_SYSTEM,
  practiceStudentSystem,
} from "./prompts";
import type { AiChatMessage } from "./types";

export interface DeepSeekConfig {
  baseUrl: string;
  authToken: string;
  model?: string;
}

const REQUEST_TIMEOUT_MS = 25_000;

export class DeepSeekProvider implements AiProvider {
  readonly kind = "deepseek" as const;
  private readonly baseUrl: string;
  private readonly authToken: string;
  private readonly model: string;

  constructor(config: DeepSeekConfig) {
    if (!config.baseUrl || !config.authToken) {
      throw new Error("DeepSeek provider missing baseUrl/authToken");
    }
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.authToken = config.authToken;
    this.model = config.model || "deepseek-chat";
  }

  async chat(req: AiChatRequest): Promise<AiChatResult> {
    const content = await this.complete(req.system ?? "", req.messages, req.maxTokens ?? 600, req.temperature ?? 0.6);
    return {
      content,
      provider: "deepseek",
      model: this.model,
      generatedAt: new Date().toISOString(),
      isDemo: false,
    };
  }

  /* ---------------- M5：LlmProvider 结构化方法 ---------------- */

  async generateLearningPlan(req: GenerateLearningPlanRequest): Promise<GenerateLearningPlanOutput> {
    const g = req.goal;
    const user = `## 学习主题
${g.topic}

## 学习目标
${g.goal || "（未单独填写，请根据主题合理理解用户的意图）"}

## 当前水平
${g.currentLevel}

## 每周可用时间
${g.weeklyHours} 小时

## 目标周期
${g.deadlineWeeks} 周

## 偏好
${g.preferences.length > 0 ? g.preferences.join("、") : "（无特别偏好）"}

## 现有知识库节点标题（仅作内容参考，不得输出其 id 或引用）
${JSON.stringify(req.existingNodeTitles)}

请输出规划 JSON。`;

    const rawText = await this.complete(GENERIC_LEARNING_PLAN_SYSTEM, [{ role: "user", content: user }], 1200, 0.4);
    const parsed = learningPlanSchema.parse(normalizePlanList(JSON.parse(rawText)));
    return {
      ...parsed,
      providerLabel: "AI 整理",
      searchProviderLabel: "检索来源（DeepSeek 编排）",
    };
  }

  async continuePractice(req: ContinuePracticeRequest): Promise<ContinuePracticeOutput> {
    const system = req.isLastRound
      ? `${practiceStudentSystem(req.node)}\n\n${PRACTICE_CLOSING}`
      : practiceStudentSystem(req.node);
    // 开场（空历史）时补一条种子消息：Anthropic 兼容端点要求 messages 至少一条
    const history: AiChatMessage[] =
      req.history.length > 0 ? req.history : [{ role: "user", content: "开始。请先向我提出第一个问题。" }];
    const content = await this.complete(system, history, 300, 0.7);
    return continuePracticeSchema.parse({ content });
  }

  async evaluatePractice(req: EvaluatePracticeRequest): Promise<EvaluatePracticeOutput> {
    const system = PRACTICE_EVALUATE_SYSTEM.replace("{concept}", req.node.title);
    const historyJson = req.history.map((m) => `${m.role === "assistant" ? "老师" : "学生"}：${m.content}`).join("\n");
    const user = `概念：${req.node.title}\n能力目标：${req.node.capabilityGoal || "无"}\n\n对话记录：\n${historyJson}\n\n请输出评价 JSON。`;
    const raw = await this.complete(system, [{ role: "user", content: user }], 1000, 0.2);
    const parsed = evaluatePracticeSchema.parse(JSON.parse(raw));
    return {
      ...parsed,
      confidenceNotice: `基于本次 ${req.evidenceRounds} 轮讲解与节点资料给出；为学习建议，不是能力认证。`,
    };
  }

  /* ---------------- P1/P2：复习卡片 + 情境练习场景生成 ---------------- */

  async generateReviewCards(req: GenerateReviewCardsRequest): Promise<GenerateReviewCardsOutput> {
    const nodesText = req.nodes
      .slice(0, 6)
      .map(
        (n, i) =>
          `节点${i + 1}「${n.title}」\n能力目标：${n.capabilityGoal || "无"}\n完成条件：${(n.completionCriteria || []).join("、") || "无"}`,
      )
      .join("\n\n");
    const weaknesses = req.weaknesses && req.weaknesses.length > 0 ? req.weaknesses.join("、") : "（无）";
    const count = Math.min(12, Math.max(1, req.count ?? 5));
    const user = `## 节点内容\n${nodesText}\n\n## 近期薄弱点\n${weaknesses}\n\n请为这些节点生成 ${count} 张复习问答卡片（优先覆盖薄弱点），输出 JSON。`;
    const raw = await this.complete(REVIEW_CARD_SYSTEM, [{ role: "user", content: user }], 1000, 0.3);
    const parsed = reviewCardsSchema.parse(JSON.parse(raw));
    return { cards: parsed.cards.slice(0, count) };
  }

  async generateScenario(req: GenerateScenarioRequest): Promise<GenerateScenarioOutput> {
    const system = SCENARIO_SYSTEM.replace("{topic}", req.node.title);
    const user = `## 节点\n标题：${req.node.title}\n能力目标：${req.node.capabilityGoal || "无"}\n\n请输出场景 JSON。`;
    const raw = await this.complete(system, [{ role: "user", content: user }], 800, 0.5);
    return scenarioSchema.parse(JSON.parse(raw));
  }

  /* ---------------- 内部：单次补全（带超时 + 文本提取 + 围栏清理） ---------------- */

  private async complete(
    system: string,
    messages: AiChatMessage[],
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      // AbortError → 超时；网络错误同样抛给调用方降级
      const isAbort = e instanceof Error && e.name === "AbortError";
      throw new Error(isAbort ? "DeepSeek request timed out" : "DeepSeek request failed");
    }
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 不记录 body 全文（可能含回显），只记录状态码与截断片段
      throw new Error(`DeepSeek API ${res.status}: ${body.slice(0, 120)}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      model?: string;
    };
    const content =
      data.content
        ?.map((c) => c?.text ?? "")
        .filter(Boolean)
        .join("") ?? "";

    if (!content) throw new Error("DeepSeek API empty content");
    return stripFences(content);
  }
}

/** 清理模型输出中的 markdown 围栏（部分模型会在 JSON 外包 ```json```） */
function stripFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const m = t.match(fence);
  return m ? m[1].trim() : t;
}

/**
 * 编排 JSON 字段规范化：真实模型常把「skills / weeks」输出成一句自然语言而非数组，
 * 或把 skills[].name 写成动词句。Zod 拒绝时整体降级 Mock 会浪费一次完整调用，
 * 这里在 parse 前做最小规整，schema 仍保持严格数组契约，业务层类型不变。
 */
function normalizePlanList(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return obj;
  const out = { ...(obj as Record<string, unknown>) };

  // skills：字符串 → 单元素数组；数组项非对象 → 以字符串为 name 补 reason
  if (typeof out.skills === "string") {
    out.skills = out.skills.split(/[、,，;；]/).filter(Boolean).map((name) => ({ name, reason: "根据目标推导的学习技能" }));
  } else if (Array.isArray(out.skills)) {
    out.skills = out.skills
      .map((s) => {
        if (typeof s === "string") return { name: s, reason: "根据目标推导的学习技能" };
        if (typeof s === "object" && s !== null && typeof (s as Record<string, unknown>).name === "string") {
          const name = (s as Record<string, unknown>).name as string;
          const reason = (s as Record<string, unknown>).reason;
          return { name, reason: typeof reason === "string" && reason ? reason : "根据目标推导的学习技能" };
        }
        return null;
      })
      .filter((s): s is { name: string; reason: string } => s !== null);
  }

  // weeks：字符串 → 单周元素；数组项非对象 → 以字符串为 skills 补 week
  if (typeof out.weeks === "string") {
    out.weeks = [{ week: 1, skills: [out.weeks] }];
  } else if (Array.isArray(out.weeks)) {
    out.weeks = out.weeks
      .map((w, i) => {
        if (typeof w === "string") return { week: i + 1, skills: [w] };
        if (typeof w === "object" && w !== null) {
          const o = w as Record<string, unknown>;
          const week = typeof o.week === "number" && o.week >= 1 ? o.week : i + 1;
          const skills = Array.isArray(o.skills)
            ? o.skills.filter((s): s is string => typeof s === "string")
            : typeof o.skills === "string"
              ? o.skills.split(/[、,，;；]/).filter(Boolean)
              : [];
          if (skills.length === 0) return null;
          return { week, skills };
        }
        return null;
      })
      .filter((w): w is { week: number; skills: string[] } => w !== null);
  }

  return out;
}
