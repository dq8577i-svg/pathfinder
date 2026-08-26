/**
 * 知径 Pathfinder — 费曼笔记输入 Schema（M6）
 *
 * 全部服务端校验。title/content 必填（对齐前端表单）；keyTerms / pendingQuestions
 * 为字符串数组；nodeId 若提供必须落在已发布课程的节点（service 层再验证存在性，
 * 避免 FK 违规 500）。PATCH 用 optional 区分「未提供」与「显式置 null（清空 nodeId）」
 * 两种语义。
 */
import { z } from "zod";

export const NOTE_TITLE_MAX = 120;
export const NOTE_CONTENT_MAX = 20000;

export const createNoteSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(NOTE_TITLE_MAX, `标题超过 ${NOTE_TITLE_MAX} 字`),
  content: z.string().min(1, "内容不能为空").max(NOTE_CONTENT_MAX, `内容超过 ${NOTE_CONTENT_MAX} 字`),
  sessionId: z.string().min(1).max(128).optional(),
  nodeId: z.string().min(1).max(64).optional(),
  keyTerms: z.array(z.string().max(64)).max(50).optional(),
  pendingQuestions: z.array(z.string().max(200)).max(50).optional(),
  selfAssessed: z.boolean().optional(),
  statusFilter: z.enum(["all", "to_add", "self_assessed", "archived"]).optional(),
  sourceTag: z.enum(["ai_draft", "user_edit", "mixed"]).optional(),
});

export const patchNoteSchema = z.object({
  title: z.string().min(1).max(NOTE_TITLE_MAX).optional(),
  content: z.string().min(1).max(NOTE_CONTENT_MAX).optional(),
  sessionId: z.string().min(1).max(128).optional(),
  /** 可置 null 清空关联节点；空串拒绝（避免 FK 违规） */
  nodeId: z.string().min(1).max(64).nullable().optional(),
  keyTerms: z.array(z.string().max(64)).max(50).optional(),
  pendingQuestions: z.array(z.string().max(200)).max(50).optional(),
  selfAssessed: z.boolean().optional(),
  statusFilter: z.enum(["all", "to_add", "self_assessed", "archived"]).optional(),
  sourceTag: z.enum(["ai_draft", "user_edit", "mixed"]).optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type PatchNoteInput = z.infer<typeof patchNoteSchema>;
