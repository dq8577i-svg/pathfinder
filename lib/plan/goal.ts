/**
 * 知径 Pathfinder — 学习目标数据契约（通用学习规划阶段）
 *
 * topic/goal 必须是用户输入，绝不默认「产品」。preview / confirm 共用同一份校验。
 * 支持只填一句「我想学 Python 做数据分析」也能生成：topic 即该句，goal 留空由 AI 理解。
 * 周期用周数表达（1 个月≈4 周 / 3 个月≈12 周 / 半年≈26 周），前端展示时换算。
 */
import { z } from "zod";

/** 推荐示例主题：仅作为「你可以学任何东西」的引导，点击哪个才把哪个作为 topic，不默认选中。 */
export const EXAMPLE_TOPICS = [
  { label: "Python 数据分析", desc: "从零到独立完成数据分析项目" },
  { label: "摄影", desc: "三个月后能独立拍出人像" },
  { label: "日语", desc: "半年后能看懂日常动漫" },
  { label: "产品经理", desc: "系统入门产品方法论" },
  { label: "React", desc: "能独立开发前端应用" },
  { label: "财务基础", desc: "读懂三张报表并做基本分析" },
] as const;

export const learningGoalSchema = z.object({
  /** 学习主题（必填，用户输入） */
  topic: z.string().trim().min(1, "请先告诉我想学什么").max(120),
  /** 学习目标（推荐填写；留空时由 AI 从 topic 理解） */
  goal: z.string().trim().max(400).optional().default(""),
  /** 当前水平（默认零基础，可自由填写） */
  currentLevel: z.string().trim().min(1).max(60).default("零基础"),
  /** 每周可用小时数（1–80） */
  weeklyHours: z.number().int().min(1).max(80).default(5),
  /** 目标周期（周数，1–208；半年=26） */
  deadlineWeeks: z.number().int().min(1).max(208).default(12),
  /** 偏好（项目实战 / 少理论 / 口语优先 …），可选 */
  preferences: z.array(z.string().trim().min(1).max(40)).max(6).optional().default([]),
});

export type LearningGoalInput = z.infer<typeof learningGoalSchema>;

/** 目标画像（goalProfile 摘要，用于 rationale / 用户画像） */
export function goalProfileOf(goal: LearningGoalInput): string {
  const parts = [
    goal.topic,
    goal.goal ? `目标：${goal.goal}` : "",
    goal.currentLevel,
    `每周 ${goal.weeklyHours} 小时`,
    `${goal.deadlineWeeks} 周`,
  ];
  return parts.filter(Boolean).join(" · ");
}
