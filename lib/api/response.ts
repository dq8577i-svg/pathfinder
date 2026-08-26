/**
 * 知径 Pathfinder — 统一 API 响应信封（M2）
 *
 * 契约（BACKEND-AUDIT.md §11）：
 *  - 成功：{ data, meta: { request_id } }
 *  - 失败：{ error: { code, message, retryable, request_id, field_errors? } }
 *
 * 仅服务端 Route Handler 使用。不引入任何外部依赖。
 */
import { NextResponse } from "next/server";

export function ok<T>(
  data: T,
  meta?: Record<string, unknown>,
): NextResponse {
  const { status, ...rest } = meta ?? {};
  return NextResponse.json(
    {
      data,
      meta: { request_id: crypto.randomUUID(), ...rest },
    },
    typeof status === "number" ? { status } : undefined,
  );
}

export function fail(
  code: string,
  message: string,
  opts: {
    status?: number;
    retryable?: boolean;
    fieldErrors?: Record<string, string>;
  } = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        retryable: opts.retryable ?? false,
        request_id: crypto.randomUUID(),
        ...(opts.fieldErrors ? { field_errors: opts.fieldErrors } : {}),
      },
    },
    { status: opts.status ?? 400 },
  );
}

/** 常用错误简写 */
export const err = {
  badRequest: (message = "请求参数不合法") =>
    fail("BAD_REQUEST", message, { status: 400 }),
  conflict: (message: string, fieldErrors?: Record<string, string>) =>
    fail("CONFLICT", message, { status: 409, fieldErrors }),
  unauthorized: (message = "未登录或会话已失效") =>
    fail("UNAUTHENTICATED", message, { status: 401 }),
  forbidden: (message = "无权访问") =>
    fail("FORBIDDEN", message, { status: 403 }),
  internal: (message = "服务器内部错误") =>
    fail("INTERNAL_ERROR", message, { status: 500 }),
};
