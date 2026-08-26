/**
 * 知径 Pathfinder — 练习系统输入 Schema（M4）
 *
 * 全部服务端校验：nodeId 必须是已发布课程中的节点（service 层再验证存在性）；
 * content 对齐前端 2000 字上限；clientId 为可选幂等键（重复提交不产生重复消息）。
 */
import { z } from "zod";

export const PRACTICE_TOTAL_ROUNDS = 5;

export const createSessionSchema = z.object({
  nodeId: z.string().min(1, "nodeId 不能为空"),
  pathId: z.string().optional(),
});

export const addMessageSchema = z.object({
  content: z
    .string()
    .min(1, "内容不能为空")
    .max(2000, "讲解内容超过 2000 字，请精简后发送"),
  /** 客户端幂等键：同一 (sessionId, clientId) 只产生一条 user 消息 + 一条 AI 追问 */
  clientId: z.string().min(1).max(128).optional(),
});

export const patchSessionSchema = z.object({
  draft: z.string().max(5000).optional(),
  draftSavedAt: z.string().datetime().optional(),
  syncState: z.enum(["saved", "local_only", "unsynced"]).optional(),
  status: z.enum(["abandoned"]).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type AddMessageInput = z.infer<typeof addMessageSchema>;
export type PatchSessionInput = z.infer<typeof patchSessionSchema>;
