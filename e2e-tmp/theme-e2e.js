// 知径 Pathfinder — 三主题数据链 E2E（P1/P2 验收）
// 三个完全不同主题（Python 数据分析 / 摄影 / 英语口语），各自注册独立新用户，
// 走 preview → confirm → resources/refresh（真实 Tavily）→ 全产品模块：
//   skills/overview · review/cards(generate) · labs(generate) · search
// 判定「任意主题驱动全产品」：
//   1. 路径节点 topic-specific；任意两主题节点标题 Jaccard < 0.2。
//   2. 每主题 ≥1 节点有 ≥1 真实资源（真实 http(s) URL、grade A/B/C、sourceType 非空），
//      且单节点内资源标题两两不同。
//   3. skills / review cards / labs scenarios 各自 topic-specific、pairwise 不同。
//   4. 语义搜索返回本人数据；他主题关键词零命中。
//   5. 隔离：A 用户读 B/C 的路径与技能 → 404。
//   6. api 响应零「产品思维/用户研究/需求分析/PRD」等 PM 固定词。
const BASE = "http://localhost:3000/api/v1";
const TOPICS = [
  { topic: "Python 数据分析", kw: "Python" },
  { topic: "摄影", kw: "摄影" },
  { topic: "英语口语", kw: "英语" },
];

