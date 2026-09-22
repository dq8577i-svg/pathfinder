const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const outputDir = path.resolve(process.cwd(), "docs", "screenshots");
const baseUrl = "http://localhost:3000";
const multipathEmail = process.env.PATHFINDER_CAPTURE_EMAIL;

const captures = [
  { name: "01-landing-desktop", url: "/", viewport: { width: 1440, height: 900 } },
  { name: "02-home-desktop", url: "/home", role: "learner", viewport: { width: 1440, height: 900 } },
  { name: "03-path-desktop", url: "/path", role: "learner", viewport: { width: 1440, height: 900 } },
  { name: "04-login-mobile", url: "/login", viewport: { width: 390, height: 844 } },
  { name: "05-home-mobile", url: "/home", role: "learner", viewport: { width: 390, height: 844 } },
  { name: "06-onboarding-desktop", url: "/onboarding", role: "new_learner", viewport: { width: 1440, height: 900 } },
  { name: "07-onboarding-mobile", url: "/onboarding", role: "new_learner", viewport: { width: 390, height: 844 } },
  { name: "08-paths-desktop", url: "/paths", role: "learner", viewport: { width: 1440, height: 900 } },
];
if (multipathEmail) {
  captures.push({
    name: "09-multi-path-desktop",
    url: "/paths",
    loginEmail: multipathEmail,
    viewport: { width: 1440, height: 900 },
  });
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const findings = [];
  try {
    for (const capture of captures) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport(capture.viewport);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      if (capture.role) {
        await page.goto(baseUrl + "/login", { waitUntil: "networkidle2", timeout: 45000 });
        const login = await page.evaluate(async (role) => {
          const response = await fetch("/api/v1/auth/demo-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          });
          return response.status;
        }, capture.role);
        if (login !== 200) throw new Error(`demo login failed for ${capture.role}: ${login}`);
      } else if (capture.loginEmail) {
        await page.goto(baseUrl + "/login", { waitUntil: "networkidle2", timeout: 45000 });
        const login = await page.evaluate(async (email) => {
          const response = await fetch("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: "FreshPass123!" }),
          });
          return response.status;
        }, capture.loginEmail);
        if (login !== 200) throw new Error(`user login failed for ${capture.loginEmail}: ${login}`);
      }
      await page.goto(baseUrl + capture.url, { waitUntil: "networkidle2", timeout: 45000 });
      await page.screenshot({
        path: path.join(outputDir, `${capture.name}.png`),
        fullPage: true,
      });
      const viewport = await page.evaluate(() => ({
        path: window.location.pathname,
        width: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        title: document.title,
      }));
      findings.push({ name: capture.name, ...viewport, pageErrors });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
