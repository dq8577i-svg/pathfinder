import { fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import {
  createPrivateDownloadUrl,
  ObjectStoreUnavailableError,
  privateObjectBelongsTo,
} from "@/lib/infra/object-store";
import { getLibraryItemForUser } from "@/lib/library/service";
import { PathNotFoundError } from "@/lib/modules/shared";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "未登录或会话已失效", { status: 401 });
  const { id } = await params;
  try {
    const item = await getLibraryItemForUser(user.id, id);
    if (
      item.sourceType !== "upload" ||
      !item.objectKey ||
      !privateObjectBelongsTo(item.objectKey, user.id, item.pathId)
    ) {
      return fail("FILE_NOT_FOUND", "该资料没有可下载文件", { status: 404 });
    }
    const expiresIn = 300;
    const url = await createPrivateDownloadUrl(item.objectKey, expiresIn);
    return ok({ url, expiresIn, itemId: item.id });
  } catch (error) {
    if (error instanceof PathNotFoundError) {
      return fail("ITEM_NOT_FOUND", "资料不存在", { status: 404 });
    }
    if (error instanceof ObjectStoreUnavailableError) {
      return fail("OBJECT_STORE_UNAVAILABLE", "文件存储暂不可用，请稍后重试", { status: 503, retryable: true });
    }
    return fail("DOWNLOAD_FAILED", "暂时无法生成下载链接", { status: 500, retryable: true });
  }
}
