/**
 * 知径 Pathfinder — 课程服务（M3，纯读）
 *
 * 数据只来自 PostgreSQL pathfinder（curricula / knowledge_nodes / node_resources /
 * resources）。lib/demo/* 仅作契约参考，不作为 runtime 数据源。
 * 前置依赖关系以 knowledge_nodes.prerequisites（jsonb）为准；
 * knowledge_edges 表 M1 留空（0 行），不读取它。
 */
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { curricula, knowledgeNodes, nodeResources, resources } from "@/lib/db/schema";
import { serializeResource } from "@/lib/api/serialize";
import type {
  AccessibilityStatus,
  Grade,
  KnowledgeNode,
  NodeStatus,
  ResourceEvidence,
} from "@/lib/types";

export interface CurriculumNode {
  row: typeof knowledgeNodes.$inferSelect;
  resources: ResourceEvidence[];
  depth: number; // 前置依赖深度（0 = 无前置）
}

export interface TreeNodeSummary {
  id: string;
  title: string;
  chapter: string;
  sequence: number;
  sortOrder: number; // = sequence（课程内稳定顺序）
  depth: number;
  status: NodeStatus;
  prerequisiteIds: string[];
  estimatedMinutes: number;
  evidenceCoverage: KnowledgeNode["evidenceCoverage"];
  resources: {
    id: string;
    title: string;
    grade: Grade;
    url: string;
    accessibilityStatus: AccessibilityStatus;
  }[];
}

export async function getPublishedCurriculum() {
  return db.select().from(curricula).where(eq(curricula.status, "published"));
}

/** 按课程取全部节点（含资源、依赖深度），按 sequence 排序 */
export async function getCurriculumNodes(curriculumId: string): Promise<CurriculumNode[]> {
  const nodeRows = await db
    .select()
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.curriculumId, curriculumId))
    .orderBy(asc(knowledgeNodes.sequence));
  const resByNode = await loadResourcesByNodeIds(nodeRows.map((n) => n.id));
  const depths = computeDepths(
    nodeRows.map((n) => ({ id: n.id, prereqs: (n.prerequisites ?? []) as string[] })),
  );
  return nodeRows.map((n) => ({
    row: n,
    resources: resByNode.get(n.id) ?? [],
    depth: depths.get(n.id) ?? 0,
  }));
}

/** 节点详情（含资源）；不存在 → null */
export async function getNodeWithResources(nodeId: string) {
  const node = (
    await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, nodeId)).limit(1)
  )[0];
  if (!node) return null;
  return { node, resources: await getResourcesForNode(nodeId) };
}

/** 单节点资源列表（node_resources 按 sort_order 排序） */
export async function getResourcesForNode(nodeId: string): Promise<ResourceEvidence[]> {
  const nrRows = await db
    .select()
    .from(nodeResources)
    .where(eq(nodeResources.nodeId, nodeId))
    .orderBy(asc(nodeResources.sortOrder));
  const resIds = nrRows.map((r) => r.resourceId);
  if (!resIds.length) return [];
  const resRows = await db.select().from(resources).where(inArray(resources.id, resIds));
  const resMap = new Map(resRows.map((r) => [r.id, r]));
  const out: ResourceEvidence[] = [];
  for (const nr of nrRows) {
    const r = resMap.get(nr.resourceId);
    if (r) out.push(serializeResource(r));
  }
  return out;
}

/** 课程树（GET /api/v1/curriculum/tree） */
export async function getCurriculumTree() {
  const cur = (await getPublishedCurriculum())[0];
  if (!cur) return null;
  const nodes = await getCurriculumNodes(cur.id);

  const chapters = new Map<string, TreeNodeSummary[]>();
  for (const { row, resources: res, depth } of nodes) {
    const summary: TreeNodeSummary = {
      id: row.id,
      title: row.title,
      chapter: row.chapter,
      sequence: row.sequence,
      sortOrder: row.sequence,
      depth,
      status: row.status as NodeStatus,
      prerequisiteIds: (row.prerequisites ?? []) as string[],
      estimatedMinutes: row.estimatedMinutes,
      evidenceCoverage: (row.evidenceCoverage ?? {}) as KnowledgeNode["evidenceCoverage"],
      resources: res.map((r) => ({
        id: r.id,
        title: r.title,
        grade: r.grade,
        url: r.url,
        accessibilityStatus: r.accessibilityStatus,
      })),
    };
    const arr = chapters.get(row.chapter) ?? [];
    arr.push(summary);
    chapters.set(row.chapter, arr);
  }

  return {
    curriculum: {
      id: cur.id,
      title: cur.title,
      description: cur.description ?? "",
      version: cur.version,
      status: cur.status,
      totalNodes: nodes.length,
    },
    chapters: [...chapters.entries()].map(([title, n]) => ({ title, nodes: n })),
  };
}

/** 批量加载 nodeId → 资源列表（按 sort_order 排序；供课程/路径组装共用） */
export async function loadResourcesByNodeIds(
  nodeIds: string[],
): Promise<Map<string, ResourceEvidence[]>> {
  const map = new Map<string, ResourceEvidence[]>();
  if (!nodeIds.length) return map;
  const nrRows = await db
    .select()
    .from(nodeResources)
    .where(inArray(nodeResources.nodeId, nodeIds))
    .orderBy(nodeResources.nodeId, asc(nodeResources.sortOrder));
  const resIds = [...new Set(nrRows.map((r) => r.resourceId))];
  const resRows = resIds.length
    ? await db.select().from(resources).where(inArray(resources.id, resIds))
    : [];
  const resMap = new Map(resRows.map((r) => [r.id, r]));
  for (const nr of nrRows) {
    const r = resMap.get(nr.resourceId);
    if (!r) continue;
    const arr = map.get(nr.nodeId) ?? [];
    arr.push(serializeResource(r));
    map.set(nr.nodeId, arr);
  }
  return map;
}

/** 前置依赖图深度：无前置为 0，否则 1 + max(前置深度) */
export function computeDepths(nodes: { id: string; prereqs: string[] }[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const n = byId.get(id);
    if (!n) return 0;
    const d = n.prereqs.length ? Math.max(...n.prereqs.map(visit)) + 1 : 0;
    memo.set(id, d);
    return d;
  };
  for (const n of nodes) visit(n.id);
  return memo;
}
