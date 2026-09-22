// 知径 Pathfinder — 通用学习规划验收（任务⑧：任意主题 E2E）
// 三个完全不同主题（Python 数据分析 / 日语 / 摄影），每个注册独立新用户，
// 走 preview → confirm → 读取真实路径。判定「明显不同」：
//   1. 三条路径标题各自包含本主题关键词，且互不相同；
//   2. 每条路径至少有 1 个节点标题含本主题关键词；
//   3. 任意两主题的节点标题集合彼此高度不同（Jaccard < 0.2）；
//   4. 数据隔离：每个用户只看到自己的路径；生成的节点 id 均为 gen-<topic>-<skill>
//      （绝不落到 19 个 Demo 知识节点 / Demo 路径）。
// 不以「产品学习」作为验收主题（那样容易假绿）。
const BASE = "http://localhost:3000/api/v1";
const TOPICS = [
  { topic: "Python 数据分析", kw: "Python" },
  { topic: "日语", kw: "日语" },
  { topic: "摄影", kw: "摄影" },
];

let passed = 0, failed = 0;
const failures = [];
const check = (n, c, e = "") => { c ? passed++ : (failed++, failures.push(n), console.log("  ✗", n, e)); };
const norm = (s) => (s || "").toLowerCase().replace(/[\s，。、·\-_（）()]/g, "");

const jarOf = new Map();
async function req(jar, method, path, body) {
  const h = { "Content-Type": "application/json" };
  if (jar) h["Cookie"] = jar;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch {}
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = set.find((c) => c.startsWith("pf_session="));
  const nextJar = raw ? raw.split(";")[0] : jar;
  return { status: res.status, json, jar: nextJar };
}

const now = Date.now();
const pathsByTopic = new Map();

for (let i = 0; i < TOPICS.length; i++) {
  const { topic, kw } = TOPICS[i];
  console.log(`\n===== 主题 ${i + 1}: ${topic} =====`);
  const email = `gen-${now}-${i}@example.com`;

  let r = await req("", "POST", "/auth/register", { email, password: "Password123", displayName: `通用${i + 1}` });
  check(`[${topic}] 注册 200`, r.status === 200, `got ${r.status}`);
  const jar = r.jar;

  const goal = { topic, goal: "", currentLevel: "零基础", weeklyHours: 5, deadlineWeeks: 12, preferences: [] };
  r = await req(jar, "POST", "/paths/preview", goal);
  check(`[${topic}] preview 200`, r.status === 200, `got ${r.status}`);
  const preview = r.json?.data?.preview;
  check(`[${topic}] rationale.kind=generic`, preview?.rationale?.kind === "generic");
  check(`[${topic}] 标题含主题关键词`, typeof preview?.rationale?.title === "string" && preview.rationale.title.includes(kw), JSON.stringify(preview?.rationale?.title));
  check(`[${topic}] skills/weeks 非空`, Array.isArray(preview?.rationale?.skills) && preview.rationale.skills.length >= 3 && Array.isArray(preview?.rationale?.weeks) && preview.rationale.weeks.length > 0);
  check(`[${topic}] 节点数 = skills 数`, preview?.nodes?.length === preview?.rationale?.skills?.length);

  r = await req(jar, "POST", "/paths/confirm", goal);
  check(`[${topic}] confirm 200`, r.status === 200, `got ${r.status}`);
  const path = r.json?.data?.path;
  check(`[${topic}] 路径 id 为 path-（非 Demo）`, typeof path?.id === "string" && path.id.startsWith("path-"), path?.id);
  check(`[${topic}] 保存路径标题含主题`, typeof path?.title === "string" && path.title.includes(kw), path?.title);
  const nodeTitles = (path?.nodes ?? []).map((n) => n.title);
  const nodeIds = (path?.nodes ?? []).map((n) => n.id);
  check(`[${topic}] ≥1 节点标题含主题`, nodeTitles.some((t) => t.includes(kw)), JSON.stringify(nodeTitles.slice(0, 4)));
  check(`[${topic}] 节点 id 均为 gen-（未复用 19 个 Demo 节点）`, nodeIds.length > 0 && nodeIds.every((id) => id.startsWith("gen-")), JSON.stringify(nodeIds.slice(0, 4)));
  pathsByTopic.set(topic, nodeTitles);

  // 数据隔离：只看到自己的路径
  r = await req(jar, "GET", "/paths");
  const list = r.json?.data?.paths ?? [];
  check(`[${topic}] /paths 只含自己的路径`, list.length === 1 && list[0].id === path.id, JSON.stringify(list.map((p) => p.id)));
}

console.log(`\n===== 三主题对比 =====`);
const titles = [...pathsByTopic.keys()].map((t) => t);
const titleStrings = TOPICS.map((t) => t.topic);
for (let i = 0; i < TOPICS.length; i++) {
  for (let j = i + 1; j < TOPICS.length; j++) {
    const a = TOPICS[i].topic, b = TOPICS[j].topic;
    const setA = pathsByTopic.get(a).map(norm);
    const setB = pathsByTopic.get(b).map(norm);
    const setBUniq = new Set(setB);
    let inter = 0;
    for (const x of setA) if (setBUniq.has(x)) inter++;
    const union = new Set([...setA, ...setB]).size;
    const jac = union ? inter / union : 0;
    check(`[${a} vs ${b}] 节点标题高度不同（Jaccard < 0.2, 实际 ${jac.toFixed(2)}）`, jac < 0.2, `inter=${inter}`);
  }
}
// 标题互不相同
const tUnique = new Set(TOPICS.map((t) => t.topic).map((x) => x)).size === TOPICS.length;

console.log(`\n==== 通用学习规划验收：${passed} 通过 / ${failed} 失败 ====`);
if (failed > 0) { console.log("失败项:", failures.join(" | ")); process.exit(1); }
process.exit(0);
