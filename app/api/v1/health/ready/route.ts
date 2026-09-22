import { ok } from "@/lib/api/response";
import { checkObjectStore } from "@/lib/infra/object-store";
import { checkRedis } from "@/lib/infra/redis";

export const dynamic = "force-dynamic";

async function checkPostgres(): Promise<{
  status: "ready" | "not_ready";
  detail: "ok" | "unreachable";
  latencyMs: number;
}> {
  const started = Date.now();
  try {
    // Dynamic import keeps a missing DATABASE_URL inside this controlled probe.
    const { pool } = await import("@/lib/db/client");
    await pool.query("SELECT 1 AS ready");
    return { status: "ready", detail: "ok", latencyMs: Date.now() - started };
  } catch {
    return { status: "not_ready", detail: "unreachable", latencyMs: Date.now() - started };
  }
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const [postgres, redis, objectStore] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkObjectStore(),
  ]);
  const status = postgres.status !== "ready"
    ? "not_ready"
    : redis.status === "ready" && objectStore.status === "ready"
      ? "ready"
      : "degraded";
  return ok(
    {
      status,
      checkedAt,
      components: { postgres, redis, objectStore },
    },
    { status: status === "not_ready" ? 503 : 200 },
  );
}
