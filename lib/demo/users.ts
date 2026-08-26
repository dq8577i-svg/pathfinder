/**
 * 演示角色与用户资料（对应 Ubercoding 交付说明 5 个演示角色）。
 */
import type { Role, UserProfile } from "@/lib/types";

export const ROLE_LABELS: Record<Role, string> = {
  guest: "访客",
  new_learner: "新学习者·林然",
  learner: "在学学习者·陈思",
  practice_learner: "练习中学习者·周宁",
  content_admin: "内容管理员·陈岚",
  org_admin: "机构管理员·张磊",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  guest: "未登录访客，仅可访问落地页、登录与注册。",
  new_learner: "林然：无学习路径，目标为 6 周 / 每周 5 小时。用于注册、目标诊断、路径确认。",
  learner: "陈思：已完成 4/18 节点，当前节点「从表象需求到真实需求」。用于首页恢复、节点学习、费曼练习、评价与笔记。",
  practice_learner: "周宁：有一条已完成 3 轮的未结束费曼会话，本地有未发送草稿。用于中断恢复、离线、同步失败演示。",
  content_admin: "陈岚：可处理资源审核队列、失效链接、教材版本。不可查看普通用户的私人笔记正文或完整费曼对话。",
  org_admin: "张磊：只能查看所属机构的脱敏聚合数据、课程、成员和审核状态。",
};

export const USER_PROFILES: Record<Role, UserProfile> = {
  guest: {
    id: "u-guest",
    role: "guest",
    displayName: "访客",
    email: "",
    weeklyHours: 0,
    goalSummary: "",
    hasPath: false,
    isDemo: true,
  },
  new_learner: {
    id: "u-linran",
    role: "new_learner",
    displayName: "林然",
    email: "linran@example.com",
    weeklyHours: 5,
    goalSummary: "6 周内完成需求分析与基础 PRD 学习",
    hasPath: false,
    isDemo: true,
  },
  learner: {
    id: "u-chensi",
    role: "learner",
    displayName: "陈思",
    email: "chensi@example.com",
    weeklyHours: 5,
    goalSummary: "在职补强 · 6 周 · 需求分析与基础 PRD",
    hasPath: true,
    resume: {
      type: "node",
      nodeId: "need-signal",
      detail: "上次停在资源 2/3；当前节点「从表象需求到真实需求」",
    },
    isDemo: true,
  },
  practice_learner: {
    id: "u-zhouning",
    role: "practice_learner",
    displayName: "周宁",
    email: "zhouning@example.com",
    weeklyHours: 5,
    goalSummary: "在职补强 · 6 周 · 需求分析与基础 PRD",
    hasPath: true,
    resume: {
      type: "practice",
      sessionId: "session-unfin-zhou",
      detail: "未完成费曼会话第 3 轮；本地有未发送草稿",
    },
    isDemo: true,
  },
  content_admin: {
    id: "u-chenlan",
    role: "content_admin",
    displayName: "陈岚",
    email: "chenlan@example.com",
    weeklyHours: 0,
    goalSummary: "内容运营 · 资源审核与教材版本维护",
    hasPath: false,
    isDemo: true,
  },
  org_admin: {
    id: "u-zhanglei",
    role: "org_admin",
    displayName: "张磊",
    email: "zhanglei@example.com",
    weeklyHours: 0,
    goalSummary: "星桥产品学院 · 机构管理",
    hasPath: false,
    isDemo: true,
  },
};

export const ALL_ROLES: Role[] = [
  "new_learner",
  "learner",
  "practice_learner",
  "content_admin",
  "org_admin",
];
