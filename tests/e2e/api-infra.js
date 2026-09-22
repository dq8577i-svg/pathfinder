/*
 * API infrastructure acceptance:
 * Browser-equivalent HTTP → Next Route Handlers → PostgreSQL / Redis / MinIO.
 * Uses only seeded demo identities and local development credentials.
 */
const { Client } = require("pg");
const { createClient } = require("redis");

const BASE = "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://pathfinder:pathfinder_dev_password@localhost:5432/pathfinder";
const REDIS_URL = process.env.REDIS_URL || "redis://:pathfinder_redis_dev@localhost:6379";
const assertions = [];

function check(condition, label, detail = "") {
  assertions.push({ ok: Boolean(condition), label, detail });
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}${detail ? ` :: ${detail}` : ""}`);
}

async function jsonRequest(path, init = {}, cookie = "") {
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const json = await response.json().catch(() => null);
  return { response, json };
}

async function login(role) {
  const result = await jsonRequest("/api/v1/auth/demo-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const cookie = result.response.headers.get("set-cookie")?.split(";")[0] || "";
  return { ...result, cookie };
}

async function main() {
  const live = await jsonRequest("/api/v1/health/live");
  check(live.response.status === 200, "应用 live 返回 200");

  const readyBefore = await jsonRequest("/api/v1/health/ready");
  check(readyBefore.response.status === 200, "依赖 ready 返回 200");
  check(readyBefore.json?.data?.components?.postgres?.status === "ready", "PostgreSQL 就绪");
  check(readyBefore.json?.data?.components?.redis?.status === "ready", "Redis 就绪");

  const anonymousAi = await jsonRequest("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "general", messages: [{ role: "user", content: "测试" }] }),
  });
  check(anonymousAi.response.status === 401, "匿名 AI 请求被拒绝");

  const invalidRole = await login("super_admin");
  check(invalidRole.response.status === 422, "非法演示角色被拒绝");

  const roleResults = await Promise.all([
    "new_learner",
    "learner",
    "practice_learner",
    "content_admin",
    "org_admin",
  ].map(async (role) => {
    const result = await login(role);
    return result.response.status === 200 && result.cookie && result.json?.data?.user?.role === role;
  }));
  check(roleResults.every(Boolean), "五种演示角色均由后端签发隔离会话");

  const learner = await login("learner");
  check(learner.response.status === 200 && learner.cookie, "学习者后端一键登录并签发 Cookie");
  check(learner.json?.data?.user?.role === "learner", "Cookie 身份角色正确");

  const me = await jsonRequest("/api/v1/auth/me", {}, learner.cookie);
  check(me.response.status === 200 && me.json?.data?.user?.id === "u-chensi", "会话可恢复当前用户");

  const paths = await jsonRequest("/api/v1/paths", {}, learner.cookie);
  const path = paths.json?.data?.paths?.find((item) => item.id === "path-pm") || paths.json?.data?.paths?.[0];
  check(paths.response.status === 200 && path?.id, "读取当前用户学习路径");

  const forbiddenForm = new FormData();
  forbiddenForm.set("pathId", "path-owned-by-someone-else");
  forbiddenForm.set("file", new File(["denied"], "denied.txt", { type: "text/plain" }));
  const forbiddenUpload = await jsonRequest(
    "/api/v1/library/upload",
    { method: "POST", body: forbiddenForm },
    learner.cookie,
  );
  check(forbiddenUpload.response.status === 404, "上传前校验路径归属，拒绝越权路径");

  const unsupportedForm = new FormData();
  unsupportedForm.set("pathId", path.id);
  unsupportedForm.set("file", new File(["binary"], "unsafe.exe", { type: "application/x-msdownload" }));
  const unsupportedUpload = await jsonRequest(
    "/api/v1/library/upload",
    { method: "POST", body: unsupportedForm },
    learner.cookie,
  );
  check(unsupportedUpload.response.status === 415, "上传接口拒绝不允许的 MIME 类型");

  const marker = `Pathfinder infra acceptance ${Date.now()}`;
  const form = new FormData();
  form.set("pathId", path.id);
  form.set("title", "API 基础设施验收资料");
  form.set("sourceName", "本地端到端测试");
  form.set("tags", JSON.stringify(["验收", "MinIO"]));
  form.set("file", new File([marker], "infra-acceptance.txt", { type: "text/plain" }));
  const upload = await jsonRequest("/api/v1/library/upload", { method: "POST", body: form }, learner.cookie);
  const item = upload.json?.data?.item;
  check(upload.response.status === 201 && item?.id, "文件经 Route Handler 上传并写入资料元数据");
  check(item?.sourceType === "upload", "上传资料类型正确");

  const download = await jsonRequest(`/api/v1/library/${item.id}/download`, {}, learner.cookie);
  const signedUrl = download.json?.data?.url;
  check(download.response.status === 200 && /^https?:/.test(signedUrl || ""), "本人获得短时预签下载 URL");
  const objectResponse = await fetch(signedUrl);
  const objectText = await objectResponse.text();
  check(objectResponse.status === 200 && objectText === marker, "从 MinIO 下载内容与上传内容一致");

  const otherUser = await login("practice_learner");
  const denied = await jsonRequest(`/api/v1/library/${item.id}/download`, {}, otherUser.cookie);
  check(denied.response.status === 404, "其他用户无法获取文件下载地址");

  const ai = await jsonRequest("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "general",
      messages: [{ role: "user", content: "解释产品经理如何验证需求假设" }],
      context: { nodeTitle: "从表象需求到真实需求" },
    }),
  }, learner.cookie);
  check(ai.response.status === 200 && ai.json?.data?.provider === "demo", "认证 AI 请求通过服务端 Mock Provider");

  const postgres = new Client({ connectionString: DATABASE_URL });
  await postgres.connect();
  const metadata = await postgres.query(
    "select user_id, path_id, source_type, object_key from library_items where id = $1",
    [item.id],
  );
  await postgres.end();
  check(metadata.rows[0]?.user_id === "u-chensi" && metadata.rows[0]?.path_id === path.id,
    "PostgreSQL 元数据绑定正确用户与路径");
  check(metadata.rows[0]?.object_key?.startsWith(`users/u-chensi/paths/${path.id}/`),
    "MinIO 对象键按用户和路径隔离");

  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  const rateKeys = await redis.keys("pf:limit:ai-chat:*");
  check(rateKeys.length > 0, "Redis 记录 AI 限流窗口");
  const learnerRateKey = "pf:limit:ai-chat:u-chensi";
  await redis.set(learnerRateKey, "20", { EX: 60 });
  const rateLimited = await jsonRequest("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "general", messages: [{ role: "user", content: "限流验收" }] }),
  }, learner.cookie);
  check(rateLimited.response.status === 429 && rateLimited.json?.error?.code === "RATE_LIMITED",
    "超过 Redis 窗口限制后返回结构化 429");
  await redis.del(learnerRateKey);
  await redis.quit();

  const readyAfter = await jsonRequest("/api/v1/health/ready");
  check(readyAfter.json?.data?.components?.objectStore?.status === "ready", "MinIO 存储桶就绪");

  const passed = assertions.filter((item) => item.ok).length;
  const failed = assertions.length - passed;
  console.log(`\nAPI INFRA SUMMARY: ${passed}/${assertions.length} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("API INFRA RUNNER ERROR", error);
  process.exit(2);
});
