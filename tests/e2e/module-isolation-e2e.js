// 知径 Pathfinder — 全模块主题隔离 E2E（个人资料库修复验收 + 全左侧模块扫描）
//
// 两个完全不同主题（高中生物 / Python 数据分析），各自注册独立新用户：
//   preview → confirm → resources/refresh（真实 Tavily）→ 逐个扫左侧所有模块。
//
// 本轮验收要点（用户 4 条硬约束）：
//   1. 个人资料库 = 用户私有数据：新用户「首进」资料库必须为空（硬不变量），
//      且绝无 PM demo 数据（用户研究 / PRD / 需求分析 / 访谈提纲 / 评审清单）。
//   2. 收藏真实 Tavily 资源 → 出现在库；重复收藏幂等；新增 link/note → 刷新仍在（落库）。
//   3. 全模块扫描：home/paths/path/skills/review/labs/library/portfolio/search/notes
//      各自 api 响应零 PM demo 词；空间由 paths+progress+notes 聚合（已覆盖）。
//   4. 跨用户隔离：A 读 B 的 path/skills/library → 404；B 的库看不到 A 的条目。
const BASE = "http://localhost:3000/api/v1";
const TOPICS = [
  { topic: "高中生物", kw: "生物" },
  { topic: "Python 数据分析", kw: "Python" },
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

// 生成内容（节点标题/技能维度/卡片/情境/作品集/资料库/笔记）必须零 PM demo 内容标记词。
// 注意：不含泛词「产品经理/产品思维」——真实第三方文章标题/跨域业务语境（如数据分析向 PM 汇报）可合法出现；
// 仅含 demo p1-data 特有的内容标记（用户研究/需求分析/访谈提纲/评审清单/需求假设等），命中即代表 demo 数据渗入。
const PM_DEMO_WORDS = ["用户研究", "需求分析", "需求假设", "需求调研", "产品需求", "需求文档", "访谈提纲", "评审清单", "PRD", "prd", "需求澄清"];
const pmScan = (texts) => PM_DEMO_WORDS.filter((w) => (texts.join("\n")).includes(w));

// demo PM 路径的节点 id（p1-data / NODE_TITLES）：任何用户的搜索结果都不应命中
const DEMO_PM_NODE_IDS = ["role-basics", "user-research-basics", "interview-methods", "req-review", "prd-structure", "wireframe-ux"];

// 个人资料库 demo 泄漏硬断言词（用户约束 2）：任何用户的资料库都不得出现
const DEMO_LIB_WORDS = ["用户研究", "PRD", "prd", "需求分析", "访谈提纲", "评审清单", "需求假设"];

const now = Date.now();
const topics = [];
const pathsById = new Map();

for (let i = 0; i < TOPICS.length; i++) {
  const { topic, kw } = TOPICS[i];
  const tokens = [...new Set([kw, ...topic.split(/\s+/).filter(Boolean)])];
  console.log(`\n===== 主题 ${i + 1}: ${topic} =====`);
  const email = `iso-${now}-${i}@example.com`;

  let r = await req("", "POST", "/auth/register", { email, password: "Password123", displayName: `隔离${i + 1}` });
  check(`[${topic}] 注册 200`, r.status === 200, `got ${r.status}`);
  const jar = r.jar;

  const goal = { topic, goal: "", currentLevel: "零基础", weeklyHours: 5, deadlineWeeks: 12, preferences: [] };
  r = await req(jar, "POST", "/paths/preview", goal);
  check(`[${topic}] preview 200`, r.status === 200, `got ${r.status}`);
  r = await req(jar, "POST", "/paths/confirm", goal);
  check(`[${topic}] confirm 200`, r.status === 200, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const path = r.json?.data?.path;
  const pathId = path?.id;
  const nodeTitles = (path?.nodes ?? []).map((n) => n.title);
  check(`[${topic}] 路径节点 ≥1 含主题词`, nodeTitles.some((t) => tokens.some((tok) => t.includes(tok))), JSON.stringify(nodeTitles.slice(0, 3)));

  console.log(`  [${topic}] 刷新资源（真实 Tavily，较慢）…`);
  r = await req(jar, "POST", `/paths/${pathId}/resources/refresh`);
  check(`[${topic}] refresh 200`, r.status === 200, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const rr = r.json?.data;
  console.log(`  [${topic}] refresh：processed=${rr?.nodesProcessed} withRes=${rr?.nodesWithResources} failures=${JSON.stringify(rr?.failures)}`);

  // ===== 全模块扫描 =====
  const moduleTexts = {};

  // home
  r = await req(jar, "GET", "/me/progress");
  check(`[${topic}] home /me/progress 200`, r.status === 200, `got ${r.status}`);
  moduleTexts.home = JSON.stringify(r.json?.data ?? {});

  // paths（多路径）
  r = await req(jar, "GET", "/paths");
  const paths = r.json?.data?.paths ?? [];
  check(`[${topic}] /paths 仅自己一条路径`, r.status === 200 && paths.length === 1 && paths[0].id === pathId, `n=${paths.length}`);
  moduleTexts.paths = JSON.stringify(paths);

  // path 详情（含节点资源）
  r = await req(jar, "GET", `/paths/${pathId}`);
  const full = r.json?.data?.path;
  const resources = [];
  for (const n of full?.nodes ?? []) resources.push(...(n.resources ?? []));
  check(`[${topic}] 路径 ≥1 真实资源`, resources.length >= 1, `total=${resources.length}`);
  // 仅扫系统生成字段（节点标题/章节/摘要/能力目标）；资源标题是第三方真实内容，不纳入 demo 泄漏扫描
  moduleTexts.path = JSON.stringify(
    (full?.nodes ?? []).map((n) => ({
      title: n.title,
      chapter: n.chapter,
      summary: n.summary,
      capabilityGoal: n.capabilityGoal,
    })),
  );

  // skills 技能雷达
  r = await req(jar, "GET", `/skills/overview?pathId=${pathId}`);
  const skills = r.json?.data;
  const dimNames = (skills?.dimensions ?? []).map((d) => d.name);
  check(`[${topic}] skills 维度数=节点数`, dimNames.length === (full?.nodes ?? []).length, `dim=${dimNames.length}`);
  // 仅扫系统生成字段（维度名/章节/建议/费曼评价证据）；evidences 里的「资料·N级」claim 是第三方资源标题，不纳入
  moduleTexts.skills = JSON.stringify(
    (skills?.dimensions ?? []).map((d) => ({
      name: d.name,
      chapter: d.chapter,
      recommendation: d.recommendation,
      practiceEvidence: (d.evidences ?? []).filter((e) => e.sourceType === "费曼评价").map((e) => e.claim),
    })),
  );

  // review 复习中心
  r = await req(jar, "POST", "/review/cards/generate", { pathId });
  check(`[${topic}] cards/generate 200`, r.status === 200, `got ${r.status}`);
  r = await req(jar, "GET", `/review/cards?pathId=${pathId}`);
  const cardQs = (r.json?.data?.cards ?? []).map((c) => c.question);
  check(`[${topic}] 复习卡片 ≥1`, cardQs.length >= 1, `n=${cardQs.length}`);
  moduleTexts.review = JSON.stringify(r.json?.data ?? {});

  // labs 情境练习
  r = await req(jar, "POST", "/labs/generate", { pathId });
  check(`[${topic}] labs/generate 200`, r.status === 200, `got ${r.status}`);
  r = await req(jar, "GET", `/labs?pathId=${pathId}`);
  const scTitles = (r.json?.data?.scenarios ?? []).map((s) => s.title);
  check(`[${topic}] 情境 ≥1`, scTitles.length >= 1, `n=${scTitles.length}`);
  moduleTexts.labs = JSON.stringify(r.json?.data ?? {});

  // library 个人资料库 —— 硬不变量：新用户首进必须为空，且零 PM demo 数据
  r = await req(jar, "GET", `/library?pathId=${pathId}`);
  check(`[${topic}] library GET 200`, r.status === 200, `got ${r.status}`);
  const libEmpty = (r.json?.data?.items ?? []).length === 0;
  check(`[${topic}] ★ 新用户资料库为空（硬不变量）`, libEmpty, `n=${(r.json?.data?.items ?? []).length}`);
  const libEmptyText = JSON.stringify(r.json?.data ?? {});
  check(`[${topic}] ★ 空资料库响应零 PM demo 词`, DEMO_LIB_WORDS.filter((w) => libEmptyText.includes(w)).length === 0, DEMO_LIB_WORDS.filter((w) => libEmptyText.includes(w)).join(","));
  moduleTexts.library = libEmptyText;

  // portfolio 作品集
  r = await req(jar, "GET", `/portfolio?pathId=${pathId}`);
  check(`[${topic}] portfolio 200`, r.status === 200, `got ${r.status}`);
  const pfTitle = `${topic}核心概念整理`;
  r = await req(jar, "POST", "/portfolio", { pathId, title: pfTitle, type: "note", description: "主题隔离验证条目" });
  check(`[${topic}] portfolio 新增 201`, r.status === 201, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  moduleTexts.portfolio = JSON.stringify(r.json?.data ?? {});

  // search 语义搜索（严格 owner 过滤；资源类结果标题是第三方真实内容，不纳入 demo 泄漏扫描）
  r = await req(jar, "GET", `/search?q=${encodeURIComponent(kw)}`);
  const hits = r.json?.data?.results ?? [];
  check(`[${topic}] 搜本主题关键词有结果`, hits.length >= 1, `q=${kw}`);
  const demoPmHits = hits.filter((h) => DEMO_PM_NODE_IDS.includes(h.nodeId) || DEMO_PM_NODE_IDS.includes(h.id));
  check(`[${topic}] 搜索结果不含 demo PM 节点`, demoPmHits.length === 0, JSON.stringify(demoPmHits.map((h) => h.title)));
  moduleTexts.search = JSON.stringify(
    hits.filter((h) => h.type !== "resource").map((h) => ({ title: h.title, type: h.type })),
  );

  // notes 费曼笔记
  r = await req(jar, "GET", "/notes");
  check(`[${topic}] notes 200`, r.status === 200, `got ${r.status}`);
  moduleTexts.notes = JSON.stringify(r.json?.data ?? {});

  // ===== 生成内容零 PM 词（所有模块） =====
  const genTexts = [
    ...nodeTitles, ...dimNames, ...cardQs, ...scTitles,
    pfTitle, ...((r.json?.data?.items ?? []).map((it) => it.title)),
  ];
  const genHits = pmScan(genTexts);
  check(`[${topic}] 生成内容零 PM 词`, genHits.length === 0, genHits.join(","));
  for (const mod of ["home", "paths", "path", "skills", "review", "labs", "search", "notes"]) {
    const hits = pmScan([moduleTexts[mod]]);
    check(`[${topic}] 模块「${mod}」响应零 PM demo 词`, hits.length === 0, hits.join(","));
  }

  // ===== 资料库数据链（收藏/新增/持久化/幂等）=====
  const res = resources[0];
  r = await req(jar, "POST", "/library/favorite", { pathId, resourceId: res.id });
  check(`[${topic}] 收藏真实资源 201`, r.status === 201, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const fav = r.json?.data?.item;
  check(`[${topic}] 收藏条目 sourceType=resource`, fav?.sourceType === "resource", fav?.sourceType);
  check(`[${topic}] 收藏条目 title=资源标题`, fav?.title === res.title, `${fav?.title} vs ${res.title}`);

  r = await req(jar, "GET", `/library?pathId=${pathId}`);
  let lib = r.json?.data?.items ?? [];
  check(`[${topic}] 收藏后资料库=1`, lib.length === 1, `n=${lib.length}`);

  // 重复收藏幂等
  r = await req(jar, "POST", "/library/favorite", { pathId, resourceId: res.id });
  check(`[${topic}] 重复收藏幂等（仍 1 条）`, (await req(jar, "GET", `/library?pathId=${pathId}`)).json?.data?.items.length === 1, "dup");

  // 新增 link + note
  r = await req(jar, "POST", "/library", { pathId, kind: "link", title: `${topic}精选链接`, url: "https://example.org/handbook", sourceName: "公开资料", tags: [kw], memo: "整理自公开资料。" });
  check(`[${topic}] 新增 link 201`, r.status === 201, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);
  const linkItem = r.json?.data?.item;
  check(`[${topic}] link sourceType=link 且 status=pending`, linkItem?.sourceType === "link" && linkItem?.status === "pending", JSON.stringify(linkItem));
  r = await req(jar, "POST", "/library", { pathId, kind: "note", title: `${topic}学习摘记`, memo: "今天的关键收获。" });
  check(`[${topic}] 新增 note 201`, r.status === 201, `got ${r.status}: ${JSON.stringify(r.json?.error)}`);

  // 落库持久化：重新请求仍是 3 条
  r = await req(jar, "GET", `/library?pathId=${pathId}`);
  lib = r.json?.data?.items ?? [];
  check(`[${topic}] 资料库=3（收藏+link+note，落库持久化）`, lib.length === 3, `n=${lib.length}`);
  const libTypes = lib.map((it) => it.sourceType).sort().join(",");
  check(`[${topic}] 类型齐全 resource,link,note`, libTypes === "link,note,resource", libTypes);
  check(`[${topic}] 资料库条目零 PM demo 词`, DEMO_LIB_WORDS.filter((w) => JSON.stringify(lib).includes(w)).length === 0, DEMO_LIB_WORDS.filter((w) => JSON.stringify(lib).includes(w)).join(","));

  topics.push({ topic, kw, jar, pathId, nodeTitles, cardQs, scTitles, resources: resources.map((res) => res.title), lib });
  pathsById.set(topic, pathId);
}

// ===== 两主题两两对比（主题隔离）=====
console.log(`\n===== 两主题对比 =====`);
const a = topics[0], b = topics[1];
check(`[${a.topic} vs ${b.topic}] 节点标题高度不同（Jaccard<0.2）`, jaccard(a.nodeTitles, b.nodeTitles) < 0.2);
check(`[${a.topic} vs ${b.topic}] 复习卡片高度不同（Jaccard<0.2）`, jaccard(a.cardQs, b.cardQs) < 0.2);
check(`[${a.topic} vs ${b.topic}] 情境标题高度不同（Jaccard<0.2）`, jaccard(a.scTitles, b.scTitles) < 0.2);
check(`[${a.topic} vs ${b.topic}] 收藏资源标题不同（主题隔离）`, a.resources.length > 0 && b.resources.length > 0 && a.resources[0] !== b.resources[0], `${a.resources[0]} vs ${b.resources[0]}`);
check(`[${a.topic} vs ${b.topic}] 资料库条目互不相同`, jaccard(a.lib.map((l) => l.title), b.lib.map((l) => l.title)) < 0.2);

// ===== 跨用户隔离：A 读不到 B 的 path/skills/library =====
console.log(`\n===== 跨用户隔离 =====`);
for (let i = 0; i < topics.length; i++) {
  for (let j = 0; j < topics.length; j++) {
    if (i === j) continue;
    const u = topics[i], other = TOPICS[j].topic, otherPathId = pathsById.get(other);
    let r = await req(u.jar, "GET", `/paths/${otherPathId}`);
    check(`[${u.topic}] 读「${other}」路径 → 404`, r.status === 404, `got ${r.status}`);
    r = await req(u.jar, "GET", `/skills/overview?pathId=${otherPathId}`);
    check(`[${u.topic}] 读「${other}」技能 → 404`, r.status === 404, `got ${r.status}`);
    r = await req(u.jar, "GET", `/library?pathId=${otherPathId}`);
    check(`[${u.topic}] 读「${other}」资料库 → 404`, r.status === 404, `got ${r.status}`);
    // B 自己的库只含 B 的条目，绝不含 A 的
    r = await req(u.jar, "GET", `/library?pathId=${u.pathId}`);
    const own = r.json?.data?.items ?? [];
    const otherTitles = new Set(pathsById.get(other) === otherPathId ? topics.find((t) => t.topic === other)?.lib.map((l) => l.title) ?? [] : []);
    const leak = own.filter((it) => otherTitles.has(it.title));
    check(`[${u.topic}] 自己的库不含「${other}」的条目`, leak.length === 0, JSON.stringify(leak.map((l) => l.title)));
  }
}

console.log(`\n==== 全模块主题隔离验收：${passed} 通过 / ${failed} 失败 ====`);
if (failed > 0) { console.log("失败项:", failures.join("\n  - ")); process.exit(1); }
process.exit(0);
