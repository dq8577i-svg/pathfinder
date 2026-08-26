/** 情境练习场 API 客户端（P1/P2） */
import { api } from "./client";

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

export function listScenarios(pathId: string): Promise<ScenarioDto[]> {
  return api<{ scenarios: ScenarioDto[] }>(`/labs?pathId=${encodeURIComponent(pathId)}`).then(
    (d) => d.scenarios,
  );
}

export function generateScenario(
  pathId: string,
  nodeId?: string,
): Promise<ScenarioDto> {
  return api<{ scenario: ScenarioDto }>(`/labs/generate`, {
    method: "POST",
    body: nodeId ? { pathId, nodeId } : { pathId },
  }).then((d) => d.scenario);
}

export function getScenario(scenarioId: string): Promise<ScenarioDto> {
  return api<{ scenario: ScenarioDto }>(`/labs/${encodeURIComponent(scenarioId)}`).then(
    (d) => d.scenario,
  );
}

export function replyInScenario(
  scenarioId: string,
  message: string,
): Promise<{ reply: string; isDemo: boolean }> {
  return api(`/labs/${encodeURIComponent(scenarioId)}/reply`, {
    method: "POST",
    body: { message },
  });
}
