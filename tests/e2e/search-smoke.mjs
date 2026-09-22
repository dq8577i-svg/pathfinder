// 临时冒烟：验证 Tavily Key + 端点可用（不打印 Key 值）
// 读取 site/.env.local 的 TAVILY_API_KEY，直接调 Tavily search。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envRaw = readFileSync(join(root, ".env.local"), "utf8");
const key = (envRaw.match(/^TAVILY_API_KEY=(.*)$/m) || [])[1]?.trim();
if (!key) {
  console.log("NO_TAVILY_KEY");
  process.exit(1);
}

const q = process.argv[2] || "Python requests 教程";
const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({ query: q, search_depth: "basic", max_results: 6, include_answer: false }),
  signal: AbortSignal.timeout(20000),
});
console.log("HTTP", res.status);
if (!res.ok) {
  console.log("BODY", (await res.text()).slice(0, 300));
  process.exit(1);
}
const data = await res.json();
console.log("RESULT_COUNT", data.results?.length ?? 0);
for (const r of data.results ?? []) {
  console.log(`- [${(r.score ?? 0).toFixed(2)}] ${r.title?.slice(0, 60)} | ${r.url}`);
}
