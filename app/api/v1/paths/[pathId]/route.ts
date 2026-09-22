/**
 * 知径 Pathfinder — GET /api/v1/paths/:pathId（M3）
 *
 * 只允许当前用户访问自己的路径；他人路径与不存在统一 404，
 * 不泄露路径是否存在。返回完整路径（nodes / rationale / planVersions）。
 */
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { getPathForUser, updatePathForUser } from "@/lib/path/service";
import { z } from "zod";

const updatePathSchema = z
  .object({
    title: z.string().trim().min(2, "路径名称至少 2 个字").max(60, "路径名称最多 60 个字").optional(),
    weeklyHours: z.number().int().min(1, "每周至少投入 1 小时").max(40, "每周投入不能超过 40 小时").optional(),
    deadline: z.string().datetime({ offset: true }).optional(),
    status: z.enum(["in_progress", "paused", "completed", "archived"]).optional(),
    setPrimary: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "至少提交一个更新字段");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pathId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { pathId } = await params;
  try {
    const path = await getPathForUser(pathId, user.id);
    if (!path) return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    return ok({ path });
  } catch (e) {
    console.error("[M3] paths/:pathId", e);
    return err.internal();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pathId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const parsed = updatePathSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error);
  const { pathId } = await params;
  try {
    const path = await updatePathForUser(pathId, user.id, {
      ...parsed.data,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    });
    if (!path) return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    return ok({ path });
  } catch (e) {
    console.error("[M3] paths/:pathId PATCH", e);
    return err.internal();
  }
}
