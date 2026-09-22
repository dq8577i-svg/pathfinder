// 知径 Pathfinder — Bug1 浏览器实测：资源证据弹窗完整交互链 + 交互残留检查（用户约束 3）
// 同时顺带浏览器渲染级验证（约束 2 / 4）：新用户 /library 空态且零 PM demo 词；/crews 占位。
//
// 交互链（约束 3 验收标准 = 关闭后页面所有交互恢复）：
//   打开资料详情 → 在新标签打开原站 → 返回 → 关闭 → 页面按钮继续可用（开第二条）→
//   ESC 关闭 → 开 → 遮罩点击关闭 → 开 → × 关闭 → 重复开关 5 次 → 点击「开始费曼练习」→
//   返回节点页 → 点击「查看路径」→ 重开节点 → 页面全交互正常。
// 残留检查：overlay DOM / body overflow / pointer-events / z-index 层级 /
//           focus 是否锁在已卸载 modal / window keydown 监听是否泄漏（add/remove 计数）。
const { launch, Chain } = require("./lib");

const browserP = launch();
const results = [];

const DEMO_LIB_WORDS = ["用户研究", "PRD", "需求分析", "访谈提纲", "评审清单", "需求假设", "产品经理"];

async function runChain(name, fn) {
  const browser = await browserP;
  const c = new Chain(browser, name);
  await c.start();
  try {
    await fn(c);
  } catch (e) {
    c.ok(false, "CHAIN EXCEPTION", e.message + " :: " + (e.stack || "").split("\n").slice(1, 3).join(" | "));
  }
  const summary = {
    name,
    pass: c.assertions.filter((a) => a.ok).length,
    fail: c.assertions.filter((a) => !a.ok).length,
    console: c.console.slice(0, 8),
    pageErrors: c.pageErrors.slice(0, 8),
    requestFails: c.requestFails.slice(0, 8),
    httpErrors: c.httpErrors.slice(0, 10),
  };
  c.assertions.forEach((a) => console.log(`  [${a.ok ? "PASS" : "FAIL"}] ${a.label}${a.detail ? " :: " + a.detail : ""}`));
  await c.close();
  results.push(summary);
}

