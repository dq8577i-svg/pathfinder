const puppeteer = require("puppeteer-core");

const email = process.env.PATHFINDER_CAPTURE_EMAIL;
if (!email) throw new Error("PATHFINDER_CAPTURE_EMAIL is required");

const baseUrl = "http://localhost:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  const checks = [];
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2", timeout: 45000 });
    const loginStatus = await page.evaluate(async ({ email }) => {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "FreshPass123!" }),
      });
      return response.status;
    }, { email });
    assert(loginStatus === 200, `login failed: ${loginStatus}`);
    checks.push("authenticated learner session");

    await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForFunction(() => document.body.innerText.includes("继续学习"));

    const beforeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.click(beforeTheme === "dark" ? 'button[aria-label="使用浅色主题"]' : 'button[aria-label="使用深色主题"]');
    const afterTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert(beforeTheme !== afterTheme, "theme toggle did not update data-theme");
    checks.push("light/dark theme toggle and persistence state");

    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    await page.waitForSelector('input[aria-label="搜索功能"]', { visible: true });
    await page.type('input[aria-label="搜索功能"]', "路径");
    const commandText = await page.$eval('[role="dialog"]', (element) => element.textContent || "");
    assert(commandText.includes("学习路径"), "command palette search did not filter expected action");
    await page.keyboard.press("Escape");
    await page.waitForSelector('input[aria-label="搜索功能"]', { hidden: true });
    checks.push("Ctrl+K command palette search and escape close");

    await page.click('button[aria-haspopup="menu"]');
    const pathMenu = await page.$('[role="menu"]');
    assert(pathMenu, "path switcher menu did not open");
    const menuText = await page.$eval('[role="menu"]', (element) => element.textContent || "");
    assert(menuText.includes("新建路径"), "path switcher is missing create-path entry");
    checks.push("multi-path switcher and create-path entry");

    await page.click('button[role="tab"]:nth-of-type(2)');
    const selectedTab = await page.$eval('button[role="tab"]:nth-of-type(2)', (element) => element.getAttribute("aria-selected"));
    assert(selectedTab === "true", "assistant resources tab did not activate");
    checks.push("AI learning assistant tab interaction");

    await page.click('button[aria-expanded][class*="xl:flex"]');
    const assistant = await page.$('aside[aria-label="学习助手"]');
    assert(!assistant, "learning assistant did not collapse");
    checks.push("learning assistant collapse control");

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.reload({ waitUntil: "networkidle2" });
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      mobileNavButton: Boolean(document.querySelector('button[aria-label="打开导航"]')),
    }));
    assert(metrics.width === metrics.clientWidth, `mobile horizontal overflow: ${metrics.width}/${metrics.clientWidth}`);
    assert(metrics.mobileNavButton, "mobile navigation control is missing");
    checks.push("390px responsive layout without horizontal overflow");

    assert(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);
    checks.push("no uncaught page errors");
    process.stdout.write(`${JSON.stringify({ passed: checks.length, checks, pageErrors }, null, 2)}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
