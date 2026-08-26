/**
 * 知径 Pathfinder — 语义搜索（P1/P2）
 *
 * 仅检索当前用户有权访问的数据（owner 过滤），ILIKE 匹配：
 *   learning_paths / 用户路径下 knowledge_nodes / feynman_notes /
 *   路径节点关联的 resources / review_cards。
 * 不做跨用户或全局索引；结果明确标注「来自哪里、为何有权访问」。
 */
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  feynmanNotes,
  knowledgeNodes,
  learningPathNodes,
  learningPaths,
  nodeResources,
  resources,
  reviewCards,
} from "@/lib/db/schema";

export interface SearchHitDto {
  id: string;
  type: "path" | "node" | "note" | "resource" | "review_card";
  title: string;
  snippet: string;
  source: string;
  accessReason: string;
  pathId: string | null;
  nodeId: string | null;
  url: string | null;
}

/** 转义 LIKE 特殊字符，避免用户输入被当作通配符 */
function like(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function searchUserData(userId: string, query: string): Promise<SearchHitDto[]> {
  const q = query.trim();
  if (q.length === 0) return [];

  // 1) 用户路径（标题）
  const paths = await db
    .select({ id: learningPaths.id, title: learningPaths.title })
    .from(learningPaths)
    .where(and(eq(learningPaths.userId, userId), ilike(learningPaths.title, like(q))))
    .limit(10);
  const userPathIds = paths.map((p) => p.id);

  // 用户全部路径 id（用于范围过滤）
  const allPaths = await db
    .select({ id: learningPaths.id })
    .from(learningPaths)
    .where(eq(learningPaths.userId, userId));
  const allPathIds = allPaths.map((p) => p.id);

  // 2) 用户路径下的节点（标题/能力目标/场景）
  const nodeRows = allPathIds.length
    ? await db
        .select({ nodeId: learningPathNodes.nodeId })
        .from(learningPathNodes)
        .where(inArray(learningPathNodes.pathId, allPathIds))
    : [];
  const userNodeIds = [...new Set(nodeRows.map((r) => r.nodeId))];

  const nodes = userNodeIds.length
    ? await db
        .select({
          id: knowledgeNodes.id,
          title: knowledgeNodes.title,
          capabilityGoal: knowledgeNodes.capabilityGoal,
          scenario: knowledgeNodes.scenario,
        })
        .from(knowledgeNodes)
        .where(
          and(
            inArray(knowledgeNodes.id, userNodeIds),
            or(
              ilike(knowledgeNodes.title, like(q)),
              ilike(knowledgeNodes.capabilityGoal, like(q)),
              ...(knowledgeNodes.scenario ? [ilike(knowledgeNodes.scenario, like(q))] : []),
            ),
          ),
        )
        .limit(20)
    : [];

  // 3) 费曼笔记（本人）
  const notes = await db
    .select({
      id: feynmanNotes.id,
      title: feynmanNotes.title,
      content: feynmanNotes.content,
      nodeId: feynmanNotes.nodeId,
    })
    .from(feynmanNotes)
    .where(
      and(
        eq(feynmanNotes.userId, userId),
        or(ilike(feynmanNotes.title, like(q)), ilike(feynmanNotes.content, like(q))),
      ),
    )
    .limit(20);

  // 4) 用户路径节点关联的资料（标题/域名/URL；两步查询）
  let resRows: { nodeId: string; resource: typeof resources.$inferSelect }[] = [];
  if (userNodeIds.length) {
    const nrRows2 = await db
      .select({ nodeId: nodeResources.nodeId, resourceId: nodeResources.resourceId })
      .from(nodeResources)
      .where(inArray(nodeResources.nodeId, userNodeIds));
    const resIds2 = [...new Set(nrRows2.map((r) => r.resourceId))];
    const resRows2 = resIds2.length
      ? await db
          .select()
          .from(resources)
          .where(
            and(
              inArray(resources.id, resIds2),
              or(
                ilike(resources.title, like(q)),
                ilike(resources.domain, like(q)),
                ilike(resources.url, like(q)),
              ),
            ),
          )
          .limit(20)
      : [];
    const resMap2 = new Map(resRows2.map((r) => [r.id, r]));
    for (const nr of nrRows2) {
      const resource = resMap2.get(nr.resourceId);
      if (resource) resRows.push({ nodeId: nr.nodeId, resource });
    }
  }

  // 5) 复习卡片（本人 + 当前路径）
  const cards = await db
    .select({ id: reviewCards.id, question: reviewCards.question, pathId: reviewCards.pathId })
    .from(reviewCards)
    .where(and(eq(reviewCards.userId, userId), ilike(reviewCards.question, like(q))))
    .limit(20);

  const hits: SearchHitDto[] = [];

  for (const p of paths) {
    hits.push({
      id: p.id,
      type: "path",
      title: p.title,
      snippet: "学习路径",
      source: "学习路径",
      accessReason: "你的学习路径",
      pathId: p.id,
      nodeId: null,
      url: null,
    });
  }

  for (const n of nodes) {
    hits.push({
      id: n.id,
      type: "node",
      title: n.title,
      snippet: n.capabilityGoal || n.scenario || "路径节点",
      source: "路径节点",
      accessReason: "来自你的学习路径",
      pathId: pathOfNode(n.id, userPathIds),
      nodeId: n.id,
      url: null,
    });
  }

  for (const note of notes) {
    hits.push({
      id: note.id,
      type: "note",
      title: note.title,
      snippet: note.content.slice(0, 120),
      source: "费曼笔记",
      accessReason: "你的学习笔记",
      pathId: null,
      nodeId: note.nodeId,
      url: null,
    });
  }

  for (const rr of resRows) {
    hits.push({
      id: rr.resource.id,
      type: "resource",
      title: rr.resource.title,
      snippet: `${rr.resource.domain} · ${rr.resource.reason || "公开资料"}`,
      source: "节点资料",
      accessReason: "来自你的学习路径节点",
      pathId: null,
      nodeId: rr.nodeId,
      url: rr.resource.url,
    });
  }

  for (const c of cards) {
    hits.push({
      id: c.id,
      type: "review_card",
      title: c.question.slice(0, 80),
      snippet: c.question,
      source: "复习卡片",
      accessReason: "你的复习卡片",
      pathId: c.pathId,
      nodeId: null,
      url: null,
    });
  }

  return hits.slice(0, 40);
}

/** 节点属于哪条用户路径（仅用于前端跳转；非关键） */
function pathOfNode(nodeId: string, userPathIds: string[]): string | null {
  return userPathIds.length > 0 ? userPathIds[0] : null;
}
