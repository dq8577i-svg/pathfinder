/**
 * 节点 → 搜索 Query（确定性、节流 Tavily credits）。
 * 主查询 = 节点标题本身；约一半节点追加一个变体（教程 / 视频），
 * 使同一路径内资源类型多样（含视频），又不让每个节点都扣两次配额。
 */
export interface SearchQueryContext {
  topic: string;
  goal?: string;
  currentLevel?: string;
}

export function searchQueriesForNode(
  node: { title: string },
  index: number,
  context?: SearchQueryContext,
): string[] {
  const base = node.title.trim();
  if (!base) return [];
  const topic = context?.topic.trim();
  const level = context?.currentLevel?.trim();
  const prefix = [topic && topic !== base ? topic : "", base, level].filter(Boolean).join(" ");
  const intents = [
    "大学 公开课 官方 教程",
    "权威 教材 学习指南",
    "视频 实战 案例",
    "official documentation university course",
  ];
  return [
    `${prefix} ${intents[index % intents.length]}`.trim(),
    `${prefix} ${intents[(index + 1) % intents.length]}`.trim(),
  ];
}
