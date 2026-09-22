// E2E harness helpers for 知径 Pathfinder acceptance
const puppeteer = require("puppeteer-core");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1440,900"],
  });
}

class Chain {
  constructor(browser, name, viewport = { width: 1440, height: 900 }) {
    this.browser = browser;
    this.name = name;
    this.viewport = viewport;
    this.console = []; // {type, text, url}
    this.pageErrors = [];
    this.requestFails = [];
    this.httpErrors = [];
    this.assertions = [];
  }

  async start() {
    this.context = await this.browser.createBrowserContext();
    this.page = await this.context.newPage();
    await this.page.setViewport(this.viewport);
    this.page.on("console", (msg) => {
      const t = msg.type();
      if (t === "error" || t === "warning") {
        this.console.push({ type: t, text: msg.text().slice(0, 400), url: this.page.url() });
      }
    });
    this.page.on("pageerror", (err) =>
      this.pageErrors.push({ text: String(err.message || err).slice(0, 400), url: this.page.url() }),
    );
    this.page.on("requestfailed", (req) => {
      const url = req.url();
      const errorText = req.failure()?.errorText;
      // Next.js 会在快速导航时主动取消尚未使用的 RSC 预取；这不是用户可见的网络故障。
      if (errorText === "net::ERR_ABORTED" && url.includes("_rsc=")) return;
      this.requestFails.push({ url, err: errorText });
    });
    this.page.on("response", (res) => {
      if (res.status() >= 400) this.httpErrors.push({ url: res.url(), status: res.status() });
    });
    return this;
  }

  async close() {
    if (this.context) await this.context.close().catch(() => {});
  }

  async goto(url, opts = {}) {
    await this.page.goto(BASE + url, { waitUntil: "networkidle2", timeout: 45000, ...opts });
    return this.page;
  }

  async waitForText(text, timeout = 15000) {
    try {
      await this.page.waitForFunction(
        (t) => (document.body ? document.body.innerText.includes(t) : false),
        { timeout, polling: 200 },
        text,
      );
    } catch (e) {
      const body = await this.bodyText().catch(() => "");
      const snippet = body.replace(/\n+/g, " ").slice(0, 400);
      throw new Error(`waitForText "${text}" timeout. BODY: ${snippet}`);
    }
  }

  async waitForHydration(timeout = 15000) {
    await this.page.waitForFunction(
      () => {
        if (!document.body) return false;
        const t = document.body.innerText;
        return !t.includes("加载中…") || t.trim().length > 0;
      },
      { timeout, polling: 150 },
    );
  }

  bodyText() {
    return this.page.evaluate(() => document.body.innerText);
  }

  url() {
    return this.page.url();
  }

  async clickText(text, opts = {}) {
    const { exact = false, index = 0, within } = opts;
    const clicked = await this.page.evaluate(({ text, exact, index, within }) => {
      const root = within ? Array.from(document.querySelectorAll(within)) : [document];
      const all = [];
      for (const r of root) all.push(...Array.from(r.querySelectorAll('button, a, [role="button"], label, summary')));
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const t = norm(text);
      const matches = all.filter((e) => {
        const nt = norm(e.textContent);
        if (!nt) return false;
        if (exact) return nt === t;
        return nt.includes(t);
      });
      // pick the smallest (deepest / most specific) match
      matches.sort((a, b) => norm(a.textContent).length - norm(b.textContent).length);
      const el = matches[index];
      if (!el) return false;
      el.click();
      return true;
    }, { text, exact, index, within });
    if (!clicked) throw new Error(`[${this.name}] clickText not found: "${text}"`);
    await this.sleep(150);
  }

  async click(sel) {
    await this.page.waitForSelector(sel, { visible: true, timeout: 10000 });
    await this.page.click(sel);
    await this.sleep(150);
  }

  async type(sel, value) {
    await this.page.waitForSelector(sel, { visible: true, timeout: 10000 });
    await this.page.click(sel);
    // React-safe set via native setter + input event, then let React commit
    await this.page.$eval(
      sel,
      (el, val) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      value,
    );
    await this.page.focus(sel).catch(() => {});
    await this.sleep(150);
  }

  async press(key) {
    await this.page.keyboard.press(key);
  }

  async pressShiftEnter() {
    await this.page.keyboard.down("Shift");
    await this.page.keyboard.press("Enter");
    await this.page.keyboard.up("Shift");
  }

  async sleep(ms) {
    await new Promise((r) => setTimeout(r, ms));
  }

  async setViewport(w, h) {
    await this.page.setViewport({ width: w, height: h });
    await this.sleep(150);
  }

  ok(ok, label, detail = "") {
    this.assertions.push({ ok: !!ok, label, detail });
    return ok;
  }

  async hasText(text) {
    const t = await this.bodyText();
    return t.includes(text);
  }

  async waitToast(text, timeout = 6000) {
    const found = await this.page
      .waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 150 }, text)
      .then(() => true)
      .catch(() => false);
    return found;
  }

  /** Collect internal hrefs from current DOM. */
  collectHrefs() {
    return this.page.evaluate(() => {
      const set = new Set();
      document.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("/") && !href.startsWith("//")) set.add(href.split("#")[0].split("?")[0]);
      });
      return Array.from(set);
    });
  }

  /** Overflow check at current viewport. */
  async overflow() {
    return this.page.evaluate(() => {
      const de = document.documentElement;
      return {
        overflow: de.scrollWidth > window.innerWidth,
        scrollWidth: de.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
  }

  /** Scan DOM + loaded scripts for sk- tokens. */
  async scanTokens() {
    // 避免把 Next.js 源码路径 `task-async-*` 中的子串 `sk-async` 误报为密钥。
    // 真实供应商密钥必须以非字母数字边界开头，且主体至少 16 字符。
    const tokenPattern = /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/;
    const found = [];
    const domHits = await this.page.evaluate(() => {
      const hits = [];
      const pattern = /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{16,}/;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (pattern.test(n.textContent || "")) hits.push(n.textContent.trim().slice(0, 60));
      }
      return hits;
    });
    domHits.forEach((f) => found.push({ where: "DOM", sample: f }));

    // Loaded scripts: fetch each chunk and search for sk- tokens
    const scripts = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]")).map((s) => s.src),
    );
    for (const src of scripts) {
      if (!src.startsWith(BASE)) continue;
      try {
        const res = await fetch(src);
        const text = await res.text();
        const idx = text.search(tokenPattern);
        if (idx >= 0) found.push({ where: src, sample: text.slice(idx - 20, idx + 40) });
      } catch {}
    }
    return found;
  }
}

module.exports = { launch, Chain, BASE };
