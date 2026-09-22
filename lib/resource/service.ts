/**
 * 知径 Pathfinder — 每节点资源生成（P1/P2 资源检索层）
 *
 * 把「学习路径的每个知识节点」关联到真实互联网资料：
 *   节点标题 → 搜索 Query → SearchProvider（Tavily）→ 规范化/去重/分级(A/B/C)
 *   → 写 resources + node_resources → 更新 knowledge_nodes.evidence_coverage。
 *
 * 归属：refresh 以会话 userId 校验路径归属，绝不接受客户端传入 user_id。
 * 幂等：已有资源的节点跳过，重复 refresh 不重复扣搜索配额。
 * 权威性：分级只做「公开来源的初步判断」，accessibility 恒为 pending；
 *   无来源的节点保持「待补充」（PRD §4.2，不伪造权威性）。
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  knowledgeNodes,
  learningPathNodes,
  learningPaths,
  nodeResources,
  resources,
} from "@/lib/db/schema";
import { getSearchProvider } from "@/lib/search";
import type { SearchResult } from "@/lib/search/types";
import { planResourceQueries } from "./query-planner";
import type { Grade, KnowledgeNode, ResourceType } from "@/lib/types";
import type { PathRationale } from "@/lib/types";

const MAX_NODES = 12;
const MAX_RESULTS_PER_QUERY = 8;
const MAX_RESOURCES_PER_NODE = 8;
const MAX_SAME_TYPE_PER_NODE = 3;

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

export async function refreshPathResources(
  userId: string,
  pathId: string,
): Promise<RefreshResourceResult> {
  const path = (
    await db
      .select({ id: learningPaths.id, title: learningPaths.title, rationale: learningPaths.rationale })
      .from(learningPaths)
      .where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, userId)))
      .limit(1)
  )[0];
  if (!path) throw new Error("PATH_NOT_FOUND");

  const rows = await db
    .select({ node: knowledgeNodes })
    .from(learningPathNodes)
    .innerJoin(knowledgeNodes, eq(learningPathNodes.nodeId, knowledgeNodes.id))
    .where(eq(learningPathNodes.pathId, pathId))
    .orderBy(asc(learningPathNodes.sortOrder));

  const provider = getSearchProvider();
  const result: RefreshResourceResult = {
    pathId,
    provider: provider.name,
    nodesProcessed: 0,
    nodesWithResources: 0,
    resourcesCreated: 0,
    resourcesLinked: 0,
    skipped: [],
    failures: [],
  };

  const nodes = rows.map((r) => r.node).slice(0, MAX_NODES);
  const currentRationale = (path.rationale ?? {}) as PathRationale;
  const queryPlan = await planResourceQueries(
    {
      topic: currentRationale.topic || path.title,
      goal: currentRationale.goal,
      currentLevel: currentRationale.currentLevel,
    },
    nodes.map((node) => ({ id: node.id, title: node.title })),
  );
  const queriesByNode = new Map(queryPlan.map((item) => [item.nodeId, item.queries]));

  // 全库现有非 demo 资源：URL → resourceId，跨节点去重复用（不重复建行）
  const allRes = await db.select().from(resources);
  const urlToId = new Map<string, string>();
  for (const r of allRes) if (!r.isDemo) urlToId.set(normUrl(r.url), r.id);

  for (const node of nodes) {
    const existingLinks = await db
      .select({ id: nodeResources.resourceId })
      .from(nodeResources)
      .where(eq(nodeResources.nodeId, node.id));
    if (existingLinks.length > 0) {
      result.skipped.push(node.id);
      continue;
    }

    result.nodesProcessed++;
    try {
      const candidates: SearchResult[] = [];
      for (const q of (queriesByNode.get(node.id) ?? []).slice(0, 2)) {
        candidates.push(...(await provider.search(q, { maxResults: MAX_RESULTS_PER_QUERY })));
      }

      const picked = pickResources(candidates);
      if (picked.length === 0) {
        result.failures.push({ nodeId: node.id, error: "NO_RESULTS" });
        continue;
      }

      // 落库：新建 resources（按 URL 去重复用已有行）+ node_resources 链接
      const links: { resourceId: string; sortOrder: number }[] = [];
      let sort = 0;
      for (const hit of picked) {
        const existingId = urlToId.get(normUrl(hit.url));
        let resourceId: string;
        if (existingId) {
          resourceId = existingId;
        } else {
          resourceId = `res-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
          await db.insert(resources).values({
            id: resourceId,
            title: hit.title,
            domain: hit.domain,
            grade: hit.sourceTier,
            sourceType: hit.sourceType,
            sourceName: hit.domain,
            retrievedAt: new Date(hit.retrievedAt),
            reason: hit.reason,
            url: hit.url,
            accessibilityStatus: "pending",
            licenseNote: "来自 Tavily 公开检索；仅保存链接与元数据，不复制正文。",
            isDemo: false,
          });
          urlToId.set(normUrl(hit.url), resourceId);
          result.resourcesCreated++;
        }
        links.push({ resourceId, sortOrder: sort++ });
      }

      await db.insert(nodeResources).values(
        links.map((l) => ({ nodeId: node.id, resourceId: l.resourceId, sortOrder: l.sortOrder })),
      );
      result.resourcesLinked += links.length;

      // 更新 evidence_coverage：从落库资源聚合（而非信任候选分级）
      const linkedResIds = links.map((l) => l.resourceId);
      const linkedRes = await db
        .select({ grade: resources.grade })
        .from(resources)
        .where(inArray(resources.id, linkedResIds));
      const coverage = coverageOf(linkedRes.map((r) => r.grade as Grade));
      await db
        .update(knowledgeNodes)
        .set({ evidenceCoverage: coverage })
        .where(eq(knowledgeNodes.id, node.id));

      result.nodesWithResources++;
    } catch (e) {
      result.failures.push({ nodeId: node.id, error: e instanceof Error ? e.message : "ERROR" });
    }
  }

  await updatePathEvidenceSummary(path.id, currentRationale, nodes.map((node) => node.id), queryPlan);

  return result;
}

/* ---------------- 内部辅助 ---------------- */

