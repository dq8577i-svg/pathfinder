import { evaluateFixedWindow } from "@/lib/infra/redis";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  degraded: boolean;
  reason?: "backend_unavailable";
}

function failOpen(): boolean {
  // Demo mode is a zero-infrastructure, Mock-only review environment, so Redis
  // must never block it even when served through `next start` (NODE_ENV=production).
  return process.env.NEXT_PUBLIC_DATA_SOURCE !== "api" ||
    process.env.NODE_ENV !== "production" ||
    process.env.REDIS_FAIL_OPEN === "true";
}

export function positiveEnvInt(name: string, fallback: number, maximum: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isInteger(raw) || raw <= 0) return fallback;
  return Math.min(raw, maximum);
}

export async function consumeRateLimit(input: {
  namespace: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const safeSubject = input.subject.replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 160);
  const key = `pf:limit:${input.namespace}:${safeSubject}`;
  try {
    const { count, ttlSeconds } = await evaluateFixedWindow(key, input.limit, input.windowSeconds);
    return {
      allowed: count <= input.limit,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: ttlSeconds,
      degraded: false,
    };
  } catch {
    return {
      allowed: failOpen(),
      limit: input.limit,
      remaining: 0,
      retryAfterSeconds: input.windowSeconds,
      degraded: true,
      reason: "backend_unavailable",
    };
  }
}

export function requestSubject(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "anonymous";
}
