/**
 * 知径 Pathfinder — DELETE /api/v1/library/:id（个人资料库）
 *
 * 删除当前用户的某条资料（owner 级校验，他人条目 404）。
 */
import { err, fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { deleteLibraryItem } from "@/lib/library/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { id } = await params;
  try {
    await deleteLibraryItem(user.id, id);
    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof PathNotFoundError) {
      return fail("ITEM_NOT_FOUND", "资料不存在", { status: 404 });
    }
    console.error("[P2] library/:id DELETE", e);
    return err.internal();
  }
}
