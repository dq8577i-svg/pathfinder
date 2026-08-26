/**
 * 知径 Pathfinder — 数据源开关（M7）
 *
 * NEXT_PUBLIC_DATA_SOURCE=api → 全站走真实后端（认证 / 路径 / 练习 / 笔记 / 进度）。
 * 默认 demo → 维持现有 lib/demo 演示数据（页面结构与组件完全不变）。
 * 说明：客户端读取，故用 NEXT_PUBLIC_ 前缀，构建期内联。
 */
export const DATA_SOURCE: "api" | "demo" =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "demo";

export const isApiMode = DATA_SOURCE === "api";

/** 页面上用于标识当前数据源的小徽标文案（demo 数据仍诚实标注） */
export const DATA_SOURCE_LABEL = DATA_SOURCE === "api" ? "真实数据" : "演示数据";
