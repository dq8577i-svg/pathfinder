/**
 * 知径 Pathfinder — 情境练习场（P1/P2）
 *
 * scenarios 表（user_id + path_id 绑定，绝不读 demo）。
 * 生成：对指定/首个无场景节点调 AiProvider.generateScenario（AI 或模板兜底）。
 * 对话：POST reply 用现有 provider.chat 做单轮 AI 角色扮演（不持久化会话）。
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scenarios } from "@/lib/db/schema";
import { getAiProvider } from "@/lib/ai";
import { assertPathOwned, getPathNodes, newId, PathNotFoundError } from "@/lib/modules/shared";
import type { GenerateScenarioOutput } from "@/lib/ai/types";

export interface ScenarioDto {
  id: string;
  pathId: string;
  nodeId: string | null;
  nodeTitle: string;
  title: string;
  situation: string;
  task: string;
  aiRole: string;
  rubric: string;
  sourceType: "ai" | "template";
  createdAt: string;
}

export async function listScenarios(userId: string, pathId: string): Promise<ScenarioDto[]> {
  await assertPathOwned(userId, pathId);
  const nodes = await getPathNodes(pathId);
  const titleMap = new Map(nodes.map((n) => [n.id, n.title]));
  const rows = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.userId, userId), eq(scenarios.pathId, pathId)))
    .orderBy(asc(scenarios.createdAt));
  return rows.map((r) => toDto(r, titleMap.get(r.nodeId ?? "") ?? ""));
}

/** 为一个节点生成练习场景：指定 nodeId 或首个无场景节点（防重复） */
export async function generateScenarioForPath(
  userId: string,
  pathId: string,
  nodeId?: string,
): Promise<ScenarioDto> {
  await assertPathOwned(userId, pathId);
  const nodes = await getPathNodes(pathId);
  if (nodes.length === 0) throw new PathNotFoundError();

  const existing = await db
    .select({ nodeId: scenarios.nodeId })
    .from(scenarios)
    .where(and(eq(scenarios.userId, userId), eq(scenarios.pathId, pathId)));
  const existingNodes = new Set(existing.map((e) => e.nodeId));

  let node = nodeId ? nodes.find((n) => n.id === nodeId) : undefined;
  if (!node) node = nodes.find((n) => !existingNodes.has(n.id)) ?? nodes[0];

  const provider = getAiProvider();
  let out: GenerateScenarioOutput;
  let sourceType: ScenarioDto["sourceType"];
  try {
    out = await provider.generateScenario({
      node: { title: node.title, capabilityGoal: node.capabilityGoal },
    });
    sourceType = provider.kind === "deepseek" ? "ai" : "template";
  } catch (e) {
    // AI 输出异常（网络 / JSON / schema）时按计划兜底为确定性模板，sourceType 如实标记
    console.error("[P2] labs/generate 回退模板", e);
    out = templateScenarioForNode(node.title, node.capabilityGoal);
    sourceType = "template";
  }

  const id = newId("sc");
  const now = new Date();
  await db.insert(scenarios).values({
    id,
    userId,
    pathId,
    nodeId: node.id,
    title: out.title,
    situation: out.situation,
    task: out.task,
    aiRole: out.aiRole,
    rubric: out.rubric,
    sourceType,
  });

  return {
    id,
    pathId,
    nodeId: node.id,
    nodeTitle: node.title,
    title: out.title,
    situation: out.situation,
    task: out.task,
    aiRole: out.aiRole,
    rubric: out.rubric,
    sourceType: sourceType as ScenarioDto["sourceType"],
    createdAt: now.toISOString(),
  };
}

export async function getScenario(userId: string, scenarioId: string): Promise<ScenarioDto> {
  const rows = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new PathNotFoundError();
  const nodes = await getPathNodes(rows[0].pathId);
  const titleMap = new Map(nodes.map((n) => [n.id, n.title]));
  return toDto(rows[0], titleMap.get(rows[0].nodeId ?? "") ?? "");
}

/** 单轮 AI 角色扮演回复（不持久化） */
export async function replyInScenario(
  userId: string,
  scenarioId: string,
  message: string,
): Promise<{ reply: string; isDemo: boolean }> {
  const scenario = await getScenario(userId, scenarioId);
  const provider = getAiProvider();
  const result = await provider.chat({
    system:
      `你正在扮演「${scenario.aiRole}」。场景：${scenario.situation}\n` +
      `用户的任务：${scenario.task}\n\n` +
      `请以该角色身份回应用户（中文，一次只回应一件事，可追问、可质疑、可给反馈，但不要替用户完成任务）。`,
    messages: [{ role: "user", content: message }],
    maxTokens: 400,
    temperature: 0.7,
    mode: "chat",
  });
  return { reply: result.content, isDemo: result.isDemo };
}

/** 确定性模板兜底：AI 输出异常或 schema 校验失败时使用（sourceType 如实标记 template） */
function templateScenarioForNode(title: string, capabilityGoal?: string | null): GenerateScenarioOutput {
  const g = capabilityGoal || `应用「${title}」解决实际问题`;
  return {
    title: `${title}实战练习`,
    situation: `你在工作中接到一个与「${title}」相关的真实任务。对方对你并不熟悉，需要你一边沟通一边完成。`,
    task: `结合「${title}」：先澄清任务背景与约束，再说明你打算如何达成「${g}」。`,
    aiRole: "AI 扮演一位需要你协助的业务协作方，会追问你的做法与依据。",
    rubric: `1) 是否围绕「${title}」组织思路；2) 是否交代了方法与依据；3) 能否把目标「${g}」落实为可执行步骤。`,
  };
}

function toDto(r: typeof scenarios.$inferSelect, nodeTitle: string): ScenarioDto {
  return {
    id: r.id,
    pathId: r.pathId,
    nodeId: r.nodeId,
    nodeTitle,
    title: r.title,
    situation: r.situation,
    task: r.task,
    aiRole: r.aiRole,
    rubric: r.rubric,
    sourceType: (r.sourceType as ScenarioDto["sourceType"]) ?? "template",
    createdAt: r.createdAt.toISOString(),
  };
}
