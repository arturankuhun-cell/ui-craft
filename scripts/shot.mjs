#!/usr/bin/env node
/**
 * shot.mjs — screenshot a running app so you can actually look at it.
 *
 *   node shot.mjs http://localhost:5173 --out .ui-qa
 *   node shot.mjs http://localhost:5173 --path /settings --viewports mobile,desktop
 *   node shot.mjs http://localhost:5173 --full
 *
 * Strategy, in order:
 *   1. Playwright, if it resolves from this project — the best option.
 *   2. browser-use, if the CLI is on PATH — no npm install required.
 *   3. Nothing: prints a copy-paste recipe.
 *
 * Always exits 0 unless --strict, since a missing screenshot tool is not
 * a failure of the code being audited.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = args[i + 1];
  return next && !next.startsWith("--") ? next : true;
};

const outDir = opt("out", ".ui-qa");
const strict = args.includes("--strict");
const fullPage = args.includes("--full");
const route = opt("path", "") === true ? "" : opt("path", "");

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  mobileSm: { width: 320, height: 640 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1680, height: 1050 },
  wide: { width: 2560, height: 1440 },
};

const requested = String(opt("viewports", "mobile,laptop,desktop"))
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const viewports = requested.map((name) => {
  const v = VIEWPORTS[name];
  if (!v) {
    console.error(`Unknown viewport "${name}". Available: ${Object.keys(VIEWPORTS).join(", ")}`);
    process.exit(2);
  }
  return { name, ...v };
});

if (!url) {
  console.log(`
shot.mjs — screenshot a running app

  node shot.mjs http://localhost:5173 --out .ui-qa
  node shot.mjs http://localhost:5173 --path /dashboard
  node shot.mjs http://localhost:5173 --viewports mobile,laptop --full
  node shot.mjs http://localhost:5173 --dark

Viewports: ${Object.keys(VIEWPORTS).join(", ")}
`);
  process.exit(0);
}

const target = url + (route ? (route.startsWith("/") ? route : `/${route}`) : "");
const isDark = args.includes("--dark");

await mkdir(outDir, { recursive: true });

// ---- 1. Playwright ------------------------------------------------------

async function tryPlaywright() {
  let chromium;
  const require = createRequire(import.meta.url);
  for (const pkg of ["playwright", "playwright-core", "@playwright/test", "puppeteer", "puppeteer-core"]) {
    try {
      const mod = await import(pkg);
      const resolved = pkg.startsWith("@") ? require.resolve(pkg) : pkg;
      void resolved;
      chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return { chromium, pkg };
    } catch {
      /* keep looking */
    }
  }
  return null;
}

// ---- 2. browser-use -----------------------------------------------------

function which(cmd) {
  return new Promise((resolve) => {
    const p = spawn(process.platform === "win32" ? "where" : "which", [cmd], { shell: false });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", (code) => resolve(code === 0 ? out.split(/\r?\n/)[0].trim() : null));
    p.on("error", () => resolve(null));
  });
}

/**
 * The helper receives the viewport as a plain tuple and slices it with a
 * loop. Avoids the cross-process JSON boundary entirely, and avoids a
 * bracket-chain that is fragile to paste.
 */
const PAGE_INFO_SNIPPET = (w, h) => `pi = page_info()
print(pi['url'])
print(pi['title'])
print(pi['w'], pi['h'])
print(page_screenshot(full=${fullPage ? "True" : "False"}))`;

function runBrowserUse(bin, vp) {
  return new Promise((resolve) => {
    const script = [
      `new_tab(${JSON.stringify(target)})`,
      `wait_for_load()`,
      PAGE_INFO_SNIPPET(vp.width, vp.height),
    ].join("\n");

    const p = spawn(bin, [], { shell: process.platform === "win32" });
    let out = "";
    let err = "";

    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ ok: false, reason: e.message }));
    p.on("close", (code) => {
      const b64 = out.match(/data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)/);
      if (b64) {
        resolve({ ok: true, base64: b64[1] });
      } else {
        resolve({ ok: false, reason: (err || out || `exit ${code}`).slice(-500) });
      }
    });

    p.stdin.write(script + "\n");
    p.stdin.end();
  });
}

// ---- dispatch -----------------------------------------------------------

const pw = await tryPlaywright();

if (pw) {
  console.log(`Using ${pw.pkg}\n`);
  const browser = await pw.chromium.launch();
  const results = [];

  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      colorScheme: isDark ? "dark" : "light",
    });
    const page = await ctx.newPage();
    await page.goto(target, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(500);

    const file = `${outDir}/${vp.name}${route ? `-${route.replace(/\W+/g, "-")}` : ""}.png`;
    await page.screenshot({ path: file, fullPage });
    results.push({ vp: vp.name, file, title: await page.title() });

    // Cheap inline checks while the browser is already open.
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return { scrollW: d.scrollWidth, clientW: d.clientWidth };
    });
    const hScroll = overflow.scrollW > overflow.clientW + 1;

    console.log(`${vp.name.padEnd(9)} ${String(vp.width).padStart(4)}px  ${file}${hScroll ? "  ← horizontal overflow" : ""}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\nLook at these before calling the work done.`);
  if (results.some((r) => r.title === "")) console.log("Empty page title — check the route loaded.");
  process.exit(strict ? 0 : 0);
}

const buBin = await which("browser-use");
if (buBin) {
  console.log(`Using ${buBin}\n`);
  let ok = 0;

  for (const vp of viewports) {
    const r = await runBrowserUse(buBin, vp);
    if (!r.ok) {
      console.error(`${vp.name}: ${r.reason}`);
      continue;
    }
    const file = `${outDir}/${vp.name}${isDark ? "-dark" : ""}.png`;
    await writeFile(file, Buffer.from(r.base64, "base64"));
    console.log(`${vp.name.padEnd(9)} ${String(vp.width).padStart(4)}px  ${file}`);
    ok++;
  }

  if (ok === 0) {
    console.error(`\nbrowser-use produced no screenshots. Check: browser-use --doctor`);
    process.exit(strict ? 1 : 0);
  }
  console.log(`\nNote: browser-use keeps one attached tab. Sizes come from the window, not a forced viewport.`);
  process.exit(0);
}

// ---- 3. Nothing available ----------------------------------------------

console.log(`
No screenshot backend found.

Either install Playwright in this project:

  npm i -D playwright && npx playwright install chromium

or install the browser-use CLI (already a skill in this setup):

  uv tool install browser-use

Manual recipe while the app is running:

  open http://localhost:5173
  devtools → device toolbar → capture at 375 / 1280 / 1680
  or Ctrl+Shift+P → "Screenshot: Capture visible area"
`);

try {
  await access("http://localhost:5173");
  console.log("Something is already serving on :5173 — open it and use the device toolbar.");
} catch {
  /* nothing there */
}