/** 从候选中挑选 ≤8 条：A<B<C 优先、同分按相关度，控制同类型 ≤3，标题近似去重 */
function pickResources(candidates: SearchResult[]): SearchResult[] {
  const tierWeight: Record<Grade, number> = { A: 0, B: 1, C: 2 };
  const sorted = [...candidates].sort(
    (x, y) =>
      tierWeight[x.sourceTier] - tierWeight[y.sourceTier] || (y.score ?? 0) - (x.score ?? 0),
  );

  const picked: SearchResult[] = [];
  const seenTitles = new Set<string>();
  const seenKeys = new Set<string>();
  const typeCount = new Map<ResourceType, number>();
  for (const c of sorted) {
    if (picked.length >= MAX_RESOURCES_PER_NODE) break;
    const t = normTitle(c.title);
    if (seenTitles.has(t)) continue;
    seenTitles.add(t);
    const k = c.dedupeKey || normUrl(c.url);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    if ((typeCount.get(c.sourceType) ?? 0) >= MAX_SAME_TYPE_PER_NODE) continue;
    typeCount.set(c.sourceType, (typeCount.get(c.sourceType) ?? 0) + 1);
    picked.push(c);
  }
  return picked;
}

/** evidence_coverage：A/B 至少一条才算不 insufficient */
function coverageOf(grades: Grade[]): KnowledgeNode["evidenceCoverage"] {
  let aCount = 0;
  let bCount = 0;
  let cCount = 0;
  for (const g of grades) {
    if (g === "A") aCount++;
    else if (g === "B") bCount++;
    else cCount++;
  }
  const hasAB = aCount + bCount > 0;
  return { hasAB, aCount, bCount, cCount, insufficient: !hasAB };
}

function normUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s，。、·\-_（）()【】[]{}:：;；'"“”]/g, "")
    .slice(0, 80);
}

async function updatePathEvidenceSummary(
  pathId: string,
  rationale: PathRationale,
  nodeIds: string[],
  queryPlan: Awaited<ReturnType<typeof planResourceQueries>>,
): Promise<void> {
  if (nodeIds.length === 0) return;
  const linked = await db
    .select({ nodeId: nodeResources.nodeId, grade: resources.grade })
    .from(nodeResources)
    .innerJoin(resources, eq(nodeResources.resourceId, resources.id))
    .where(inArray(nodeResources.nodeId, nodeIds));
  const resourceNodes = new Set(linked.map((item) => item.nodeId));
  const coveredNodes = new Set(
    linked
      .filter((item) => item.grade === "A" || item.grade === "B")
      .map((item) => item.nodeId),
  );
  const ratio = coveredNodes.size / nodeIds.length;
  const evidenceConfidence: PathRationale["evidenceConfidence"] =
    ratio >= 0.8 ? "high" : ratio >= 0.5 ? "medium" : "low";
  const nextRationale: PathRationale = {
    ...rationale,
    searchProviderLabel: getSearchProvider().isReal ? "Tavily 实时检索" : "搜索未配置（Mock 占位）",
    evidenceConfidence,
    searchedNodeCount: nodeIds.length,
    nodesWithResources: resourceNodes.size,
    totalResourceCount: linked.length,
    searchQueries: queryPlan.flatMap((item) => item.queries.slice(0, 2)),
    evidenceCoverageSummary:
      `已检索 ${nodeIds.length} 个节点，${coveredNodes.size} 个节点具有 A/B 级来源，` +
      `共关联 ${linked.length} 条公开资料。`,
  };
  await db
    .update(learningPaths)
    .set({ rationale: nextRationale, lastActivityAt: new Date() })
    .where(eq(learningPaths.id, pathId));
}
