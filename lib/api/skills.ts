/** 技能雷达 API 客户端（P1/P2） */
import { api } from "./client";

export type SkillLevel = "待开始" | "学习中" | "已有基础" | "证据不足";

export interface SkillEvidenceDto {
  sourceType: string;
  claim: string;
  sourceId: string;
  createdAt: string;
}

export interface SkillDimensionDto {
  id: string;
  name: string;
  chapter: string;
  sequence: number;
  level: SkillLevel;
  evidenceCount: number;
  confidence: "high" | "medium" | "low";
  evidences: SkillEvidenceDto[];
  recommendation?: { gapType: string; nextAction: string; reason: string };
}

export interface SkillsOverviewDto {
  pathId: string;
  totalEvidence: number;
  maxEvidence: number;
  priority: SkillDimensionDto | null;
  dimensions: SkillDimensionDto[];
}

export function getSkillsOverview(pathId: string): Promise<SkillsOverviewDto> {
  return api<SkillsOverviewDto>(`/skills/overview?pathId=${encodeURIComponent(pathId)}`);
}
