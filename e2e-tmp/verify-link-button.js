/* Read-only visual verification of link-type primary buttons.
   Drives headless Chrome via raw CDP (no deps). Does NOT click / submit / log in. */
const { spawn } = require("child_process");
const http = require("http");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const USER_DATA = require("os").tmpdir() + "\\pf-cdp-" + Date.now();
const BASE = "http://localhost:3000";
const URLS = [
  BASE + "/home?role=learner",
  BASE + "/labs?role=learner",
  BASE + "/login",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

function luminance(rgb) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return null;
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]);
}
function contrastRatio(a, b) {
  const La = luminance(a), Lb = luminance(b);
  if (La == null || Lb == null) return null;
  const [hi, lo] = La >= Lb ? [La, Lb] : [Lb, La];
  return (hi + 0.05) / (lo + 0.05);
}

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + USER_DATA,
    "about:blank",
  ], { stdio: "ignore" });

  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      target = list.find((t) => t.type === "page");
      if (target) break;
    } catch (_) { /* retry */ }
    await sleep(250);
  }
  if (!target) throw new Error("CDP page target not found");
  console.log("[cdp] attached to:", target.url);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let msgId = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("Eval exception: " + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }

  await send("Page.enable");
  await send("Runtime.enable");

  const results = [];
  let foundAny = false;

  for (const url of URLS) {
    if (foundAny && results.length > 0) break; // stop after first page that yields primary buttons
    console.log("[nav] loading", url);
    await send("Page.navigate", { url });
    await sleep(1500);

    // wait for hydration: the SSR skeleton ("加载中") to be replaced by real content
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const probe = await evaluate(`(() => {
        const hasBtn = !!document.querySelector('a.bg-action, button.bg-action');
        const txt = (document.body.innerText || '');
        const loadingish = /加载中|正在加载|Loading/.test(txt) && txt.trim().length < 60;
        return { hasBtn, loadingish, len: txt.trim().length };
      })()`);
      if ((probe.hasBtn && !probe.loadingish) || !probe.loadingish) { ready = true; break; }
      await sleep(500);
    }
    await sleep(400); // settle
    console.log("[nav] ready:", ready);

    const data = await evaluate(`(() => {
      const links = Array.from(document.querySelectorAll('a.bg-action'));
      const buttons = Array.from(document.querySelectorAll('button.bg-action'));
      const styleOf = (el) => {
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          href: el.getAttribute('href') || '',
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          className: (el.className || '').toString().slice(0, 80),
        };
      };
      return {
        url: location.href,
        title: document.title,
        bodyLen: (document.body.innerText || '').trim().length,
        links: links.map(styleOf),
        buttons: buttons.map(styleOf),
      };
    })()`);

    console.log("[page]", data.url, "| title:", data.title, "| bodyLen:", data.bodyLen);
    for (const l of data.links) {
      foundAny = true;
      results.push({ page: data.url, kind: "a(link)", ...l });
    }
    for (const b of data.buttons) {
      foundAny = true;
      results.push({ page: data.url, kind: "button", ...b });
    }
  }

  console.log("\n===== VERIFICATION RESULT =====");
  for (const r of results) {
    const cr = contrastRatio(r.color, r.backgroundColor);
    const isWhite = /255,\s*255,\s*255/.test(r.color) || r.color === "rgb(255, 255, 255)";
    const readable = cr !== null && cr >= 4.5;
    console.log(JSON.stringify({
      page: r.page,
      kind: r.kind,
      text: r.text,
      href: r.href,
      color: r.color,
      backgroundColor: r.backgroundColor,
      contrast: cr === null ? null : Number(cr.toFixed(2)),
      isWhite,
      readable,
    }, null, 2));
  }
  if (results.length === 0) console.log("NO primary buttons (a.bg-action / button.bg-action) found on any page.");

  chrome.kill();
  await sleep(300);
  try { require("fs").rmSync(USER_DATA, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}

main().catch((e) => { console.error("[error]", e); process.exit(1); });
