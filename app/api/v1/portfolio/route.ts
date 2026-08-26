/**
 * 知径 Pathfinder — GET/POST /api/v1/portfolio（P1/P2 作品集）
 *
 * GET ?pathId= 列出当前用户某路径的资产；POST 创建资产（绑定当前路径）。
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  createPortfolioItem,
  listPortfolioItems,
  PORTFOLIO_TYPES,
  PORTFOLIO_VISIBILITIES,
} from "@/lib/portfolio/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const createSchema = z.object({
  pathId: z.string().min(1),
  title: z.string().min(1).max(200),
  type: z.enum(PORTFOLIO_TYPES).default("note"),
  url: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(PORTFOLIO_VISIBILITIES).optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const pathId = new URL(req.url).searchParams.get("pathId") ?? "";
  if (!pathId) return fail("INVALID_INPUT", "缺少 pathId 参数", { status: 422 });
  try {
    const items = await listPortfolioItems(user.id, pathId);
    return ok({ items });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] portfolio GET", e);
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
    const item = await createPortfolioItem(user.id, parsed.data);
    return ok({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    console.error("[P2] portfolio POST", e);
    return err.internal();
  }
}
