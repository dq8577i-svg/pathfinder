import { ok } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET() {
  return ok({ status: "alive", checkedAt: new Date().toISOString() });
}
