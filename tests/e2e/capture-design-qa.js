const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const email = process.env.PATHFINDER_CAPTURE_EMAIL;
if (!email) throw new Error("PATHFINDER_CAPTURE_EMAIL is required");

const baseUrl = "http://localhost:3000";
const outputDir = path.resolve(process.cwd(), "docs", "design-qa");

async function waitStable(page) {
  await page.evaluate(async () => document.fonts?.ready && document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 700));
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2", timeout: 45000 });
  const status = await page.evaluate(async ({ email }) => {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "FreshPass123!" }),
    });
    return response.status;
  }, { email });
  if (status !== 200) throw new Error(`login failed: ${status}`);
}

async function selectPythonPath(page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/v1/paths");
    const payload = await response.json();
    const paths = payload?.data?.paths ?? payload?.paths ?? [];
    const target = paths.find((item) => item.title.includes("Python")) ?? paths[0];
    if (target) localStorage.setItem("pf-active-path", target.id);
    return { id: target?.id ?? null, count: paths.length };
  });
  if (!result.id) throw new Error("no learning path found");
  return result;
}

async function setTheme(page, theme) {
  await page.evaluate((next) => localStorage.setItem("pf-theme", next), theme);
}

async function openInteractiveState(page) {
  await page.waitForFunction(() => document.body.innerText.includes("继续学习"), { timeout: 30000 });
  await page.click('button[aria-haspopup="menu"]');
  const nodes = await page.$$('section[aria-labelledby="current-node-title"] [tabindex="0"]');
  if (nodes[0]) await nodes[0].hover();
  await waitStable(page);
}

async function captureDesktop(page, theme) {
  await setTheme(page, theme);
  await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle2", timeout: 45000 });
  await openInteractiveState(page);
  const file = path.join(outputDir, `implementation-home-${theme}-1440.png`);
  await page.screenshot({ path: file, fullPage: false });
  const metrics = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
  }));
  return { file, ...metrics };
}

async function captureMobile(page, theme) {
  await setTheme(page, theme);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle2", timeout: 45000 });
  await waitStable(page);
  const file = path.join(outputDir, `implementation-home-${theme}-390.png`);
  await page.screenshot({ path: file, fullPage: false });
  const metrics = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    width: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
  }));
  return { file, ...metrics };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  try {
    await login(page);
    const pathState = await selectPythonPath(page);
    const results = [];
    results.push(await captureDesktop(page, "dark"));
    results.push(await captureDesktop(page, "light"));
    results.push(await captureMobile(page, "dark"));
    results.push(await captureMobile(page, "light"));
    process.stdout.write(`${JSON.stringify({ email, pathState, results, consoleErrors, pageErrors }, null, 2)}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
