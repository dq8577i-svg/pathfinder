/**
 * 知径 Pathfinder — POST /api/v1/library/favorite（个人资料库）
 *
 * 收藏当前路径上的真实资源进资料库（source_type=resource）。
 * 校验资源确在该路径；同用户收藏同资源幂等。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { favoriteResource, ResourceNotOnPathError } from "@/lib/library/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const favoriteSchema = z.object({
  pathId: z.string().min(1),
  resourceId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = favoriteSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const item = await favoriteResource(user.id, parsed.data.pathId, parsed.data.resourceId);
    return ok({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof ResourceNotOnPathError) {
      return fail("RESOURCE_NOT_ON_PATH", "该资源不在当前学习路径", { status: 404 });
    }
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] library favorite", e);
    return err.internal();
  }
}