async function main() {
  await runChain("modal-interaction-chain", async (c) => {
    const email = `modal-${Date.now()}@example.com`;

    // ---------- 注册 + 目标诊断（真实用户链路） ----------
    await c.goto("/register");
    await c.type("#reg-name", "弹窗验收用户");
    await c.type("#reg-email", email);
    await c.type("#reg-password", "FreshPass123!");
    await c.type("#reg-confirm", "FreshPass123!");
    await c.click("#reg-agree");
    await c.clickText("创建并开始规划");
    await c.sleep(3000);
    await c.waitForText("你想学什么", 15000);
    await c.type("#topic", "高中生物");
    await c.clickText("下一步");
    await c.waitForText("你目前的水平", 10000);
    await c.clickText("零基础");
    await c.clickText("下一步");
    await c.waitForText("每周可以投入", 10000);
    await c.clickText("5 小时");
    await c.clickText("下一步");
    await c.waitForText("多长时间内完成", 10000);
    await c.clickText("12 周");
    await c.clickText("生成路径方案");
    await c.waitForText("确认此路径", 45000);
    await c.clickText("确认此路径");
    await c.page
      .waitForFunction(() => location.pathname.startsWith("/paths"), { timeout: 120000, polling: 500 })
      .then(() => c.ok(true, "确认后跳转 /paths", c.url()))
      .catch(() => c.ok(false, "确认后跳转 /paths", c.url()));
    await c.waitForText("高中生物", 20000);

    // ---------- 打开节点 ----------
    await c.goto("/path");
    await c.waitForText("第 1 周", 20000);
    await c.click('button[aria-label^="打开节点："]');
    await c.waitForText("开始费曼练习", 15000);
    c.ok(true, "节点详情页渲染");

    // ---------- 确保有真实资源（无则点击「生成学习资料」触发真实 Tavily 检索） ----------
    const hasResources = await c.page.evaluate(
      () => document.querySelectorAll('button[aria-label^="查看证据详情："]').length,
    );
    if (hasResources === 0) {
      c.ok(await c.hasText("生成学习资料"), "节点无资源 → 出现「生成学习资料」");
      await c.clickText("生成学习资料");
      await c.page
        .waitForFunction(
          () => document.querySelectorAll('button[aria-label^="查看证据详情："]').length >= 1,
          { timeout: 180000, polling: 2000 },
        )
        .then(() => c.ok(true, "真实 Tavily 检索完成，资源已渲染"))
        .catch(async () => {
          c.ok(false, "真实 Tavily 检索完成，资源已渲染", (await c.bodyText()).slice(0, 300));
        });
    }
    const nRes = await c.page.evaluate(
      () => document.querySelectorAll('button[aria-label^="查看证据详情："]').length,
    );
    c.ok(nRes >= 1, `节点真实资源 ≥1（实测 ${nRes}）`);
    if (nRes === 0) return;

    // ---------- 装配 keydown 泄漏探针（add/remove 计数，直接检测 cleanup 是否泄漏） ----------
    const baseline = await c.page.evaluate(() => {
      window.__kd = 0;
      const origAdd = window.addEventListener.bind(window);
      const origRemove = window.removeEventListener.bind(window);
      window.addEventListener = (type, fn, opts) => {
        if (type === "keydown") window.__kd++;
        return origAdd(type, fn, opts);
      };
      window.removeEventListener = (type, fn, opts) => {
        if (type === "keydown") window.__kd--;
        return origRemove(type, fn, opts);
      };
      return window.__kd;
    });
    c.ok(true, `keydown 探针装配（基线 ${baseline}）`);

    const residue = () =>
      c.page.evaluate(() => ({
        dialogs: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        backdrops: document.querySelectorAll(".pf-backdrop").length,
        overflow: document.body.style.overflow,
        activeInDom: document.contains(document.activeElement),
        activeTag: document.activeElement ? document.activeElement.tagName + (document.activeElement.getAttribute?.("aria-label") ? "(" + document.activeElement.getAttribute("aria-label") + ")" : "") : "null",
        kd: window.__kd,
        maxZ: Math.max(0, ...Array.from(document.querySelectorAll("*")).map((el) => {
          const z = getComputedStyle(el).zIndex;
          return z === "auto" ? 0 : parseInt(z, 10) || 0;
        })),
      }));

    async function clickResource(n) {
      const ok = await c.page.evaluate((idx) => {
        const btns = Array.from(document.querySelectorAll('button[aria-label^="查看证据详情："]'));
        if (idx >= btns.length) return false;
        btns[idx].click();
        return true;
      }, n);
      if (!ok) throw new Error(`资源行 ${n} 不存在`);
      await c.sleep(250);
    }

    async function assertOpen(label, expect = { dialogs: 1, overflow: "hidden" }) {
      const r = await residue();
      c.ok(r.dialogs === expect.dialogs, `${label}：dialog=${r.dialogs}`, JSON.stringify(r));
      c.ok(r.overflow === expect.overflow, `${label}：body.overflow=${r.overflow}`);
      c.ok(r.kd === baseline + (expect.dialogs === 1 ? 1 : 0), `${label}：keydown 监听数=${r.kd}（期望 ${baseline + (expect.dialogs === 1 ? 1 : 0)}）`);
    }
    async function assertClosed(label) {
      const r = await residue();
      c.ok(r.dialogs === 0, `${label}：overlay 已移除（dialogs=0）`, JSON.stringify(r));
      c.ok(r.backdrops === 0, `${label}：无 backdrop 残留`, "backdrops=" + r.backdrops);
      c.ok(r.overflow === "", `${label}：body.overflow 恢复为空`, "overflow=" + r.overflow);
      c.ok(r.activeInDom, `${label}：focus 未锁在已卸载节点（activeInDom=true, ${r.activeTag}）`);
      // kd 为 undefined 说明页面已整页导航（fresh JS 上下文 → 必然零泄漏），视为通过
      c.ok(r.kd == null || r.kd === baseline, `${label}：keydown 监听已全部清理（=${r.kd}）`);
      c.ok(r.maxZ <= 60, `${label}：无 z-index 残留（maxZ=${r.maxZ}）`);
    }

    // ---------- 交互链 1：打开 → 新标签 → 关闭 → 再开（页面仍可操作） ----------
    await clickResource(0);
    await assertOpen("打开第 1 条资料详情");

    const popupPromise = new Promise((resolve) => {
      const onPopup = (p) => {
        c.page.off("popup", onPopup);
        resolve(p);
      };
      c.page.on("popup", onPopup);
    });
    // 真实鼠标点击（elementHandle.click → page.mouse，浏览器命中测试生效）；el.click() 合成点击会绕过遮罩命中
    {
      const anchors = await c.page.$$("a");
      for (const h of anchors) {
        const txt = await c.page.evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim(), h);
        if (txt === "在新标签打开原站") { await h.click(); break; }
      }
    }
    const popup = await Promise.race([popupPromise, new Promise((r) => setTimeout(() => r(null), 10000))]);
    if (popup) {
      const pu = popup.url();
      c.ok(pu.startsWith("http") && !pu.includes("localhost:3000"), "「在新标签打开原站」打开真实外链新标签", pu.slice(0, 90));
      await popup.close().catch(() => {});
      c.ok(true, "新标签已关闭，返回原页面");
    } else {
      c.ok(false, "「在新标签打开原站」打开真实外链新标签", "popup 未捕获");
    }

    await c.clickText("关闭");
    await assertClosed("点击「关闭」后");
    await clickResource(1);
    await assertOpen("关闭后再打开第 2 条资料详情（页面按钮仍可用）");

    // ---------- 交互链 2：ESC 关闭 ----------
    await c.press("Escape");
    await assertClosed("ESC 关闭后");

    // ---------- 交互链 3：遮罩点击关闭 ----------
    // 注意：c.click(".pf-backdrop") 点击的是遮罩中心（= 面板所在处），修复后面板正确盖在遮罩上，
    // 中心点击命中面板而非遮罩。这里点面板外真实遮罩区域（视口左侧中部，x<面板左缘）。
    await clickResource(0);
    await assertOpen("再次打开");
    await c.page.mouse.click(120, 450);
    await assertClosed("点击遮罩关闭后");

    // ---------- 交互链 4：× 关闭 ----------
    await clickResource(1);
    await assertOpen("再次打开第 2 条");
    await c.click('button[aria-label="关闭对话框"]');
    await assertClosed("点击 × 关闭后");

    // ---------- 交互链 5：重复开关 5 次（防泄漏/防锁死） ----------
    for (let i = 0; i < 5; i++) {
      await clickResource(0);
      await assertOpen(`重复开关 #${i + 1} 打开`);
      await c.press("Escape");
      await assertClosed(`重复开关 #${i + 1} 关闭`);
    }
    c.ok(true, "重复打开/关闭 5 次无泄漏、无锁死");

    // ---------- 关闭后继续点击真实功能按钮（约束 3 最终验收） ----------
    const nodeUrl = await c.url();
    await c.clickText("开始费曼练习");
    await c.page
      .waitForFunction(() => location.pathname.startsWith("/practice/"), { timeout: 90000, polling: 500 })
      .then(() => c.ok(true, "弹窗反复操作后「开始费曼练习」仍可用 → 进入练习", c.url()))
      .catch(() => c.ok(false, "弹窗反复操作后「开始费曼练习」仍可用 → 进入练习", c.url()));
    // nodeUrl 是完整 URL，直接用 page.goto（c.goto 会前置 BASE，不能拼接完整 URL）
    await c.page.goto(nodeUrl, { waitUntil: "networkidle2", timeout: 45000 });
    await c.waitForText("开始费曼练习", 20000);
    await c.clickText("查看路径");
    await c.page
      .waitForFunction(() => location.pathname === "/path", { timeout: 15000, polling: 300 })
      .then(() => c.ok(true, "返回路径页面"))
      .catch(() => c.ok(false, "返回路径页面", c.url()));
    await c.click('button[aria-label^="打开节点："]');
    await c.waitForText("开始费曼练习", 20000);
    c.ok(true, "重开节点 → 页面交互完全恢复");
    await assertClosed("最终：无任何 overlay/overflow/focus/keydown/z-index 残留");

    // ---------- 渲染级：新用户 /library 空态且零 PM demo 词（约束 2） ----------
    await c.goto("/library");
    await c.waitForText("还没有学习资料", 20000);
    c.ok(true, "资料库渲染空态「还没有学习资料」");
    const libBody = await c.bodyText();
    const libHits = DEMO_LIB_WORDS.filter((w) => libBody.includes(w));
    c.ok(libHits.length === 0, "资料库页面零 PM demo 词（用户研究/PRD/需求分析/访谈/评审/需求假设/产品经理）", libHits.join(","));
    c.ok(await c.hasText("从当前学习路径收藏真实资料"), "空态引导文案存在");

    // ---------- 渲染级：/crews 占位（无 demo 小队数据） ----------
    await c.goto("/crews");
    await c.waitForText("小队", 15000);
    const crewsBody = await c.bodyText();
    c.ok(crewsBody.includes("未实现"), "小队模块 api 态为占位（未实现）", crewsBody.slice(0, 120));

    // ---------- 全局：无 JS 错误 / 请求失败 ----------
    c.ok(c.pageErrors.length === 0, "全程无 pageerror", JSON.stringify(c.pageErrors.slice(0, 3)));
    // 排除预期行为：/register 首载未登录时 /api/v1/auth/me 返回 401（浏览器记为 console error）
    const realConsoleErrors = c.console.filter((x) => x.type === "error" && !x.text.includes("401"));
    c.ok(realConsoleErrors.length === 0, "全程无 console.error（除预期的未登录 401）", JSON.stringify(realConsoleErrors.slice(0, 3)));
  });

  console.log(`\n==== 弹窗交互链浏览器验收 ====`);
  for (const s of results) {
    console.log(`[${s.name}] PASS=${s.pass} FAIL=${s.fail}`);
    if (s.pageErrors.length) console.log("  pageErrors:", JSON.stringify(s.pageErrors.slice(0, 4)));
    if (s.httpErrors.length) console.log("  httpErrors:", JSON.stringify(s.httpErrors.slice(0, 6)));
  }
  const totalFail = results.reduce((n, s) => n + s.fail, 0);
  if (totalFail > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
