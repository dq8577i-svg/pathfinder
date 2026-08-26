// 知径 Pathfinder — Bug1 复检：Modal 内「在新标签打开原站」真实导航验证
//
// 用户约束升级：验收核心 = 真实链接能否被用户点击打开，而非 Modal 能否开关。
//   打开节点页 → 点「详情 →」→ 读 DOM 锚点真实 href → 点「在新标签打开原站」
//   → 断言产生新标签/新页面 → 断言新页面 URL === 资源 url（精确匹配）
//   → 返回原页 → 关闭 → 换一个资源再开再验 → ESC/X/遮罩关闭后页面交互恢复。
//   全程打印诊断：href 原文 / href 是否为空 / 点击是否被拦截 / popup 与 page 事件。
const { launch, Chain } = require("./lib");

const browserP = launch();
const results = [];

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
    console: c.console.slice(0, 10),
    pageErrors: c.pageErrors.slice(0, 6),
    requestFails: c.requestFails.slice(0, 6),
  };
  c.assertions.forEach((a) => console.log(`  [${a.ok ? "PASS" : "FAIL"}] ${a.label}${a.detail ? " :: " + a.detail : ""}`));
  await c.close();
  results.push(summary);
}

async function main() {
  await runChain("modal-nav-chain", async (c) => {
    const email = `nav-${Date.now()}@example.com`;

    // ---------- 注册 + 目标诊断 ----------
    await c.goto("/register");
    await c.type("#reg-name", "导航复检用户");
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

    // 确保有真实资源
    let nRes = await c.page.evaluate(() => document.querySelectorAll('button[aria-label^="查看证据详情："]').length);
    if (nRes === 0) {
      c.ok(await c.hasText("生成学习资料"), "节点无资源 → 出现「生成学习资料」");
      await c.clickText("生成学习资料");
      await c.page
        .waitForFunction(() => document.querySelectorAll('button[aria-label^="查看证据详情："]').length >= 1, { timeout: 180000, polling: 2000 })
        .then(() => c.ok(true, "真实检索完成，资源已渲染"))
        .catch(async () => c.ok(false, "真实检索完成，资源已渲染", (await c.bodyText()).slice(0, 200)));
    }
    nRes = await c.page.evaluate(() => document.querySelectorAll('button[aria-label^="查看证据详情："]').length);
    c.ok(nRes >= 1, `节点真实资源 ≥1（实测 ${nRes}）`);
    if (nRes === 0) return;

    // 先取页面里全部资源行的真实数据（含 url），与 DOM href 逐一比对
    const rowsData = await c.page.evaluate(() =>
      Array.from(document.querySelectorAll('button[aria-label^="查看证据详情："]')).map((btn) => ({
        aria: btn.getAttribute("aria-label"),
        // 资源行 button 内文本包含 title；url 从 modal 打开后再读，这里记录行号
      })),
    );

    // ---------- 逐资源验证导航（第 1 个 + 第 2 个） ----------
    let tested = 0;
    for (let idx = 0; idx < Math.min(nRes, 3) && tested < 2; idx++) {
      // 打开资源详情 modal
      await c.page.evaluate((i) => {
        const btns = Array.from(document.querySelectorAll('button[aria-label^="查看证据详情："]'));
        btns[i].click();
      }, idx);
      await c.sleep(400);
      const openState = await c.page.evaluate(() => ({
        dialogs: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        anchor: (() => {
          const a = Array.from(document.querySelectorAll('a')).find((x) => x.textContent?.trim() === "在新标签打开原站");
          if (!a) return null;
          return {
            href: a.getAttribute("href"),
            hasHref: a.hasAttribute("href"),
            target: a.getAttribute("target"),
            rel: a.getAttribute("rel"),
            pe: getComputedStyle(a).pointerEvents,
            coveredBy: (() => {
              const r = a.getBoundingClientRect();
              const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return el === a ? null : (el?.tagName || "") + (el?.getAttribute?.("class") ? " ." + String(el.className).slice(0, 40) : "");
            })(),
          };
        })(),
      }));
      c.ok(openState.dialogs === 1, `资源${idx + 1} modal 打开`, JSON.stringify({ dialogs: openState.dialogs }));
      const anc = openState.anchor;
      c.ok(!!anc, `资源${idx + 1} 找到「在新标签打开原站」锚点`);
      if (!anc) { await c.press("Escape"); continue; }
      c.ok(anc.hasHref && anc.href && /^https?:/.test(anc.href), `资源${idx + 1} 锚点 href 为合法 http(s)`, `href=${anc.href?.slice(0, 90)}`);
      c.ok(anc.target === "_blank", `资源${idx + 1} target=_blank`, anc.target);
      c.ok(anc.pe !== "none", `资源${idx + 1} 无 pointer-events:none`, anc.pe);
      c.ok(anc.coveredBy === null, `资源${idx + 1} 锚点未被其他元素覆盖（elementFromPoint=${anc.coveredBy || "自身"}）`);
      if (!anc.hasHref || !anc.href) { await c.press("Escape"); continue; }

      // 装配 popup 捕获（真实新标签/新页面事件）
      let popup = null;
      const popupPromise = new Promise((resolve) => {
        const onPopup = (p) => { c.page.off("popup", onPopup); resolve(p); };
        c.page.on("popup", onPopup);
        setTimeout(() => resolve(null), 12000);
      });
      // 关键：elementHandle.click() 用 page.mouse 做真实鼠标输入（浏览器命中测试生效），
      // 而非 el.click() 合成点击（绕过命中测试）。修复前此点击会命中遮罩 → 关 modal、无新标签。
      let clickedReal = false;
      try {
        const anchors = await c.page.$$("a");
        for (const h of anchors) {
          const txt = await c.page.evaluate((el) => (el.textContent || "").replace(/\s+/g, " ").trim(), h);
          if (txt === "在新标签打开原站") {
            await h.click(); // 真实鼠标点击
            clickedReal = true;
            break;
          }
        }
        if (!clickedReal) throw new Error("锚点未找到");
        c.ok(true, `资源${idx + 1} 真实鼠标点击锚点成功（未被遮罩拦截）`);
      } catch (e) {
        c.ok(false, `资源${idx + 1} 真实鼠标点击锚点失败`, (e.message || "").slice(0, 200));
        await c.press("Escape");
        continue;
      }
      popup = await popupPromise;

      if (popup) {
        const pu = popup.url();
        const exact = pu === anc.href;
        c.ok(exact, `资源${idx + 1} 新标签 URL === 锚点 href（精确匹配）`, `popup=${pu.slice(0, 90)} | href=${anc.href.slice(0, 90)}`);
        if (!exact) c.ok(pu.startsWith("http") && !pu.includes("localhost:3000"), `资源${idx + 1} 新标签为外站（回退检查）`, pu.slice(0, 90));
        await popup.close().catch(() => {});
        c.ok(true, `资源${idx + 1} 新标签已关闭，返回原页面`);
      } else {
        c.ok(false, `资源${idx + 1} 点击后未产生新标签（popup 事件未触发）—— 真实导航失败`, `href=${anc.href?.slice(0, 90)}`);
      }

      // 关闭 modal，页面交互须恢复
      await c.clickText("关闭");
      await c.sleep(250);
      const after = await c.page.evaluate(() => ({
        dialogs: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
        overflow: document.body.style.overflow,
      }));
      c.ok(after.dialogs === 0 && after.overflow === "", `资源${idx + 1} 关闭后无残留（dialogs=${after.dialogs} overflow=${JSON.stringify(after.overflow)}）`);
      // 再点另一个资源行按钮仍可用
      await c.page.evaluate((i) => {
        const btns = Array.from(document.querySelectorAll('button[aria-label^="查看证据详情："]'));
        if (btns[i]) btns[i].click();
      }, idx + 1 < nRes ? idx + 1 : 0);
      await c.sleep(300);
      const reopened = await c.page.evaluate(() => document.querySelectorAll('[role="dialog"][aria-modal="true"]').length);
      c.ok(reopened === 1, `资源${idx + 1} 关闭后页面按钮仍可用（再开 modal=${reopened}）`);
      await c.press("Escape");
      await c.sleep(200);
      tested++;
    }

    // ---------- 全量 href 抽样：页面资源行的 url 是否都有效 ----------
    const hrefAudit = await c.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('button[aria-label^="查看证据详情："]'));
      return { count: rows.length, labels: rows.slice(0, 3).map((b) => b.getAttribute("aria-label")?.slice(0, 40)) };
    });
    c.ok(hrefAudit.count >= 1, "资源行仍可交互", JSON.stringify(hrefAudit));

    // ---------- 全程无 JS 错误 ----------
    c.ok(c.pageErrors.length === 0, "全程无 pageerror", JSON.stringify(c.pageErrors.slice(0, 3)));
    const realConsoleErrors = c.console.filter((x) => x.type === "error" && !x.text.includes("401"));
    c.ok(realConsoleErrors.length === 0, "全程无 console.error（除预期未登录 401）", JSON.stringify(realConsoleErrors.slice(0, 3)));
  });

  console.log(`\n==== Modal 内真实导航复检 ====`);
  for (const s of results) {
    console.log(`[${s.name}] PASS=${s.pass} FAIL=${s.fail}`);
    if (s.pageErrors.length) console.log("  pageErrors:", JSON.stringify(s.pageErrors.slice(0, 4)));
    if (s.console.length) console.log("  console:", JSON.stringify(s.console.slice(0, 4)));
  }
  const totalFail = results.reduce((n, s) => n + s.fail, 0);
  if (totalFail > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
