/** 资源检索层 API 客户端（P1/P2） */
import { api } from "./client";

export interface RefreshResourceResult {
  pathId: string;
  provider: string;
  nodesProcessed: number;
  nodesWithResources: number;
  resourcesCreated: number;
  resourcesLinked: number;
  skipped: string[];
  failures: { nodeId: string; error: string }[];
}

/** 对当前用户某条路径的节点补充真实学习资料（幂等：已有资源的节点跳过） */
export function refreshPathResources(pathId: string): Promise<RefreshResourceResult> {
  return api(`/paths/${pathId}/resources/refresh`, { method: "POST" });
}
