/**
 * 节点 → 搜索 Query（确定性、节流 Tavily credits）。
 * 主查询 = 节点标题本身；约一半节点追加一个变体（教程 / 视频），
 * 使同一路径内资源类型多样（含视频），又不让每个节点都扣两次配额。
 */
export function searchQueriesForNode(node: { title: string }, index: number): string[] {
  const base = node.title.trim();
  if (!base) return [];
  const queries = [base];
  if (index % 2 === 1) {
    queries.push(base + (index % 4 === 3 ? " 视频" : " 教程"));
  }
  return queries;
}
