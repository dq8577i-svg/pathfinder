/**
 * 知径 Pathfinder — AI 结构化输出 Schema（M5）
 *
 * 所有真实 AI 返回都必须通过这里的 Zod 校验：解析失败 / 字段类型不符 /
 * 越界值一律视为「不可用」，由调用方降级到 Mock。绝不信任模型输出。
 */
import { z } from "zod";

/** 任意主题学习路径编排输出（generateLearningPlan） */
export const learningPlanSchema = z.object({
  title: z.string().min(1),
  rationale: z.string().min(1),
  skills: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        reason: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(40),
  weeks: z
    .array(
      z.object({
        week: z.number().int().min(1).max(60),
        skills: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1)
    .max(60),
});
export type LearningPlanOutput = z.infer<typeof learningPlanSchema>;

/** 费曼追问输出（continuePractice）——普通文本，但也要非空 */
export const continuePracticeSchema = z.object({
  content: z.string().min(1),
});
export type ContinuePracticeOutput = z.infer<typeof continuePracticeSchema>;

/** 练习评价输出（evaluatePractice） */
export const evaluationDimensionSchema = z.object({
  label: z.string().min(1),
  level: z.number().int().min(1).max(5),
  note: z.string(),
});
export type EvaluationDimension = z.infer<typeof evaluationDimensionSchema>;

export const evaluatePracticeSchema = z.object({
  clear: z.array(z.string()),
  toAdd: z.array(z.string()),
  notCovered: z.array(z.string()),
  dimensions: z.object({
    completeness: evaluationDimensionSchema,
    accuracy: evaluationDimensionSchema,
    clarity: evaluationDimensionSchema,
  }),
  nextStep: z.array(
    z.object({
      label: z.string().min(1),
      type: z.enum(["node", "practice", "review"]),
      nodeId: z.string().optional(),
    }),
  ),
});
export type EvaluatePracticeOutput = z.infer<typeof evaluatePracticeSchema>;

/** 复习卡片生成输出（generateReviewCards） */
export const reviewCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        question: z.string().min(1).max(400),
        answer: z.string().min(1).max(800),
      }),
    )
    .min(1)
    .max(20),
});
export type ReviewCardsOutput = z.infer<typeof reviewCardsSchema>;

/** 情境练习场景生成输出（generateScenario） */
/** rubric 兼容 LLM 两种输出习惯：字符串，或 2–4 条数组（归一为“；”连接的中文单串） */
const scenarioRubric = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v.filter(Boolean).join("；") : v))
  .pipe(z.string().min(1).max(1200));

export const scenarioSchema = z.object({
  title: z.string().min(1).max(120),
  situation: z.string().min(1).max(1200),
  task: z.string().min(1).max(1200),
  aiRole: z.string().min(1).max(120),
  rubric: scenarioRubric,
});
export type ScenarioOutput = z.infer<typeof scenarioSchema>;
