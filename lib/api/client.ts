/**
 * 知径 Pathfinder — 客户端 API 客户端（M7）
 *
 * 统一信封解包：成功取 { data }，失败抛 ApiError（code / status / message）。
 * 身份：HttpOnly Cookie（pf_session）由同源 fetch 自动携带，客户端不接触任何 Secret。
 * 所有 lib/api/* 模块只依赖此文件。
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: string, status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface EnvelopeError {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
    field_errors?: Record<string, string>;
  };
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  // 统一信封：{ data, meta } | { error }。成功时解包出内层 data 交给调用方。
  const body = (data ?? {}) as { data?: T } & EnvelopeError;

  if (!res.ok || body?.error) {
    const e = body?.error;
    throw new ApiError(
      e?.code ?? "HTTP_ERROR",
      res.status,
      e?.message ?? `请求失败（${res.status}）`,
      e?.field_errors,
    );
  }
  return body.data as T;
}

/** 把 401 归一为 null（refresh 场景），其余错误原样抛出 */
export async function apiOrNull<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
