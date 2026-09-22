/** Optional Redis adapter used by rate limiting and readiness probes. */
import { createClient, type RedisClientType } from "redis";

export interface RedisHealth {
  status: "ready" | "degraded";
  detail: "ok" | "not_configured" | "unreachable";
  latencyMs: number;
}

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

function redisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

async function connectedClient(): Promise<RedisClientType> {
  const url = redisUrl();
  if (!url) throw new Error("REDIS_NOT_CONFIGURED");
  if (!client) {
    client = createClient({
      url,
      socket: {
        connectTimeout: 1_500,
        reconnectStrategy: false,
      },
    });
    // node-redis requires an error listener. Deliberately do not log URLs,
    // credentials, or raw errors because they can contain connection details.
    client.on("error", () => undefined);
  }
  if (client.isReady) return client;
  if (!connecting) {
    connecting = client.connect().then(() => client as RedisClientType).finally(() => {
      connecting = null;
    });
  }
  return connecting;
}

export async function evaluateFixedWindow(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ count: number; ttlSeconds: number }> {
  const redis = await connectedClient();
  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('TTL', KEYS[1])",
    "return {count, ttl}",
  ].join("\n");
  const value = (await redis.eval(script, {
    keys: [key],
    arguments: [String(windowSeconds), String(limit)],
  })) as unknown;
  if (!Array.isArray(value) || value.length < 2) throw new Error("REDIS_BAD_RESPONSE");
  const count = Number(value[0]);
  const ttlSeconds = Number(value[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlSeconds)) throw new Error("REDIS_BAD_RESPONSE");
  return { count, ttlSeconds: Math.max(1, ttlSeconds) };
}

export async function checkRedis(): Promise<RedisHealth> {
  const started = Date.now();
  if (!redisUrl()) {
    return { status: "degraded", detail: "not_configured", latencyMs: Date.now() - started };
  }
  try {
    const redis = await connectedClient();
    const pong = await redis.ping();
    return {
      status: pong === "PONG" ? "ready" : "degraded",
      detail: pong === "PONG" ? "ok" : "unreachable",
      latencyMs: Date.now() - started,
    };
  } catch {
    return { status: "degraded", detail: "unreachable", latencyMs: Date.now() - started };
  }
}

/** 短期工作流快照：用于把确认页采用的方案与最终落库方案保持一致。 */
export async function setJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = await connectedClient();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const redis = await connectedClient();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function deleteCache(key: string): Promise<void> {
  const redis = await connectedClient();
  await redis.del(key);
}
