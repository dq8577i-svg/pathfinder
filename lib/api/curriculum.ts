/**
 * 知径 Pathfinder — 课程与知识节点 API 客户端（M7）
 */
import { api, apiOrNull } from "./client";
import type { KnowledgeNode, ResourceEvidence } from "@/lib/types";

/** GET /api/v1/curriculum/tree 的形状（chapters 按课程内出现顺序） */
export interface CurriculumTree {
  curriculum: {
    id: string;
    title: string;
    description: string;
    version: string;
    status: string;
    totalNodes: number;
  };
  chapters: {
    title: string;
    nodes: TreeNodeSummary[];
  }[];
}

/** 树节点摘要（与后端 TreeNodeSummary 对齐） */
export interface TreeNodeSummary {
  id: string;
  title: string;
  chapter: string;
  sequence: number;
  sortOrder: number;
  depth: number;
  status: string;
  prerequisiteIds: string[];
  estimatedMinutes: number;
  evidenceCoverage: { sufficient?: boolean; insufficient?: boolean; note?: string };
  resources: { id: string; title: string; grade: string; url: string | null; accessibilityStatus: string }[];
}

export async function getTree(): Promise<CurriculumTree> {
  return api<CurriculumTree>("/curriculum/tree");
}

/** GET /api/v1/knowledge/nodes/:nodeId（含资源） */
export async function getNode(nodeId: string): Promise<KnowledgeNode | null> {
  const d = await apiOrNull<{ node: KnowledgeNode }>(`/knowledge/nodes/${encodeURIComponent(nodeId)}`);
  return d ? d.node : null;
}

/** GET /api/v1/knowledge/nodes/:nodeId/resources */
export async function getNodeResources(nodeId: string): Promise<ResourceEvidence[] | null> {
  const d = await apiOrNull<{ resources: ResourceEvidence[] }>(
    `/knowledge/nodes/${encodeURIComponent(nodeId)}/resources`,
  );
  return d ? d.resources : null;
}
