/** 语义搜索 API 客户端（P1/P2） */
import { api } from "./client";

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

export function searchUserData(q: string): Promise<SearchHitDto[]> {
  return api<{ results: SearchHitDto[]; query: string }>(
    `/search?q=${encodeURIComponent(q)}`,
  ).then((d) => d.results);
}
