import { deleteCache, getJsonCache, setJsonCache } from "@/lib/infra/redis";
import type { LearningPath } from "@/lib/types";

const PREVIEW_TTL_SECONDS = 30 * 60;

function cacheKey(userId: string, previewId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const safePreview = previewId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `pf:path-preview:${safeUser}:${safePreview}`;
}

export async function savePathPreview(userId: string, preview: LearningPath): Promise<void> {
  await setJsonCache(cacheKey(userId, preview.id), preview, PREVIEW_TTL_SECONDS);
}

export async function readPathPreview(userId: string, previewId: string): Promise<LearningPath | null> {
  return getJsonCache<LearningPath>(cacheKey(userId, previewId));
}

export async function consumePathPreview(userId: string, previewId: string): Promise<LearningPath | null> {
  const key = cacheKey(userId, previewId);
  const preview = await getJsonCache<LearningPath>(key);
  if (preview) await deleteCache(key);
  return preview;
}
