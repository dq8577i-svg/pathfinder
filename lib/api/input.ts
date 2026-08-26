/**
 * 知径 Pathfinder — 请求输入辅助（M3）
 *
 * 统一 Zod 校验失败 → 422 INVALID_INPUT（含 field_errors），信封与 M2 一致。
 */
import { fail } from "./response";
import type { ZodError } from "zod";

export function invalidInput(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fail("INVALID_INPUT", "请求参数不合法", { status: 422, fieldErrors });
}
