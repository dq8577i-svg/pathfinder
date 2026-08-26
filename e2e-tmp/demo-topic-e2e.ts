// 知径 Pathfinder — demo 模式主题数据包 E2E（纯单元脚本，无需 dev server）
//
// 验证 buildDemoTopicBundle / topicSearchResults（lib/demo/topic.ts）：
//   1. 任意主题 → 全模块派生内容含主题词，零 PM demo 词（用户研究/PRD/访谈提纲/评审清单…）。
//   2. 三主题两两 Jaccard < 0.2（主题隔离：不同主题内容互不串台）。
//   3. 节点全部 gen-*、数量 3；skills 名 = 节点标题；cards/scenarios 含节点标题。
//   4. 资料库 ↔ 路径派生不变量：每条 library 要么匹配某节点资源标题，要么是手工条目。
//   5. search 数据源全部来自主题数据包（含主题词），不引用任何 PM 常量。
//
// 运行：npx tsx e2e-tmp/demo-topic-e2e.ts
import { buildDemoTopicBundle, topicSearchResults, type DemoTopicBundle } from "@/lib/demo/topic";
import type { LearningGoalInput } from "@/lib/plan/goal";

let passed = 0;
let failed = 0;
const failures: string[] = [];
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(name);
    console.log("  ✗", name, extra);
  }
};

// 与 module-isolation-e2e.js 同源：demo p1-data 特有内容标记词，命中即代表 demo 数据渗入
const PM_DEMO_WORDS = ["用户研究", "需求分析", "需求假设", "需求调研", "产品需求", "需求文档", "访谈提纲", "评审清单", "PRD", "prd", "需求澄清"];
const DEMO_PM_NODE_IDS = ["role-basics", "user-research-basics", "interview-methods", "req-review", "prd-structure", "wireframe-ux"];
const pmScan = (texts: string[]) => PM_DEMO_WORDS.filter((w) => texts.join("\n").includes(w));

