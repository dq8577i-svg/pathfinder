const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const outputDir = path.resolve(process.cwd(), "docs", "design-audit", "2026-09-13-premium-redesign");
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function waitForStable(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await new Promise((resolve) => setTimeout(resolve, 1800));
}

async function capture(page, name, url, options = {}) {
  await page.setViewport(options.viewport ?? { width: 1440, height: 1024, deviceScaleFactor: 1 });
  const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  await waitForStable(page);
  const metrics = await page.evaluate(() => ({
    title: document.title,
    path: location.pathname,
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    bodyText: document.body.innerText.slice(0, 1000),
  }));
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: options.fullPage ?? true });
  return { name, url, status: response?.status() ?? null, file, ...metrics };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const results = [];
  try {
    const referenceContext = await browser.createBrowserContext();
    const referencePage = await referenceContext.newPage();
    results.push(await capture(
      referencePage,
      "01-reference-claude-directory",
      "https://www.pulkit.page/claude-directory",
      { viewport: { width: 1440, height: 1024, deviceScaleFactor: 1 } },
    ));
    await referenceContext.close();

    const currentContext = await browser.createBrowserContext();
    const currentPage = await currentContext.newPage();
    results.push(await capture(currentPage, "02-current-landing", "http://localhost:3000/"));

    await currentPage.goto("http://localhost:3000/login", { waitUntil: "networkidle2", timeout: 45000 });
    const loginStatus = await currentPage.evaluate(async () => {
      const response = await fetch("/api/v1/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "learner" }),
      });
      return response.status;
    });
    if (loginStatus !== 200) throw new Error(`demo login failed: ${loginStatus}`);
    results.push(await capture(currentPage, "03-current-learning-home", "http://localhost:3000/home"));
    results.push(await capture(currentPage, "04-current-path", "http://localhost:3000/path"));
    await currentContext.close();
  } finally {
    await browser.close();
  }
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
