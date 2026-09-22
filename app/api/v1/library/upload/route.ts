import { fail, ok } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createLibraryItem } from "@/lib/library/service";
import { assertPathOwned, PathNotFoundError } from "@/lib/modules/shared";
import {
  createPrivateObjectKey,
  deletePrivateObject,
  ObjectStoreUnavailableError,
  putPrivateObject,
} from "@/lib/infra/object-store";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function maxUploadBytes(): number {
  const configuredBytes = Number(process.env.MAX_UPLOAD_BYTES);
  if (Number.isInteger(configuredBytes) && configuredBytes > 0) {
    return Math.min(configuredBytes, 50 * 1024 * 1024);
  }
  // Backward-compatible convenience key for existing local environments.
  const configured = Number(process.env.MAX_UPLOAD_MB);
  const megabytes = Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 50)
    : 10;
  return Math.floor(megabytes * 1024 * 1024);
}

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 10);
    }
  } catch {
    // Comma-delimited input remains supported for plain HTML forms.
  }
  return value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
}

function displaySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "未登录或会话已失效", { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return fail("INVALID_MULTIPART", "上传表单格式不合法", { status: 400 });
  const pathId = typeof form.get("pathId") === "string" ? String(form.get("pathId")).trim() : "";
  const suppliedTitle = typeof form.get("title") === "string" ? String(form.get("title")).trim() : "";
  const sourceName = typeof form.get("sourceName") === "string" ? String(form.get("sourceName")).trim() : "";
  const memo = typeof form.get("memo") === "string" ? String(form.get("memo")).trim() : "";
  const file = form.get("file");

  if (!pathId || !(file instanceof File)) {
    return fail("INVALID_INPUT", "pathId 和文件均为必填项", { status: 422 });
  }
  const title = suppliedTitle || file.name.trim();
  if (!title || title.length > 200) return fail("INVALID_INPUT", "资料标题不合法", { status: 422 });
  if (sourceName.length > 200 || memo.length > 4_000) {
    return fail("INVALID_INPUT", "来源或备注超出长度限制", { status: 422 });
  }
  if (file.size <= 0) return fail("EMPTY_FILE", "不能上传空文件", { status: 422 });
  if (file.size > maxUploadBytes()) {
    return fail("FILE_TOO_LARGE", `文件不能超过 ${Math.round(maxUploadBytes() / 1024 / 1024)} MB`, { status: 413 });
  }
  if (!allowedTypes.has(file.type)) {
    return fail("UNSUPPORTED_FILE_TYPE", "暂不支持该文件类型", { status: 415 });
  }

  let objectKey: string | null = null;
  try {
    // Check ownership before allocating object-storage bandwidth.
    await assertPathOwned(user.id, pathId);
    objectKey = createPrivateObjectKey(user.id, pathId, file.name);
    await putPrivateObject({
      key: objectKey,
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      originalName: file.name,
    });
    try {
      const item = await createLibraryItem(user.id, {
        pathId,
        kind: "upload",
        title,
        sourceName: sourceName || "本人上传",
        tags: parseTags(form.get("tags")),
        memo,
        objectKey,
        size: displaySize(file.size),
      });
      return ok({ item }, { status: 201 });
    } catch (databaseError) {
      // Compensating action: never leave an object behind when metadata fails.
      try {
        await deletePrivateObject(objectKey);
      } catch {
        console.error("[library-upload] object rollback failed");
      }
      throw databaseError;
    }
  } catch (error) {
    if (error instanceof PathNotFoundError) {
      return fail("PATH_NOT_FOUND", "学习路径不存在", { status: 404 });
    }
    if (error instanceof ObjectStoreUnavailableError) {
      return fail("OBJECT_STORE_UNAVAILABLE", "文件存储暂不可用，请稍后重试", { status: 503, retryable: true });
    }
    console.error("[library-upload] request failed");
    return fail("UPLOAD_FAILED", "上传未完成，请重试", { status: 500, retryable: true });
  }
}
