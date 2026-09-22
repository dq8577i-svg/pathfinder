/**
 * S3-compatible object storage adapter for MinIO.
 *
 * Credentials are read only on the server. Callers receive opaque object keys
 * or short-lived signed URLs; bucket names and credentials are never exposed by
 * health endpoints or API errors.
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ObjectStoreHealth {
  status: "ready" | "degraded";
  detail: "ok" | "not_configured" | "unreachable";
  latencyMs: number;
}

export class ObjectStoreUnavailableError extends Error {
  constructor() {
    super("OBJECT_STORE_UNAVAILABLE");
  }
}

interface ObjectStoreConfig {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

let cached: {
  signature: string;
  client: S3Client;
  publicClient: S3Client;
  config: ObjectStoreConfig;
} | null = null;

function keySegment(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "item";
}

export function createPrivateObjectKey(userId: string, pathId: string, originalName: string): string {
  return `users/${keySegment(userId)}/paths/${keySegment(pathId)}/${crypto.randomUUID()}-${keySegment(originalName)}`;
}

export function privateObjectBelongsTo(key: string, userId: string, pathId: string): boolean {
  return key.startsWith(`users/${keySegment(userId)}/paths/${keySegment(pathId)}/`);
}

function readConfig(): ObjectStoreConfig | null {
  const endpoint = process.env.MINIO_ENDPOINT?.trim();
  const accessKeyId = process.env.MINIO_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.MINIO_SECRET_KEY?.trim();
  const bucket = process.env.MINIO_BUCKET?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    endpoint: endpoint.replace(/\/$/, ""),
    publicEndpoint: (process.env.MINIO_PUBLIC_ENDPOINT?.trim() || endpoint).replace(/\/$/, ""),
    region: process.env.MINIO_REGION?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

function getStore(): { client: S3Client; publicClient: S3Client; config: ObjectStoreConfig } {
  const config = readConfig();
  if (!config) throw new ObjectStoreUnavailableError();
  const signature = `${config.endpoint}\n${config.publicEndpoint}\n${config.region}\n${config.accessKeyId}\n${config.bucket}`;
  if (cached?.signature === signature) return cached;
  cached = {
    signature,
    config,
    client: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    // Used only to calculate browser-reachable presigned GET URLs. All server
    // traffic continues through the internal endpoint (for example minio:9000).
    publicClient: new S3Client({
      endpoint: config.publicEndpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
  return cached;
}

function isMissingBucket(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.name === "NoSuchBucket" || candidate.$metadata?.httpStatusCode === 404;
}

async function ensureBucket(): Promise<{ client: S3Client; bucket: string }> {
  const { client, config } = getStore();
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error) {
    if (!isMissingBucket(error)) throw new ObjectStoreUnavailableError();
    try {
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
    } catch (createError) {
      // A concurrent instance may have created it between HEAD and PUT.
      try {
        await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      } catch {
        void createError;
        throw new ObjectStoreUnavailableError();
      }
    }
  }
  return { client, bucket: config.bucket };
}

export async function putPrivateObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
  originalName: string;
}): Promise<void> {
  const { client, bucket } = await ensureBucket();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: { "original-name": encodeURIComponent(input.originalName).slice(0, 900) },
      }),
    );
  } catch {
    throw new ObjectStoreUnavailableError();
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  const { client, config } = getStore();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  } catch {
    throw new ObjectStoreUnavailableError();
  }
}

export async function createPrivateDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  const { publicClient, config } = getStore();
  const boundedExpiry = Math.max(30, Math.min(expiresIn, 900));
  try {
    return await getSignedUrl(
      publicClient,
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: boundedExpiry },
    );
  } catch {
    throw new ObjectStoreUnavailableError();
  }
}

export async function checkObjectStore(): Promise<ObjectStoreHealth> {
  const started = Date.now();
  if (!readConfig()) {
    return { status: "degraded", detail: "not_configured", latencyMs: Date.now() - started };
  }
  try {
    const { client, config } = getStore();
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
    return { status: "ready", detail: "ok", latencyMs: Date.now() - started };
  } catch {
    return { status: "degraded", detail: "unreachable", latencyMs: Date.now() - started };
  }
}
