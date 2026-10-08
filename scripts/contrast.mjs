#!/usr/bin/env node
/**
 * contrast.mjs — WCAG 2.x contrast checking.
 *
 *   node contrast.mjs "#1f2328" "#ffffff"
 *   node contrast.mjs "#1f2328" "#ffffff" --large --aaa
 *   node contrast.mjs --from src/styles/tokens.css
 *
 * Implementation follows WCAG 2.x: the sRGB breakpoint is 0.04045, not the
 * 0.03928 value from WCAG 1.x that still circulates in copy-pasted snippets.
 *
 * Exit code 1 if any checked pair fails.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const wantsAaa = flags.has("--aaa");
const isLarge = flags.has("--large");

const C = {
  r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", d: "\x1b[2m",
  x: "\x1b[0m", b: "\x1b[1m", bold: "\x1b[1m",
};
const mark = (ok) => (ok ? `${C.g}PASS${C.x}` : `${C.r}FAIL${C.x}`);
const short = (n) => n.replace(/^--(color-)?/, "").replace(/-/g, " ");

// ---- color parsing ------------------------------------------------------

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));

function fromHex(h) {
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp, gp, bp;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [clamp255((rp + m) * 255), clamp255((gp + m) * 255), clamp255((bp + m) * 255)];
}

function parseColor(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();

  const hex = s.match(/^#?([0-9a-f]{3,8})$/);
  if (hex) return fromHex(hex[1]);

  const rgb = s.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/
  );
  if (rgb) {
    return {
      r: clamp255(parseFloat(rgb[1])),
      g: clamp255(parseFloat(rgb[2])),
      b: clamp255(parseFloat(rgb[3])),
      a: alpha(rgb[4]),
    };
  }

  const hsl = s.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.%]+))?\s*\)$/
  );
  if (hsl) {
    const [r, g, b] = hslToRgb(parseFloat(hsl[1]), parseFloat(hsl[2]) / 100, parseFloat(hsl[3]) / 100);
    return { r, g, b, a: alpha(hsl[4]) };
  }

  return null;
}

function alpha(v) {
  if (v === undefined) return 1;
  return v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
}

function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1,
  };
}

// ---- WCAG ---------------------------------------------------------------

function luminance(c) {
  const ch = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_BODY = 4.5;
const AA_LARGE = 3.0;
const AAA_BODY = 7.0;
const AAA_LARGE = 4.5;

const hex = (c) =>
  "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("") + (c.a < 1 ? ` (a ${c.a.toFixed(2)})` : "");

const targetFor = () =>
  wantsAaa ? (isLarge ? AAA_LARGE : AAA_BODY) : isLarge ? AA_LARGE : AA_BODY;

let failures = 0;

// ---- mode: explicit pair ------------------------------------------------

function reportPair(fgRaw, bgRaw) {
  const fg = parseColor(fgRaw);
  const bg = parseColor(bgRaw);
  if (!fg) {
    console.error(`${C.r}Could not parse foreground:${C.x} ${fgRaw}`);
    process.exitCode = 2;
    return;
  }
  if (!bg) {
    console.error(`${C.r}Could not parse background:${C.x} ${bgRaw}`);
    process.exitCode = 2;
    return;
  }

  if (bg.a < 1) {
    console.log(
      `${C.y}Note:${C.x} background is translucent (a ${bg.a.toFixed(2)}), composited over white. ` +
        `Re-run with the real backdrop for an accurate result.\n`
    );
  }

  const backdrop = bg.a < 1 ? { ...bg, r: 255, g: 255, b: 255, a: 1 } : bg;
  const eff = composite(fg, backdrop);
  const r = ratio(eff, backdrop);

  const target = targetFor();
  const passes = r >= target;
  if (!passes) failures++;

  const label = `${isLarge ? "large text" : "normal text"}, ${wantsAaa ? "AAA" : "AA"}`;

  console.log(
    `${hex(eff)} on ${hex(backdrop)}   ${C.bold}${r.toFixed(2)}:1${C.x}   ` +
      `${passes ? C.g : C.r}${passes ? "PASS" : "FAIL"}${C.x}  (needs ${target}:1, ${label})`
  );

  const checks = [
    ["AA body", r >= AA_BODY, "4.5"],
    ["AA large", r >= AA_LARGE, "3.0"],
    ["UI / non-text", r >= 3.0, "3.0"],
    ["AAA body", r >= AAA_BODY, "7.0"],
  ];
  console.log("  " + checks.map(([n, ok, need]) => `${n} ${mark(ok)}`).join("   ") + C.d + "  (UI and non-text always need 3:1)" + C.x);
}

// ---- mode: from a token file -------------------------------------------
//
// A flat token map would silently merge :root with [data-theme="dark"] and
// produce nonsense, so blocks are parsed separately and each theme is
// resolved against its own base.

function splitBlocks(css) {
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    const body = m[2];
    if (!selector || selector.startsWith("@")) continue;
    const tokens = new Map();
    const tr = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let t;
    while ((t = tr.exec(body)) !== null) tokens.set(t[1], t[2].trim());
    if (tokens.size) blocks.push({ selector, tokens });
  }
  return blocks;
}

function resolveColors(tokens) {
  const memo = new Map();
  const resolve = (name, depth = 0) => {
    if (depth > 12) return null;
    if (memo.has(name)) return memo.get(name);
    memo.set(name, null);
    const raw = tokens.get(name);
    if (!raw) return null;
    const ref = raw.match(/var\(\s*(--[a-zA-Z0-9-]+)/);
    if (ref) {
      const out = resolve(ref[1], depth + 1);
      memo.set(name, out);
      return out;
    }
    const c = parseColor(raw);
    memo.set(name, c);
    return c;
  };

  const out = new Map();
  for (const k of tokens.keys()) {
    const c = resolve(k);
    if (c && c.a >= 1) out.set(k, c);
  }
  return out;
}

function reportFromFile(path) {
  const css = readFileSync(path);
  const blocks = splitBlocks(css);

  if (blocks.length === 0) {
    console.log(`${C.y}No token blocks found in ${path}.${C.x}`);
    return;
  }

  const base = blocks.find((b) => b.selector === ":root") ?? blocks[0];
  const baseColors = resolveColors(base.tokens);

  const target = targetFor();
  const label = `${isLarge ? "large text" : "normal text"}, ${wantsAaa ? "AAA" : "AA"}`;
  const isDarkGuess = (s) => /dark|night/i.test(s);

  console.log(`\n${C.bold}Contrast report${C.x} ${C.d}${path}${C.x}`);
  console.log(`${C.d}needs ${target}:1 (${label})   ·   UI borders, icons, focus rings: 3:1${C.x}\n`);

  const sections = blocks.filter((b) => b.selector !== base.selector);

  for (const scope of [base, ...sections]) {
    const tokens = new Map([...base.tokens, ...scope.tokens]);
    const colors = resolveColors(tokens);

    const textish = [...colors.keys()].filter((k) => /text|fg|foreground/i.test(k));
    const surfacish = [...colors.keys()].filter((k) => /bg|background|surface|canvas/i.test(k));

    if (textish.length === 0 || surfacish.length === 0) {
      if (scope !== base) {
        console.log(`${C.d}${scope.selector} — skipped (no text/surface tokens)${C.x}\n`);
      }
      continue;
    }

    const tag = isDarkGuess(scope.selector) ? `${C.b}dark${C.x}` : scope.selector;
    console.log(`${tag} ${C.d}(${colors.size} colors)${C.x}`);

    const colW = 11;
    const nameW = Math.max(...textish.map(short).map((s) => s.length), 12);
    console.log("  " + " ".repeat(nameW) + "  " + surfacish.map((s) => short(s).slice(0, colW - 1).padEnd(colW)).join(""));

    const failing = [];
    for (const t of textish) {
      const fg = colors.get(t);
      const cells = ["  " + short(t).padEnd(nameW)];
      for (const s of surfacish) {
        const r = ratio(fg, colors.get(s));
        const ok = r >= target;
        if (!ok) {
          failures++;
          failing.push(`    ${C.r}${short(t)} on ${short(s)} — ${r.toFixed(2)}:1${C.x}`);
        }
        const text = `${r.toFixed(2)}${ok ? "" : "!"}`;
        cells.push(ok ? `${C.d}${text.padEnd(colW)}${C.x}` : `${C.r}${text.padEnd(colW)}${C.x}`);
      }
      console.log(cells.join("  "));
    }

    if (failing.length) {
      console.log(`  ${C.r}${failing.length} failing pair(s)${C.x}`);
      console.log(failing.join("\n"));
    } else {
      console.log(`  ${C.g}all pairs pass${C.x}`);
    }
    console.log("");
  }

  const lightNames = new Set(resolveColors(base.tokens).keys());
  for (const scope of sections) {
    const darkOnly = [...scope.tokens.keys()].filter((k) => !lightNames.has(k));
    if (darkOnly.length === 0) continue;
    console.log(
      `${C.y}Tokens only defined in ${scope.selector}, absent from ${base.selector}:${C.x} ` +
        `${C.d}${darkOnly.map(short).join(", ")}${C.x}`
    );
    console.log(`${C.d}  Usually intentional for theme overrides. Flag it if it should be in both.${C.x}\n`);
  }
}

// ---- dispatch -----------------------------------------------------------

if (flags.has("--from")) {
  const path = positional[0];
  if (!path) {
    console.error("Usage: contrast.mjs --from <file.css>");
    process.exit(2);
  }
  try {
    reportFromFile(path);
  } catch (e) {
    console.error(`${C.r}${e.message}${C.x}`);
    process.exit(2);
  }
} else if (positional.length >= 2) {
  reportPair(positional[0], positional[1]);
} else {
  console.log(`
${C.bold}contrast.mjs${C.x} — WCAG 2.x contrast

  ${C.b}node contrast.mjs${C.x} "#1f2328" "#ffffff"
  ${C.b}node contrast.mjs${C.x} "#1f2328" "#ffffff" --large
  ${C.b}node contrast.mjs${C.x} "#1f2328" "#ffffff" --aaa
  ${C.b}node contrast.mjs${C.x} --from src/styles/tokens.css

Accepts hex, rgb(), rgba(), hsl(), hsla().
Token mode parses each selector block separately, so :root and
[data-theme="dark"] are checked against their own values.
Exit code 1 if any checked pair fails.
`);
  process.exit(positional.length === 0 ? 0 : 2);
}

process.exit(failures > 0 ? 1 : 0);
