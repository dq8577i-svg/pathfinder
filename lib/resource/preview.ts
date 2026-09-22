/**
 * 路径确认前的证据发现：查询规划 Agent → Tavily → 去重/分级 → 预览节点。
 * 这里只返回公开链接元数据，不写数据库、不抓取受版权保护的正文。
 */
import { getSearchProvider, searchProviderLabel } from "@/lib/search";
import type { Grade, KnowledgeNode, PathRationale, ResourceEvidence } from "@/lib/types";
import type { SearchResult } from "@/lib/search/types";
import { planResourceQueries } from "./query-planner";
import type { SearchQueryContext } from "./queries";

const MAX_PREVIEW_NODES = 6;
const MAX_RESULTS_PER_NODE = 5;
const MAX_RESOURCES_PER_NODE = 3;

export interface PreviewEvidenceResult {
  nodes: KnowledgeNode[];
  rationalePatch: Pick<
    PathRationale,
    | "searchProviderLabel"
    | "evidenceCoverageSummary"
    | "evidenceConfidence"
    | "searchedNodeCount"
    | "nodesWithResources"
    | "totalResourceCount"
    | "searchQueries"
  >;
}

export async function discoverPreviewEvidence(
  context: SearchQueryContext,
  nodes: KnowledgeNode[],
): Promise<PreviewEvidenceResult> {
  const provider = getSearchProvider();
  const selected = nodes.slice(0, MAX_PREVIEW_NODES);
  const queryPlan = await planResourceQueries(context, selected);
  const allQueries = queryPlan.flatMap((item) => item.queries.slice(0, 2));

  if (!provider.isReal) {
    return {
      nodes,
      rationalePatch: {
        searchProviderLabel: searchProviderLabel(),
        evidenceCoverageSummary: "搜索服务未配置，当前路径仅为 AI 草案，尚无可核验的公开资料。",
        evidenceConfidence: "low",
        searchedNodeCount: 0,
        nodesWithResources: nodes.filter((node) => node.resources.length > 0).length,
        totalResourceCount: nodes.reduce((sum, node) => sum + node.resources.length, 0),
        searchQueries: allQueries,
      },
    };
  }

  const evidenceByNode = new Map<string, ResourceEvidence[]>();
  await Promise.all(
    queryPlan.map(async (item) => {
      const candidates: SearchResult[] = [];
      const results = await Promise.allSettled(
        item.queries.slice(0, 2).map((query) =>
          provider.search(query, { maxResults: MAX_RESULTS_PER_NODE }),
        ),
      );
      for (const result of results) {
        if (result.status === "fulfilled") candidates.push(...result.value);
      }
      evidenceByNode.set(item.nodeId, selectPreviewResources(candidates, item.nodeId));
    }),
  );

  const enrichedNodes = nodes.map((node) => {
    const discovered = evidenceByNode.get(node.id);
    if (!discovered || discovered.length === 0) return node;
    const resources = mergeResources(node.resources, discovered);
    return { ...node, resources, evidenceCoverage: coverageOf(resources) };
  });

  const nodesWithResources = selected.filter(
    (node) => (evidenceByNode.get(node.id)?.length ?? node.resources.length) > 0,
  ).length;
  const totalResourceCount = enrichedNodes.reduce((sum, node) => sum + node.resources.length, 0);
  const covered = selected.filter((node) => {
    const resources = evidenceByNode.get(node.id) ?? node.resources;
    return resources.some((resource) => resource.grade === "A" || resource.grade === "B");
  }).length;
  const ratio = selected.length ? covered / selected.length : 0;
  const evidenceConfidence: PathRationale["evidenceConfidence"] =
    ratio >= 0.8 ? "high" : ratio >= 0.5 ? "medium" : "low";

  return {
    nodes: enrichedNodes,
    rationalePatch: {
      searchProviderLabel: searchProviderLabel(),
      evidenceCoverageSummary:
        `已实时检索 ${selected.length} 个核心节点，${covered} 个节点具有 A/B 级候选来源；` +
        `共展示 ${totalResourceCount} 条候选资料，确认路径后将再次检索、去重并持久化。`,
      evidenceConfidence,
      searchedNodeCount: selected.length,
      nodesWithResources,
      totalResourceCount,
      searchQueries: allQueries,
    },
  };
}

function selectPreviewResources(candidates: SearchResult[], nodeId: string): ResourceEvidence[] {
  const tierWeight: Record<Grade, number> = { A: 0, B: 1, C: 2 };
  const seen = new Set<string>();
  return [...candidates]
    .sort((a, b) => tierWeight[a.sourceTier] - tierWeight[b.sourceTier] || (b.score ?? 0) - (a.score ?? 0))
    .filter((item) => {
      const key = normalizeUrl(item.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RESOURCES_PER_NODE)
    .map((item, index) => ({
      id: `preview-${nodeId}-${index}`,
      title: item.title,
      domain: item.domain,
      grade: item.sourceTier,
      sourceType: item.sourceType,
      sourceName: item.domain,
      checkedAt: "",
      retrievedAt: item.retrievedAt,
      reason: `${item.reason} · 路径确认前候选，待可访问性核验`,
      url: item.url,
      accessibilityStatus: "pending",
      licenseNote: "公开检索候选；仅展示链接与必要元数据，不复制正文。",
    }));
}

function mergeResources(existing: ResourceEvidence[], discovered: ResourceEvidence[]): ResourceEvidence[] {
  const seen = new Set<string>();
  return [...existing, ...discovered].filter((resource) => {
    const key = normalizeUrl(resource.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coverageOf(resources: ResourceEvidence[]): KnowledgeNode["evidenceCoverage"] {
  const aCount = resources.filter((resource) => resource.grade === "A").length;
  const bCount = resources.filter((resource) => resource.grade === "B").length;
  const cCount = resources.filter((resource) => resource.grade === "C").length;
  return { hasAB: aCount + bCount > 0, aCount, bCount, cCount, insufficient: aCount + bCount === 0 };
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return value;
  }
}
