/**
 * 知径 Pathfinder — M5 验收脚本（真实实例 localhost:3000）
 * 覆盖：preview / confirm / practice 追问 / evaluate 在「当前 AI 引擎」下全链路可用；
 * 输出中 providerLabel 随引擎来源变化（Mock 标注「Mock 编排」，DeepSeek 标注「AI 整理」）。
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

let jar = "";
async function req(method, path, body) {
  const h = { "Content-Type": "application/json" };
  if (jar) h["Cookie"] = jar;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await res.json(); } catch {}
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = set.find((c) => c.startsWith("pf_session="));
  if (raw) jar = raw.split(";")[0];
  return { status: res.status, json };
}

const email = `m5-${Date.now()}@example.com`;
let r = await req("POST", "/auth/register", { email, password: "Password123", displayName: "M5测试" });
check("注册 200", r.status === 200);

// ---- 学习路径（通用主题规划） ----
const goal = { topic: "Python 数据分析", goal: "从零到能独立完成一份数据分析报告", currentLevel: "零基础", weeklyHours: 5, deadlineWeeks: 12, preferences: ["项目实战"] };
r = await req("POST", "/paths/preview", goal);
check("preview 200", r.status === 200, `got ${r.status}`);
check("preview rationale.kind=generic", r.json?.data?.preview?.rationale?.kind === "generic");
check("preview rationale.title 含主题", typeof r.json?.data?.preview?.rationale?.title === "string" && r.json.data.preview.rationale.title.includes("Python"));
check("preview rationale.skills 非空数组", Array.isArray(r.json?.data?.preview?.rationale?.skills) && r.json.data.preview.rationale.skills.length > 0);
check("preview rationale.weeks 非空数组", Array.isArray(r.json?.data?.preview?.rationale?.weeks) && r.json.data.preview.rationale.weeks.length > 0);
check("preview 节点数 = skills 数", r.json?.data?.preview?.nodes?.length === r.json?.data?.preview?.rationale?.skills?.length);
check("preview rationale.providerLabel 非空", typeof r.json?.data?.preview?.rationale?.providerLabel === "string" && r.json.data.preview.rationale.providerLabel.length > 0);
check("preview 使用真实 Tavily", r.json?.data?.preview?.rationale?.searchProviderLabel === "Tavily 实时检索");
check("preview 包含 Agent 查询词", Array.isArray(r.json?.data?.preview?.rationale?.searchQueries) && r.json.data.preview.rationale.searchQueries.length > 0);
check("preview 确认前已有候选资料", r.json?.data?.preview?.nodes?.some((node) => node.resources?.length > 0));
check("preview 包含证据覆盖摘要", typeof r.json?.data?.preview?.rationale?.evidenceCoverageSummary === "string" && r.json.data.preview.rationale.evidenceCoverageSummary.length > 0);
console.log("     preview providerLabel:", r.json?.data?.preview?.rationale?.providerLabel);
const previewId = r.json?.data?.preview?.id;
const previewTitles = r.json?.data?.preview?.nodes?.map((node) => node.title) ?? [];

r = await req("POST", "/paths/confirm", { goal, previewId });
check("confirm 200", r.status === 200, `got ${r.status}`);
check("confirm rationale.providerLabel 非空", r.json?.data?.path?.rationale?.providerLabel?.length > 0);
check("confirm 节点数 = skills 数", r.json?.data?.path?.nodes?.length === r.json?.data?.path?.rationale?.skills?.length);
check("confirm 与用户看到的预览节点一致", JSON.stringify(r.json?.data?.path?.nodes?.map((node) => node.title) ?? []) === JSON.stringify(previewTitles));
const pathId = r.json?.data?.path?.id;

r = await req("POST", `/paths/${pathId}/resources/refresh`);
check("confirm 后真实资料持久化 200", r.status === 200, `got ${r.status}`);
check("资源 Provider 为 Tavily", r.json?.data?.provider === "tavily");
r = await req("GET", `/paths/${pathId}`);
check("持久化路径包含真实资料", r.json?.data?.path?.nodes?.some((node) => node.resources?.length > 0));
check("持久化路径包含证据可信度", ["high", "medium", "low"].includes(r.json?.data?.path?.rationale?.evidenceConfidence));

// ---- 练习 ----
r = await req("POST", "/practice/sessions", { nodeId: "need-signal" });
check("建会话 200（含 AI 开场）", r.status === 200);
const sid = r.json?.data?.session?.id;
check("开场 AI 追问非空", r.json?.data?.session?.messages?.[0]?.content?.length > 0);

r = await req("POST", `/practice/sessions/${sid}/messages`, { content: "导出按钮只是方案，底层任务是把筛选结果带走用于汇报。", clientId: `m5-${Date.now()}` });
check("发消息 200（AI 追问）", r.status === 200, `got ${r.status}`);
check("AI 追问非空", r.json?.data?.aiMessage?.content?.length > 0);

r = await req("POST", `/practice/sessions/${sid}/evaluate`);
check("evaluate 200", r.status === 200, `got ${r.status}`);
check("反馈 providerLabel 非空", r.json?.data?.feedback?.providerLabel?.length > 0);
check("反馈三维度齐全", !!r.json?.data?.feedback?.dimensions?.completeness);
console.log("     evaluate providerLabel:", r.json?.data?.feedback?.providerLabel);

console.log(`\n==== M5 验收（当前引擎）：${passed} 通过 / ${failed} 失败 ====`);
if (failed > 0) { console.log("失败项:", failures.join(", ")); process.exit(1); }
process.exit(0);