let passed = 0, failed = 0;
const failures = [];
const check = (n, c, e = "") => { c ? passed++ : (failed++, failures.push(n), console.log("  ✗", n, e)); };
const norm = (s) => (s || "").toLowerCase().replace(/[\s，。、·\-_（）()【】[\]{}:：;；'"“”]/g, "");

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

const jaccard = (a, b) => {
  const setB = new Set(b.map(norm));
  let inter = 0;
  for (const x of a.map(norm)) if (setB.has(x)) inter++;
  const union = new Set([...a.map(norm), ...b.map(norm)]).size;
  return union ? inter / union : 0;
};

const PM_WORDS = ["产品经理", "产品思维", "用户研究", "需求分析", "需求假设", "需求调研", "产品需求", "需求文档", "PRD", "prd"];
const pmScan = (texts) => PM_WORDS.filter((w) => (texts.join("\n")).includes(w));

const now = Date.now();
const topics = [];
const pathsById = new Map();

for (let i = 0; i < TOPICS.length; i++) {
  const { topic, kw } = TOPICS[i];
  const tokens = [...new Set([kw, ...topic.split(/\s+/).filter(Boolean)])];
  console.log(`\n===== 主题 ${i + 1}: ${topic} =====`);
  const email = `theme-${now}-${i}@example.com`;

  let r = await req("", "POST", "/auth/register", { email, password: "Password123", displayName: `主题${i + 1}` });
  check(`[${topic}] 注册 200`, r.status === 200, `got ${r.status}`);
  const jar = r.jar;

  const goal = { topic, goal: "", currentLevel: "零基础", weeklyHours: 5, deadlineWeeks: 12, preferences: [] };
  r = await req(jar, "POST", "/paths/preview", goal);
  check(`[${topic}] preview 200`, r.status === 200, `got ${r.status}`);
  const preview = r.json?.data?.preview;
  check(`[${topic}] rationale.kind=generic`, preview?.rationale?.kind === "generic");
  check(`[${topic}] preview 标题含主题词`, tokens.some((t) => (preview?.rationale?.title ?? "").includes(t)), JSON.stringify(preview?.rationale?.title));

  r = await req(jar, "POST", "/paths/confirm", goal);
  check(`[${topic}] confirm 200`, r.status === 200, `got ${r.status}`);
  const path = r.json?.data?.path;
  const pathId = path?.id;
  check(`[${topic}] 路径 id 为 path-（非 Demo）`, typeof pathId === "string" && pathId.startsWith("path-"), pathId);
  check(`[${topic}] 保存路径标题含主题词`, tokens.some((t) => (path?.title ?? "").includes(t)), path?.title);
  const nodeTitles = (path?.nodes ?? []).map((n) => n.title);
  const nodeIds = (path?.nodes ?? []).map((n) => n.id);
  check(`[${topic}] ≥1 节点标题含主题词`, nodeTitles.some((t) => tokens.some((tok) => t.includes(tok))), JSON.stringify(nodeTitles.slice(0, 4)));
  check(`[${topic}] 节点 id 均为 gen-（未复用 Demo 节点）`, nodeIds.length > 0 && nodeIds.every((id) => id.startsWith("gen-")), JSON.stringify(nodeIds.slice(0, 3)));
  check(`[${topic}] 节点数 ≥6`, nodeIds.length >= 6, `got ${nodeIds.length}`);

  // 数据隔离：/paths 只看到自己的路径
  r = await req(jar, "GET", "/paths");
  const list = r.json?.data?.paths ?? [];
  check(`[${topic}] /paths 只含自己的路径`, list.length === 1 && list[0].id === pathId, JSON.stringify(list.map((p) => p.id)));

  // ===== 真实资源检索（Tavily）=====
  console.log(`  [${topic}] 刷新资源（真实 Tavily，可能较慢）…`);
  r = await req(jar, "POST", `/paths/${pathId}/resources/refresh`);
  check(`[${topic}] refresh 200`, r.status === 200, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const rr = r.json?.data;
  check(`[${topic}] refresh provider=tavily`, rr?.provider === "tavily", rr?.provider);
  // 节点 id 为跨用户共享的确定性 gen-<topic>-<skill>（见 lib/path/service.ts 头注释）：
  // 重复主题的刷新会被幂等跳过（skipped），但资源已通过共享节点链接投递。
  // 关键不变量是「refresh 后路径上确有真实资源」，由下方 resources.length ≥ 1 判定。
  console.log(`  [${topic}] refresh：processed=${rr?.nodesProcessed} withRes=${rr?.nodesWithResources} skipped=${(rr?.skipped ?? []).length} failures=${JSON.stringify(rr?.failures)}`);

  // 读取刷新后的完整路径，收集资源
  r = await req(jar, "GET", `/paths/${pathId}`);
  const full = r.json?.data?.path;
  check(`[${topic}] getPath 200`, r.status === 200, `got ${r.status}`);
  const resources = [];
  const resByNode = [];
  for (const n of full?.nodes ?? []) {
    const resList = n.resources ?? [];
    resByNode.push(resList);
    resources.push(...resList);
  }
  check(`[${topic}] 至少一个节点有真实资源`, resources.length >= 1, `total=${resources.length}`);
  check(`[${topic}] 资源 URL 均为真实 http(s)`, resources.length > 0 && resources.every((res) => /^https?:\/\//.test(res.url || "")), JSON.stringify(resources.slice(0, 3).map((res) => res.url)));
  check(`[${topic}] 资源 grade 均为 A/B/C`, resources.length > 0 && resources.every((res) => ["A", "B", "C"].includes(res.grade)), JSON.stringify(resources.map((res) => res.grade)));
  check(`[${topic}] 资源 sourceType 非空`, resources.length > 0 && resources.every((res) => typeof res.sourceType === "string" && res.sourceType.length > 0), JSON.stringify(resources.slice(0, 3).map((res) => res.sourceType)));
  const nodeTitleDupes = resByNode.map((list) => new Set(list.map((res) => norm(res.title))).size === list.length);
  check(`[${topic}] 单节点内资源标题两两不同`, resByNode.every((list) => list.length <= 1 || new Set(list.map((res) => norm(res.title))).size === list.length), JSON.stringify(resByNode.filter((l, idx) => !nodeTitleDupes[idx]).map((l) => l.map((res) => res.title))));
  const aCount = resources.filter((res) => res.grade === "A").length;
  const bCount = resources.filter((res) => res.grade === "B").length;
  const cCount = resources.filter((res) => res.grade === "C").length;
  console.log(`  [${topic}] 资源分级 A=${aCount} B=${bCount} C=${cCount}，共 ${resources.length} 条`);

  // ===== skills/overview（技能雷达）=====
  r = await req(jar, "GET", `/skills/overview?pathId=${pathId}`);
  check(`[${topic}] skills/overview 200`, r.status === 200, `got ${r.status}`);
  const skills = r.json?.data;
  const dimNames = (skills?.dimensions ?? []).map((d) => d.name);
  check(`[${topic}] skills 维度数 = 节点数`, dimNames.length === (full?.nodes ?? []).length, `dim=${dimNames.length} nodes=${(full?.nodes ?? []).length}`);
  check(`[${topic}] skills 维度名 = 节点标题`, dimNames.join("|") === nodeTitles.join("|"));

  // ===== review cards =====
  r = await req(jar, "POST", "/review/cards/generate", { pathId });
  check(`[${topic}] cards/generate 200`, r.status === 200, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const genCards = r.json?.data?.cards ?? [];
  check(`[${topic}] 生成卡片 ≥1`, genCards.length >= 1, `created=${r.json?.data?.created}`);
  r = await req(jar, "GET", `/review/cards?pathId=${pathId}`);
  check(`[${topic}] cards list 200 且非空`, r.status === 200 && (r.json?.data?.cards ?? []).length >= 1, `got ${r.status}, n=${(r.json?.data?.cards ?? []).length}`);
  const cardQs = (r.json?.data?.cards ?? []).map((c) => c.question);

  // ===== labs =====
  r = await req(jar, "POST", "/labs/generate", { pathId });
  check(`[${topic}] labs/generate 200`, r.status === 200, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const sc = r.json?.data?.scenario;
  check(`[${topic}] scenario 标题/情境非空`, typeof sc?.title === "string" && sc.title.length > 0 && typeof sc?.situation === "string" && sc.situation.length > 0, JSON.stringify(sc?.title));
  check(`[${topic}] scenario 绑定用户节点`, typeof sc?.nodeId === "string" && sc.nodeId.startsWith("gen-"), sc?.nodeId);
  check(`[${topic}] scenario rubric 非空`, typeof sc?.rubric === "string" && sc.rubric.length > 0);
  r = await req(jar, "GET", `/labs?pathId=${pathId}`);
  check(`[${topic}] labs list 非空`, r.status === 200 && (r.json?.data?.scenarios ?? []).length >= 1, `got ${r.status}, n=${(r.json?.data?.scenarios ?? []).length}`);
  const scTitles = (r.json?.data?.scenarios ?? []).map((s) => s.title);

  // ===== 语义搜索：本人命中；他主题关键词零命中（跨主题隔离）=====
  r = await req(jar, "GET", `/search?q=${encodeURIComponent(kw)}`);
  const own = r.json?.data?.results ?? [];
  check(`[${topic}] 搜索本主题关键词有结果`, own.length >= 1, `q=${kw}, got ${own.length}: ${JSON.stringify(own.slice(0, 2))}`);
  const other = TOPICS[(i + 1) % TOPICS.length];
  r = await req(jar, "GET", `/search?q=${encodeURIComponent(other.kw)}`);
  const otherRes = r.json?.data?.results ?? [];
  check(`[${topic}] 搜「${other.kw}」零命中（跨主题隔离）`, otherRes.length === 0, `got ${otherRes.length}: ${JSON.stringify(otherRes.slice(0, 2))}`);

  // ===== 零 PM 词：只扫产品自身生成的内容（节点标题/技能维度/复习卡片/情境标题）。
  //     资源标题来自真实网络（Tavily），属外部内容，仅提示不判失败 =====
  const genTexts = [...nodeTitles, ...dimNames, ...cardQs, ...scTitles];
  const genHits = pmScan(genTexts);
  check(`[${topic}] 生成内容零 PM 词`, genHits.length === 0, genHits.join(","));
  const resHits = pmScan(resources.map((res) => res.title));
  if (resHits.length > 0) console.log(`  ! [${topic}] 外部资源标题含 PM 词（真实网络内容，不计失败）：${resHits.join(",")}`);

  topics.push({ topic, kw, jar, pathId, nodeTitles, resources: resources.map((res) => res.title), cardQs, scTitles });
  pathsById.set(topic, pathId);
}

// ===== 三主题两两对比：主题特异性 =====
console.log(`\n===== 三主题对比 =====`);
for (let i = 0; i < topics.length; i++) {
  for (let j = i + 1; j < topics.length; j++) {
    const a = topics[i], b = topics[j];
    const jn = jaccard(a.nodeTitles, b.nodeTitles);
    check(`[${a.topic} vs ${b.topic}] 节点标题高度不同（Jaccard < 0.2, 实际 ${jn.toFixed(2)}）`, jn < 0.2);
    const jr = jaccard(a.resources, b.resources);
    check(`[${a.topic} vs ${b.topic}] 资源标题高度不同（Jaccard < 0.2, 实际 ${jr.toFixed(2)}）`, jr < 0.2);
    const jc = jaccard(a.cardQs, b.cardQs);
    check(`[${a.topic} vs ${b.topic}] 复习卡片问题高度不同（Jaccard < 0.2, 实际 ${jc.toFixed(2)}）`, jc < 0.2);
    const js = jaccard(a.scTitles, b.scTitles);
    check(`[${a.topic} vs ${b.topic}] 情境标题高度不同（Jaccard < 0.2, 实际 ${js.toFixed(2)}）`, js < 0.2);
  }
}

// ===== 跨用户隔离：A 读不到 B/C 的路径与技能 =====
console.log(`\n===== 跨用户隔离 =====`);
for (let i = 0; i < topics.length; i++) {
  for (let j = 0; j < topics.length; j++) {
    if (i === j) continue;
    const a = topics[i], bTopic = TOPICS[j].topic, bPathId = pathsById.get(bTopic);
    let r = await req(a.jar, "GET", `/paths/${bPathId}`);
    check(`[${a.topic}] 读「${bTopic}」路径 → 404`, r.status === 404, `got ${r.status}`);
    r = await req(a.jar, "GET", `/skills/overview?pathId=${bPathId}`);
    check(`[${a.topic}] 读「${bTopic}」技能 → 404`, r.status === 404, `got ${r.status}`);
  }
}

console.log(`\n==== 三主题数据链验收：${passed} 通过 / ${failed} 失败 ====`);
if (failed > 0) { console.log("失败项:", failures.join("\n  - ")); process.exit(1); }
process.exit(0);