const norm = (s: string) => (s || "").toLowerCase().replace(/[\s，。、·\-_（）()【】[\]{}:：;；'"“”]/g, "");
const jaccard = (a: string[], b: string[]) => {
  const setB = new Set(b.map(norm));
  let inter = 0;
  for (const x of a.map(norm)) if (setB.has(x)) inter++;
  const union = new Set([...a.map(norm), ...b.map(norm)]).size;
  return union ? inter / union : 0;
};

const TOPICS = [
  { topic: "高中生物", tokens: ["高中生物"] },
  { topic: "Python 数据分析", tokens: ["Python", "数据分析"] },
  { topic: "摄影", tokens: ["摄影"] },
];

function goalFor(topic: string): LearningGoalInput {
  return { topic, goal: "", currentLevel: "零基础", weeklyHours: 5, deadlineWeeks: 12, preferences: [] };
}

// 汇总某主题数据包的全部可见内容，供主题一致 / PM 扫描 / Jaccard 使用
function fingerprint(b: DemoTopicBundle): string[] {
  const out: string[] = [];
  out.push(b.title, b.path.title, b.path.goalSummary);
  for (const n of b.path.nodes) out.push(n.title, n.capabilityGoal, ...n.completionCriteria, n.scenario ?? "");
  for (const s of b.skills) out.push(s.name, ...s.evidences.map((e) => e.claim));
  for (const c of b.cards) out.push(c.front, c.backSummary, ...c.tags);
  for (const sc of b.scenarios) out.push(sc.title, sc.summary, sc.task, sc.goal, ...sc.completionCriteria);
  for (const it of b.library) out.push(it.title, it.memo ?? "");
  for (const p of b.portfolio) out.push(p.title, p.summary);
  return out.filter(Boolean);
}

const bundles = new Map<string, DemoTopicBundle>();
const fingerprints = new Map<string, string[]>();

for (const { topic, tokens } of TOPICS) {
  console.log(`\n===== 主题：${topic} =====`);
  const bundle = buildDemoTopicBundle(goalFor(topic));
  bundles.set(topic, bundle);

  // 1) 路径
  check(`[${topic}] 路径标题含主题词`, tokens.some((t) => bundle.path.title.includes(t)), bundle.path.title);
  check(`[${topic}] 节点数 = 3`, bundle.path.nodes.length === 3, `n=${bundle.path.nodes.length}`);
  check(`[${topic}] 节点 id 全部 gen-*`, bundle.path.nodes.every((n) => n.id.startsWith("gen-")), bundle.path.nodes.map((n) => n.id).join(","));
  check(
    `[${topic}] 节点标题全部含主题词`,
    bundle.path.nodes.every((n) => tokens.some((t) => n.title.includes(t))),
    bundle.path.nodes.map((n) => n.title).join(" / "),
  );
  check(
    `[${topic}] 节点前置链完整`,
    bundle.path.nodes.every(
      (n, i) =>
        n.sequence === i + 1 &&
        (i === 0 ? n.prerequisiteIds.length === 0 : n.prerequisiteIds.length === 1),
    ),
  );

  // 2) skills = 节点标题（一节点一维）
  check(
    `[${topic}] skills 名 = 节点标题`,
    bundle.skills.length === bundle.path.nodes.length &&
      bundle.skills.every((s, i) => s.name === bundle.path.nodes[i]?.title),
    bundle.skills.map((s) => s.name).join(" / "),
  );

  // 3) cards / scenarios 含节点标题
  check(
    `[${topic}] 复习卡含节点标题`,
    bundle.cards.length === bundle.path.nodes.length &&
      bundle.cards.every((c, i) => c.front.includes(bundle.path.nodes[i]!.title)),
  );
  check(
    `[${topic}] 情境场景含节点标题且 sourceNodeId 有效`,
    bundle.scenarios.length === bundle.path.nodes.length &&
      bundle.scenarios.every((s, i) => s.title.includes(bundle.path.nodes[i]!.title) && bundle.path.nodes.some((n) => n.id === s.sourceNodeId)),
  );

  // 4) 资料库 ↔ 路径派生不变量
  const resourceTitles = new Set(bundle.path.nodes.flatMap((n) => n.resources.map((r) => r.title)));
  const manualKinds = new Set(["note", "file"]);
  const libAllDerived = bundle.library.every((it) => {
    if (manualKinds.has(it.kind)) return true; // 手工 note/file 条目
    if (it.kind === "link") return it.url != null && resourceTitles.has(it.title); // 资源收藏 → 标题必须匹配某路径资源
    return false;
  });
  check(`[${topic}] 资料库条目全部可回溯到路径资源或手工条目`, libAllDerived, bundle.library.map((l) => l.title).join(" / "));
  check(
    `[${topic}] 资料库 linkedNodeIds 均有效`,
    bundle.library.every((it) => it.linkedNodeIds.every((id) => bundle.path.nodes.some((n) => n.id === id))),
  );

  // 5) portfolio 含主题
  check(
    `[${topic}] 作品集含主题词`,
    bundle.portfolio.length >= 2 && bundle.portfolio.every((p) => tokens.some((t) => p.title.includes(t))),
    bundle.portfolio.map((p) => p.title).join(" / "),
  );

  // 6) search 全部来自主题数据包
  const hits = topicSearchResults(bundle);
  check(`[${topic}] search ≥1 条`, hits.length >= 1, `n=${hits.length}`);
  check(
    `[${topic}] search 命中均含主题词`,
    hits.every((r) => tokens.some((t) => r.title.includes(t) || r.snippet.includes(t))),
    hits.slice(0, 3).map((r) => r.title).join(" / "),
  );

  // 7) 零 PM demo 词 + 零 PM 节点 id
  const fp = fingerprint(bundle);
  fingerprints.set(topic, fp);
  const pm = pmScan([...fp, ...hits.map((r) => `${r.title} ${r.snippet}`)]);
  check(`[${topic}] 全模块零 PM demo 词`, pm.length === 0, pm.join(","));
  const pmIds = DEMO_PM_NODE_IDS.filter((id) => fp.join("\n").includes(id));
  check(`[${topic}] 零 PM demo 节点 id`, pmIds.length === 0, pmIds.join(","));
}

// 8) 主题隔离：三主题两两 Jaccard < 0.2
console.log("\n===== 主题隔离（Jaccard < 0.2）=====");
const names = TOPICS.map((t) => t.topic);
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = fingerprints.get(names[i])!;
    const b = fingerprints.get(names[j])!;
    const jd = jaccard(a, b);
    check(`Jaccard(${names[i]}, ${names[j]}) = ${jd.toFixed(3)} < 0.2`, jd < 0.2, `got ${jd.toFixed(3)}`);
  }
}

// 9) 不同主题 bundle 之间绝无互相复用的节点/资料 id
console.log("\n===== 跨主题 id 隔离 =====");
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const idsA = new Set(bundles.get(names[i])!.path.nodes.map((n) => n.id));
    const idsB = new Set(bundles.get(names[j])!.path.nodes.map((n) => n.id));
    const overlap = [...idsA].filter((id) => idsB.has(id));
    check(`节点 id 无重叠(${names[i]}, ${names[j]})`, overlap.length === 0, overlap.join(","));
  }
}

console.log(`\n===== 结果：通过 ${passed} / ${passed + failed} =====`);
if (failed > 0) {
  console.log("失败项：", failures.join(", "));
  process.exit(1);
}
