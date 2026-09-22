// 学习路径工作台专项验收：真实会话、路径管理 API、筛选/看板/抽屉/表单/持久化/响应式。
const { launch, Chain } = require("./lib");

async function main() {
  const browser = await launch();
  const c = new Chain(browser, "paths-workbench");
  await c.start();
  try {
    await c.goto("/login");
    await c.clickText("在学学习者·陈思");
    await c.sleep(3000);
    if (new URL(await c.url()).pathname === "/login") throw new Error(`快速登录未跳转 :: ${(await c.bodyText()).replace(/\n+/g, " ").slice(0, 500)}`);
    await c.page.waitForFunction(() => location.pathname !== "/login", { timeout: 20000 });
    await c.goto("/paths");
    await c.waitForText("学习路径工作台", 20000);

    c.ok(await c.hasText("偏好已保存到本机"), "展示本地偏好持久化说明");
    c.ok(await c.hasText("综合进度"), "动态进度图表已渲染");
    c.ok(!(await c.overflow()).overflow, "桌面端无横向溢出");
    await c.click('button[aria-label="使用深色主题"]');
    await c.sleep(300);
    await c.page.screenshot({ path: "docs/design-qa/paths-workbench-dark.png", fullPage: true });

    const apiResult = await c.page.evaluate(async () => {
      const listed = await fetch("/api/v1/paths").then((r) => r.json());
      const path = listed?.data?.paths?.[0];
      if (!path) return { count: 0, patchStatus: 0 };
      const patched = await fetch(`/api/v1/paths/${encodeURIComponent(path.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: path.title, weeklyHours: path.weeklyHours }),
      });
      return { count: listed.data.paths.length, patchStatus: patched.status };
    });
    c.ok(apiResult.count > 0, "真实会话可读取用户路径", String(apiResult.count));
    c.ok(apiResult.patchStatus === 200, "路径更新真实写入 API", String(apiResult.patchStatus));

    await c.type('input[aria-label="搜索学习路径"]', "不会命中的主题词");
    await c.waitForText("没有符合条件的学习路径");
    c.ok(true, "关键词搜索与空状态联动");
    await c.clickText("清空筛选");
    await c.waitForText("设为当前路径");

    await c.click('button[aria-label="看板视图"]');
    await c.waitForText("拖动路径到这里");
    const board = await c.page.evaluate(() => ({
      pressed: document.querySelector('button[aria-label="看板视图"]')?.getAttribute("aria-pressed"),
      draggable: document.querySelectorAll('[draggable="true"]').length,
      stored: localStorage.getItem("pf-paths-workbench-v1"),
    }));
    c.ok(board.pressed === "true", "列表/看板 Tab 可切换");
    c.ok(board.draggable > 0, "路径卡片支持拖动状态流转", String(board.draggable));
    c.ok(!!board.stored && board.stored.includes("board"), "看板偏好写入 localStorage");
    await c.page.reload({ waitUntil: "networkidle2" });
    await c.waitForText("学习路径工作台");
    const persisted = await c.page.$eval('button[aria-label="看板视图"]', (el) => el.getAttribute("aria-pressed"));
    c.ok(persisted === "true", "刷新后恢复看板偏好");
    await c.page.screenshot({ path: "docs/design-qa/paths-workbench-board-dark.png", fullPage: true });

    await c.click('button[aria-label="列表视图"]');
    await c.page.waitForSelector('button[aria-label^="管理 "]', { visible: true });
    await c.click('button[aria-label^="管理 "]');
    await c.waitForText("编辑路径");
    c.ok(await c.hasText("归档路径"), "更多下拉菜单包含管理动作");
    await c.clickText("查看详情");
    await c.waitForText("状态流转");
    c.ok(await c.hasText("打开完整详情"), "详情抽屉可打开并展示状态流转");
    await c.clickText("编辑路径");
    await c.type("#edit-title", "");
    await c.clickText("保存修改");
    await c.waitForText("路径名称至少 2 个字");
    c.ok(true, "编辑表单前端校验生效");
    await c.clickText("重置", { within: '[role="dialog"]' });
    const restored = await c.page.$eval("#edit-title", (el) => el.value.length >= 2);
    c.ok(restored, "编辑表单可重置");
    await c.clickText("取消");

    await c.click('button[aria-label="使用浅色主题"]');
    await c.sleep(300);
    await c.page.screenshot({ path: "docs/design-qa/paths-workbench-light.png", fullPage: true });

    await c.setViewport(390, 844);
    await c.sleep(500);
    c.ok(!(await c.overflow()).overflow, "移动端无横向溢出");
    const mobileControls = await c.page.evaluate(() => ({
      search: !!document.querySelector('input[aria-label="搜索学习路径"]'),
      board: !!document.querySelector('button[aria-label="看板视图"]'),
    }));
    c.ok(mobileControls.search && mobileControls.board, "移动端保留搜索与视图切换");
    await c.page.screenshot({ path: "docs/design-qa/paths-workbench-mobile-light.png", fullPage: true });

    const tokenHits = await c.scanTokens();
    c.ok(tokenHits.length === 0, "页面与脚本无密钥泄漏", JSON.stringify(tokenHits.slice(0, 2)));
  } catch (error) {
    c.ok(false, "CHAIN EXCEPTION", `${error.message} :: ${(error.stack || "").split("\n").slice(1, 4).join(" | ")}`);
  }

  const expectedGuest401 = (item) => item.status === 401 && String(item.url || "").includes("/api/v1/auth/me");
  const expectedGuestConsole = (item) => item.type === "error" && item.url?.endsWith("/login") && item.text?.includes("401");
  const issues = [...c.console.filter((item) => !expectedGuestConsole(item)), ...c.pageErrors, ...c.requestFails, ...c.httpErrors.filter((item) => !expectedGuest401(item))];
  c.ok(issues.length === 0, "无控制台、页面、网络或 HTTP 错误", JSON.stringify(issues.slice(0, 4)));
  for (const result of c.assertions) console.log(`[${result.ok ? "PASS" : "FAIL"}] ${result.label}${result.detail ? ` :: ${result.detail}` : ""}`);
  await c.close();
  await browser.close();
  const failures = c.assertions.filter((item) => !item.ok);
  console.log(`\npaths-workbench: ${c.assertions.length - failures.length}/${c.assertions.length} passed`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
