/**
 * 知径 Pathfinder — 用户公开画像（M2）
 *
 * 返回给客户端的最小用户信息，绝不含 password_hash。
 * hasPath 由 learning_paths 存在性派生（与前端 UserProfile 字段对齐）。
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { learningPaths, users } from "@/lib/db/schema";

export interface PublicUser {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  weeklyHours: number;
  goalSummary: string | null;
  avatarUrl: string | null;
  hasPath: boolean;
  isDemo: boolean;
}

export async function buildPublicProfile(
  user: typeof users.$inferSelect,
): Promise<PublicUser> {
  const pathRows = await db
    .select({ c: learningPaths.id })
    .from(learningPaths)
    .where(eq(learningPaths.userId, user.id))
    .limit(1);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    weeklyHours: user.weeklyHours,
    goalSummary: user.goalSummary,
    avatarUrl: user.avatarUrl,
    hasPath: pathRows.length > 0,
    isDemo: user.isDemo,
  };
}
