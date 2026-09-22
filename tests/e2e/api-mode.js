// 知径 Pathfinder DemoZ V2 — api-mode 完整用户链路浏览器验收。
// 真实前端 → API → PostgreSQL → 服务端 AI Provider（可为 Mock/DeepSeek）→ 前端渲染。
// 产品合同：用户可输入任意学习主题，可创建并切换多条路径；产品经理仅是策展模板之一。
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
    console: c.console.slice(0, 8),
    pageErrors: c.pageErrors.slice(0, 8),
    requestFails: c.requestFails.slice(0, 8),
    httpErrors: c.httpErrors.slice(0, 10),
  };
  c.assertions.forEach((a) => console.log(`  [${a.ok ? "PASS" : "FAIL"}] ${a.label}${a.detail ? " :: " + a.detail : ""}`));
  if (summary.fail === 0) {
    const tokens = await c.scanTokens();
    if (tokens.length) { summary.fail += 1; console.log(`  [FAIL] token leak: ${JSON.stringify(tokens.slice(0, 3))}`); }
    else console.log("  [PASS] no sk- token leaks in DOM/scripts");
  }
  await c.close();
  results.push(summary);
}

async function main() {
  await runChain("full-user-journey", async (c) => {
    const email = `ui-full-${Date.now()}@example.com`;
    let sid = "";

    // 1. 注册（UI，真实认证）
    await c.goto("/register");
    await c.type("#reg-name", "浏览器新人");
    await c.type("#reg-email", email);
    await c.type("#reg-password", "FreshPass123!");
    await c.type("#reg-confirm", "FreshPass123!");
    await c.click("#reg-agree");
    await c.clickText("创建并开始规划");
    await c.sleep(3500);
    c.ok((await c.url()).includes("/onboarding"), "注册后自动登录跳转目标诊断", c.url());
    await c.waitForText("你想学什么", 15000);
    c.ok(await c.hasText("学习主题"), "注册成功进入任意主题创建流程");

    // 2. 任意主题诊断（UI 四步：主题→基础→时间→期限）→ 预览 → 确认
    await c.type("#topic", "Python 数据分析");
    await c.type("#goal", "12 周内独立完成一份可复现的数据分析报告");
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
    c.ok(await c.hasText("Python 数据分析学习路径"), "路径方案围绕用户输入主题");
    c.ok(await c.hasText("个技能节点"), "通用主题生成可执行技能节点");
    c.ok(await c.hasText("路径依据与可信度"), "确认前展示真实依据与可信度");
    c.ok(await c.hasText("检索：Tavily 实时检索"), "确认前展示真实检索 Provider");
    await c.clickText("确认此路径");
    // confirm 会再次调用真实 AI 规划（服务端确定性映射），耗时可能 10–30s；
    // 等待真实导航到 /paths，而不是固定 sleep。
    await c.page
      .waitForFunction(() => location.pathname.startsWith("/paths"), { timeout: 120000, polling: 500 })
      .then(() => c.ok(true, "确认后跳转 /paths", c.url()))
      .catch(() => c.ok(false, "确认后跳转 /paths", c.url()));
    await c.waitForText("Python 数据分析学习路径", 20000);
    c.ok(await c.hasText("新建路径"), "/paths 提供继续创建路径入口");

    // 3. 创建第二条主题路径；验证第一条仍然保留，并可显式切换当前路径
    await c.clickText("新建路径");
    await c.waitForText("你想学什么", 15000);
    await c.type("#topic", "摄影");
    await c.type("#goal", "三个月后能够独立拍摄一组人像作品");
    await c.clickText("下一步");
    await c.clickText("零基础");
    await c.clickText("下一步");
    await c.clickText("5 小时");
    await c.clickText("下一步");
    await c.clickText("12 周");
    await c.clickText("生成路径方案");
    await c.waitForText("确认此路径", 45000);
    c.ok(await c.hasText("摄影学习路径"), "第二条路径预览围绕新主题");
    await c.clickText("确认此路径");
    await c.page.waitForFunction(() => location.pathname === "/paths", { timeout: 120000, polling: 500 });
    await c.waitForText("Python 数据分析学习路径", 20000);
    c.ok(await c.hasText("摄影学习路径"), "两条真实数据库路径同时保留");
    c.ok(await c.hasText("当前路径"), "新创建路径被标记为当前路径");

    // 新路径确认后默认成为客户端当前路径；切回 Python 验证跨页面选择生效
    await c.clickText("设为当前路径");
    const activeToast = await c.waitToast("已将「Python 数据分析学习路径」设为当前路径", 10000);
    c.ok(activeToast, "可以显式切换当前路径");

    // 4. /path 渲染当前选中的 Python 路径，不再回退到产品经理固定教材
    await c.goto("/path");
    await c.waitForText("Python 数据分析学习路径", 20000);
    const pathBody = await c.bodyText();
    c.ok(/0\/\d+ 已完成/.test(pathBody), "/path 渲染当前主题的动态节点进度");
    c.ok(!(await c.hasText("产品经理角色与工作边界")), "/path 未混入产品经理固定节点");
    await c.page.waitForSelector('button[aria-label^="打开节点："]', { visible: true, timeout: 20000 });
    await c.click('button[aria-label^="打开节点："]');
    await c.waitForText("开始费曼练习", 15000);
    c.ok(true, "节点详情页渲染（围绕用户主题的首节点）");

    // 5. 开始费曼练习
    await c.clickText("开始费曼练习");
    await c.sleep(3500);
    const pracUrl = await c.url();
    c.ok(pracUrl.includes("/practice/"), "创建练习会话并跳转", pracUrl);
    sid = pracUrl.split("/practice/")[1].split("?")[0];
    c.ok(!!sid, "获得会话 ID", sid);

    // 6. 练习 UI：真实输入 → 服务端 Provider 回复渲染（轮次前进 = AI 已回复）
    await c.page.waitForSelector("textarea", { visible: true, timeout: 15000 });
    await c.type("textarea", "Python 数据分析要先明确问题，再清洗数据、选择方法并验证结论。");
    await c.press("Enter");
    await c.waitForText("第 2 / 5 轮", 90000);
    const afterAI = await c.bodyText();
    c.ok(await c.hasText("AI 生成"), "服务端 AI Provider 回复已渲染（UI → API → Provider → 前端）");
    c.ok(afterAI.includes("Python 数据分析要先明确问题"), "用户消息已渲染");

    // 6. 剩余轮次（2–5）：浏览器上下文 fetch（同 Cookie）→ Provider → 刷新渲染
    for (let i = 2; i <= 5; i++) {
      await c.page.evaluate(async ({ sid, i }) => {
        const res = await fetch(`/api/v1/practice/sessions/${sid}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `第 ${i} 轮：继续补充能力目标的要点。`, clientId: `ui-cid-${i}-${Date.now()}` }),
        });
        await res.json();
      }, { sid, i });
      c.ok(true, `轮次 ${i} 已发送（browser fetch → API → AI）`);
      await c.sleep(2500);
    }
    // 轮询等待全部对话落库（1 开场 + 5 用户 + 5 AI = 11 条）
    await c.page
      .waitForFunction(
        async (sid) => {
          const r = await fetch(`/api/v1/practice/sessions/${sid}`);
          const d = await r.json();
          return (d?.data?.session?.messages?.length ?? 0) >= 11;
        },
        { timeout: 90000, polling: 3000 },
        sid,
      )
      .then(() => c.ok(true, "全部 5 轮对话已落库（含 AI 回复）"))
      .catch(() => c.ok(false, "对话未在时限内落库"));
    await c.page.reload({ waitUntil: "networkidle2" });
    await c.waitForText("第 5 / 5 轮", 25000);
    c.ok(await c.hasText("AI 生成"), "练习页刷新后渲染全部真实对话");

    // 7. 结果页：服务端 AI 评价 + 笔记
    await c.goto(`/practice/${sid}/result`);
    await c.waitForText("这次你已经讲清", 90000);
    c.ok(await c.hasText("仍待补充"), "结果页渲染真实三维评价");
    c.ok(await c.hasText("保存笔记"), "结果页渲染笔记卡片");

    // 8. 保存笔记（内容非空 → 创建真实笔记）
    await c.type("textarea", "本节点要点：先理解核心概念，再动手练习。");
    await c.clickText("保存笔记");
    const saved = await c.waitToast("笔记已保存", 10000);
    c.ok(saved, "笔记保存成功（POST /notes）");

    // 9. /notes 渲染干净笔记
    await c.goto("/notes");
    await c.waitForText("本节点要点", 20000);
    c.ok(true, "/notes 渲染真实笔记（UTF-8）");

    // 10. /space 进度汇总
    await c.goto("/space");
    await c.waitForText("今日任务", 20000);
    c.ok(await c.hasText("继续当前节点"), "/space 渲染真实进度");

    // 11. 刷新恢复会话
    await c.page.reload({ waitUntil: "networkidle2" });
    await c.sleep(1200);
    c.ok((await c.url()).includes("/space"), "刷新后会话保持", c.url());

    // 12. 退出登录（新按钮）
    await c.clickText("退出");
    await c.sleep(2500);
    c.ok((await c.url()).includes("/login"), "退出后跳转 /login", c.url());

    // 13. 未登录访问受保护页 → 重定向
    await c.goto("/path");
    await c.sleep(1800);
    c.ok((await c.url()).includes("/login"), "未登录访问 /path 被重定向", c.url());

    // 14. 无控制台错误 / 页面异常 / HTTP 错误
    // 预认证 /auth/me 的 401 是会话探测的正常现象（store 已捕获），排除后视为干净。
    const errs = c.console.filter(
      (m) => m.type === "error" && !/401|Unauthorized|Failed to load resource.*status of 401/.test(m.text),
    );
    c.ok(errs.length === 0, "无控制台 error（排除 401 会话探测）", JSON.stringify(errs.slice(0, 3)));
    c.ok(c.pageErrors.length === 0, "无页面异常", JSON.stringify(c.pageErrors.slice(0, 3)));
    const badHttp = c.httpErrors.filter((h) => h.status >= 500);
    c.ok(badHttp.length === 0, "无 5xx 请求", JSON.stringify(badHttp.slice(0, 3)));
  });

  console.log("\n===== API-MODE E2E SUMMARY =====");
  let pass = 0, fail = 0;
  results.forEach((r) => {
    console.log(`[${r.fail === 0 ? "PASS" : "FAIL"}] ${r.name}: ${r.pass} passed, ${r.fail} failed`);
    if (r.console.length) console.log("  console:", JSON.stringify(r.console.slice(0, 3)));
    if (r.pageErrors.length) console.log("  pageErrors:", JSON.stringify(r.pageErrors.slice(0, 3)));
    if (r.requestFails.length) console.log("  requestFails:", JSON.stringify(r.requestFails.slice(0, 3)));
    if (r.httpErrors.length) console.log("  httpErrors:", JSON.stringify(r.httpErrors.slice(0, 5)));
    pass += r.pass; fail += r.fail;
  });
  console.log(`TOTAL: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("RUNNER ERROR", e); process.exit(2); });
