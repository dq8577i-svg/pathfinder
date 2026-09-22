/**
 * 知径 Pathfinder — GET/POST /api/v1/library（个人资料库）
 *
 * GET ?pathId= 列出当前用户某路径的资料（user_id + path_id 隔离，绝不读 demo）；
 * POST 用户手动新增链接 / 笔记。真实文件必须走 /library/upload。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createLibraryItem, listLibraryItems } from "@/lib/library/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const createSchema = z.object({
  pathId: z.string().min(1),
  kind: z.enum(["link", "note"]),
  title: z.string().min(1).max(200),
  url: z.string().url().optional().nullable(),
  sourceName: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  memo: z.string().max(4000).optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const pathId = new URL(req.url).searchParams.get("pathId") ?? "";
  if (!pathId) return fail("INVALID_INPUT", "缺少 pathId 参数", { status: 422 });
  try {
    const items = await listLibraryItems(user.id, pathId);
    return ok({ items });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] library GET", e);
    return err.internal();
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const item = await createLibraryItem(user.id, parsed.data);
    return ok({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] library POST", e);
    return err.internal();
  }
}
