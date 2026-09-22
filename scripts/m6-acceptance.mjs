/**
 * 知径 Pathfinder — M6 验收脚本（真实实例 localhost:3000）
 * 覆盖：notes CRUD + 用户隔离 + progress 聚合 + 未登录 401 + demo 笔记隔离。
 */
const BASE = "http://localhost:3000/api/v1";
let passed = 0, failed = 0;
const failures = [];
const check = (n, c, e = "") => {
  if (c) {
    passed++;
  } else {
    failed++;
    failures.push(n);
    console.log("  ✗", n, e);
  }
};

let jarA = "", jarB = "";
async function req(jar, method, path, body) {
  const h = { "Content-Type": "application/json" };
  if (jar) h["Cookie"] = jar;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch {}
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = set.find((c) => c.startsWith("pf_session="));
  if (raw) jar = raw.split(";")[0];
  return { status: res.status, json, jar };
}
const R = (m, p, b) => req("", m, p, b);
const A = (m, p, b) => req(jarA, m, p, b);
const B = (m, p, b) => req(jarB, m, p, b);

// ---- 未登录 401 ----
let r = await R("GET", "/notes");
check("未登录 GET /notes → 401", r.status === 401);
r = await R("POST", "/notes", { title: "x", content: "y" });
check("未登录 POST /notes → 401", r.status === 401);
r = await R("GET", "/me/progress");
check("未登录 GET /me/progress → 401", r.status === 401);

// ---- 注册 A / B ----
const now = Date.now();
r = await R("POST", "/auth/register", { email: `m6a-${now}@example.com`, password: "Password123", displayName: "M6甲" });
check("注册 A 200", r.status === 200); jarA = r.jar;
r = await R("POST", "/auth/register", { email: `m6b-${now}@example.com`, password: "Password123", displayName: "M6乙" });
check("注册 B 200", r.status === 200); jarB = r.jar;

// ---- 初始进度（空） ----
r = await A("GET", "/me/progress");
check("空进度 path.exists=false", r.status === 200 && r.json?.data?.progress?.path?.exists === false);
check("空进度 practice.total=0", r.json?.data?.progress?.practice?.total === 0);
check("空进度 notes.total=0", r.json?.data?.progress?.notes?.total === 0);

// ---- 新建笔记 ----
r = await A("POST", "/notes", { title: "从按钮需求回到用户任务", content: "按钮只是方案，底层任务是带走筛选结果。", keyTerms: ["表象诉求", "底层任务"], pendingQuestions: ["成功标准怎么定？"] });
check("POST /notes 200", r.status === 200, `got ${r.status}`);
check("笔记 shape 完整", !!r.json?.data?.note?.id && !!r.json?.data?.note?.updatedAt);
check("新建默认 selfAssessed=false", r.json?.data?.note?.selfAssessed === false);
check("新建默认 statusFilter=all", r.json?.data?.note?.statusFilter === "all");
check("新建默认 sourceTag=ai_draft", r.json?.data?.note?.sourceTag === "ai_draft");
const noteId = r.json?.data?.note?.id;

// 缺 title → 422
r = await A("POST", "/notes", { content: "no title" });
check("缺 title → 422", r.status === 422, `got ${r.status}`);
// 非法 nodeId → 400
r = await A("POST", "/notes", { title: "x", content: "y", nodeId: "no-such-node" });
check("非法 nodeId → 400", r.status === 400, `got ${r.status}`);

// ---- 列表 + 详情 ----
r = await A("GET", "/notes");
check("GET /notes 含新笔记", Array.isArray(r.json?.data?.notes) && r.json.data.notes.some((n) => n.id === noteId));
check("demo 笔记被隔离", !r.json?.data?.notes?.some((n) => n.id.startsWith("note-0")), "A 不应看到 u-chensi 的 demo 笔记");
r = await A("GET", `/notes/${noteId}`);
check("GET /notes/:id 200", r.status === 200 && r.json?.data?.note?.id === noteId);

// ---- PATCH ----
r = await A("PATCH", `/notes/${noteId}`, { title: "从按钮需求回到用户任务（修订）", selfAssessed: true, statusFilter: "self_assessed", sourceTag: "mixed", keyTerms: ["表象诉求", "底层任务", "可验证假设"] });
check("PATCH 200", r.status === 200, `got ${r.status}`);
check("PATCH title 生效", r.json?.data?.note?.title.includes("修订"));
check("PATCH selfAssessed=true", r.json?.data?.note?.selfAssessed === true);
check("PATCH statusFilter 生效", r.json?.data?.note?.statusFilter === "self_assessed");
check("PATCH sourceTag 生效", r.json?.data?.note?.sourceTag === "mixed");
r = await A("PATCH", `/notes/${noteId}`, { nodeId: "no-such-node" });
check("PATCH 非法 nodeId → 400", r.status === 400, `got ${r.status}`);

// ---- 用户隔离：B 看不到/动不了 A 的笔记 ----
r = await B("GET", "/notes");
check("B 列表不含 A 笔记", !r.json?.data?.notes?.some((n) => n.id === noteId));
r = await B("GET", `/notes/${noteId}`);
check("B GET A 笔记 → 404", r.status === 404, `got ${r.status}`);
r = await B("PATCH", `/notes/${noteId}`, { title: "hack" });
check("B PATCH A 笔记 → 404", r.status === 404, `got ${r.status}`);
r = await B("DELETE", `/notes/${noteId}`);
check("B DELETE A 笔记 → 404", r.status === 404, `got ${r.status}`);

// ---- 练习会话影响 progress ----
r = await A("POST", "/practice/sessions", { nodeId: "need-signal" });
check("建练习会话 200", r.status === 200);
r = await A("GET", "/me/progress");
check("progress path.exists 仍 false（A 无路径）", r.json?.data?.progress?.path?.exists === false);
check("progress practice.inProgress=1", r.json?.data?.progress?.practice?.inProgress === 1, `got ${JSON.stringify(r.json?.data?.progress?.practice)}`);
check("progress notes.total=1", r.json?.data?.progress?.notes?.total === 1);

// ---- DELETE ----
r = await A("DELETE", `/notes/${noteId}`);
check("DELETE 200", r.status === 200 && r.json?.data?.deleted === true);
r = await A("GET", `/notes/${noteId}`);
check("删除后 GET → 404", r.status === 404, `got ${r.status}`);
r = await A("GET", "/me/progress");
check("progress notes.total=0（删除后）", r.json?.data?.progress?.notes?.total === 0);

console.log(`\n==== M6 验收：${passed} 通过 / ${failed} 失败 ====`);
if (failed > 0) { console.log("失败项:", failures.join(", ")); process.exit(1); }
process.exit(0);
