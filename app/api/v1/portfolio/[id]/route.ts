/**
 * 知径 Pathfinder — PATCH/DELETE /api/v1/portfolio/:id（P1/P2 作品集）
 */
import { z } from "zod";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  deletePortfolioItem,
  PORTFOLIO_TYPES,
  PORTFOLIO_VISIBILITIES,
  updatePortfolioItem,
} from "@/lib/portfolio/service";
import { PathNotFoundError } from "@/lib/modules/shared";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(PORTFOLIO_TYPES).optional(),
  url: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(PORTFOLIO_VISIBILITIES).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);
  try {
    const item = await updatePortfolioItem(user.id, id, parsed.data);
    return ok({ item });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("ITEM_NOT_FOUND", "作品不存在", { status: 404 });
    }
    console.error("[P2] portfolio/:id PATCH", e);
    return err.internal();
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { id } = await params;
  try {
    await deletePortfolioItem(user.id, id);
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("ITEM_NOT_FOUND", "作品不存在", { status: 404 });
    }
    console.error("[P2] portfolio/:id DELETE", e);
    return err.internal();
  }
}
