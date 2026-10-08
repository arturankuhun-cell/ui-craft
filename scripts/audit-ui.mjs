#!/usr/bin/env node
/**
 * audit-ui.mjs — static audit for interface code.
 *
 * Finds the failures that are invisible in a screenshot: hardcoded colors,
 * magic numbers, specificity hazards, missing focus states, and the a11y
 * smells that show up as inaccessible markup.
 *
 *   node audit-ui.mjs src/
 *   node audit-ui.mjs src/ --json
 *   node audit-ui.mjs src/ --strict     # warnings become errors
 *
 * No dependencies. Exit code 1 if any error-severity finding is reported.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const SCAN_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".scss", ".html", ".vue", ".svelte"]);

const RULES = [
  // ---- color ------------------------------------------------------------
  {
    id: "color/hardcoded-hex",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx", ".vue", ".svelte"],
    test: /#[0-9a-fA-F]{3,8}\b/g,
    except: /#(?:fff|000|FFF|000000|FFFFFF)\b(?![0-9a-fA-F])/g,
    match: true,
    message: "Raw hex color. Use a semantic token so re-theming works.",
    hint: "Replace with var(--color-*) from the token layer.",
  },
  {
    id: "color/hardcoded-rgb",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx"],
    test: /\brgba?\(\s*\d+/g,
    message: "Raw rgb()/rgba() color. Use a token.",
  },
  {
    id: "color/inline-style-color",
    severity: "warn",
    ext: [".tsx", ".jsx", ".vue", ".svelte"],
    test: /style=\{\{[^}]*(?:color|background)[^}]*\}\}/g,
    message: "Inline style color. Hard to theme, hard to override.",
  },

  // ---- architecture -----------------------------------------------------
  {
    id: "css/important",
    severity: "error",
    ext: [".css", ".scss"],
    test: /!important/g,
    message: "!important. An admission that a selector was too greedy.",
    hint: "Fix the specificity instead.",
  },
  {
    id: "css/transition-all",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx"],
    test: /transition(-property)?\s*:\s*all\b/gi,
    message: "transition: all also animates layout properties. Name them explicitly.",
    hint: "transition: transform 200ms, opacity 200ms;",
  },
  {
    id: "css/important-animatable",
    severity: "warn",
    ext: [".css", ".scss"],
    test: /transition[^;]*\b(width|height|top|left|right|bottom|margin|padding)\s/gi,
    message: "Transitioning a layout property causes jank. Use transform instead.",
    hint: "translateX/translateY/scale instead of left/width/etc.",
  },
  {
    id: "css/selector-descendant",
    severity: "info",
    ext: [".css", ".scss"],
    test: /^\s*\.[a-z][\w-]*\s+[a-z][\w-]*[\s>+~]/gi,
    message: "Descendant/child selector couples styles to DOM structure.",
    hint: "Prefer a single class (BEM-ish) so markup can be refactored freely.",
  },
  {
    id: "css/zindex-spaghetti",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx"],
    test: /z-index\s*:\s*(\d{4,})/g,
    message: "Four-digit z-index. Use the named layer scale.",
    hint: "--z-base/sticky/dropdown/overlay/modal/toast/tooltip",
  },

  // ---- accessibility ----------------------------------------------------
  {
    id: "a11y/outline-none",
    severity: "error",
    ext: [".css", ".scss"],
    test: /outline\s*:\s*(none|0)\s*;?/gi,
    message: "outline removed. Keyboard users lose all position feedback.",
    hint: "Replace with :focus-visible { outline: 2px solid var(--color-ring); }",
    unlessNearFocus: true,
  },
  {
    id: "a11y/img-no-alt",
    severity: "error",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /<img\b[^>]*>/gi,
    validator: (tag) => !/\balt\s*=/.test(tag),
    message: "<img> without alt. Add alt, or alt=\"\" if purely decorative.",
  },
  {
    id: "a11y/click-div",
    severity: "error",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /<(div|span|li|td|p|section)\b[^>]*onClick[^>]*>/gi,
    validator: (tag) =>
      !/\brole\s*=/.test(tag) && !/\btabIndex\s*=/.test(tag) && !/\bbutton\b/.test(tag),
    message: "Click handler on a non-interactive element. Not keyboard reachable.",
    hint: "Use <button>, or add role + tabIndex + key handler.",
  },
  {
    id: "a11y/placeholder-as-label",
    severity: "warn",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /<input\b[^>]*\bplaceholder\s*=[^>]*>/gi,
    validator: (tag) => !/id\s*=/.test(tag) || !/aria-label/.test(tag),
    message: "Input with a placeholder and no label association.",
    hint: "Placeholders vanish on focus. Add <label for>.",
  },
  {
    id: "a11y/button-no-type",
    severity: "warn",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /<button\b(?![^>]*\btype\s*=)[^>]*>/gi,
    message: "<button> without explicit type. Defaults to submit inside a form.",
    hint: "<button type=\"button\">",
  },
  {
    id: "a11y/emoji-icon",
    severity: "info",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
    message: "Emoji used as an icon. Renders differently per OS and scales badly.",
  },
  {
    id: "a11y/aria-hidden-focusable",
    severity: "warn",
    ext: [".tsx", ".jsx", ".html", ".vue", ".svelte"],
    test: /<[^>]*(tabIndex=\{?0\}?|href=)[^>]*aria-hidden[^>]*>/gi,
    message: "Focusable element marked aria-hidden. Screen reader user can focus nothing.",
  },
  {
    id: "a11y/svg-not-hidden",
    severity: "info",
    ext: [".tsx", ".jsx"],
    test: /<svg\b[^>]*>/gi,
    validator: (tag) => !/aria-hidden/.test(tag) && !/aria-label/.test(tag) && !/role\s*=\s*"img"/.test(tag),
    message: "<svg> without aria-hidden or a label. Usually decorative and should be hidden.",
  },

  // ---- responsiveness / layout -----------------------------------------
  {
    id: "layout/fixed-height-text",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx"],
    test: /\bheight\s*:\s*\d+(px|rem|vh)\s*;?/gi,
    message: "Fixed height. Content that runs longer will clip or overflow.",
    hint: "Use min-height when the element contains text.",
    unlessContainsWord: /width/,
  },
  {
    id: "layout/small-font",
    severity: "warn",
    ext: [".css", ".scss", ".tsx", ".jsx"],
    test: /font-size\s*:\s*(?:[0-9]|1[0-5])px/gi,
    message: "Font under 16px. iOS zooms on focus and desktop users strain.",
    hint: "16px minimum for anything readable; 12-14px only for metadata.",
  },
  {
    id: "layout/tiny-touch-target",
    severity: "warn",
    ext: [".css", ".scss"],
    test: /(?:width|height|min-width|min-height)\s*:\s*(?:[1-3]?\d)px\s*;/g,
    message: "Possible sub-44px touch target.",
    hint: "Interactive elements need a 44x44px hit area, even with a smaller visual size.",
  },
  {
    id: "layout/magic-number",
    severity: "info",
    ext: [".css", ".scss"],
    test: /(?<![\w-])(?:margin|padding|gap)\s*:\s*(\d+)px/gi,
    message: "Magic pixel value in spacing. Use the spacing scale.",
    hint: "4 / 8 / 12 / 16 / 24 / 32 / 48 / 64",
  },
];

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".git", ".next", "coverage", "target"].includes(entry.name)) continue;
      yield* walk(full);
    } else if (SCAN_EXT.has(extname(entry.name))) {
      yield full;
    }
  }
}

function applyUnlessNearFocus(text, index) {
  const window = text.slice(Math.max(0, index - 400), index + 400);
  return /:focus|:focus-visible|focus-visible/.test(window);
}

function applyUnlessWidth(text, index) {
  const window = text.slice(Math.max(0, index - 60), index + 60);
  return /width/.test(window);
}

const findings = [];
let filesScanned = 0;
let linesScanned = 0;

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const asJson = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

if (roots.length === 0) roots.push("src");

for (const root of roots) {
  try {
    const s = await stat(root);
    if (s.isFile()) {
      const content = await readFile(root, "utf8");
      filesScanned++;
      linesScanned += content.split("\n").length;
      scanFile(root, content, findings);
    }
  } catch {
    // not a file; walk it
  }
  for await (const file of walk(root)) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    filesScanned++;
    linesScanned += content.split("\n").length;
    scanFile(file, content, findings);
  }
}

function scanFile(file, text, out) {
  for (const rule of RULES) {
    const ext = extname(file);
    if (rule.ext && !rule.ext.includes(ext)) continue;

    const re = new RegExp(rule.test.source, rule.test.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      if (rule.unlessNearFocus && applyUnlessNearFocus(text, m.index)) continue;
      if (rule.unlessContainsWord === /width/ && applyUnlessWidth(text, m.index)) continue;
      if (rule.validator && !rule.validator(m[0])) continue;
      if (rule.except && rule.except.test(m[0])) {
        rule.except.lastIndex = 0;
        continue;
      }

      const before = text.slice(0, m.index);
      const line = before.split("\n").length;
      const lineText = text.split("\n")[line - 1]?.trim().slice(0, 120) ?? "";

      out.push({
        rule: rule.id,
        severity: rule.severity,
        file,
        line,
        match: m[0].slice(0, 80),
        message: rule.message,
        hint: rule.hint,
        code: lineText,
      });

      if (m[0].length === 0) re.lastIndex++;
    }
  }
}

const errors = findings.filter((f) => f.severity === "error").length;
const warns = findings.filter((f) => f.severity === "warn").length;
const infos = findings.filter((f) => f.severity === "info").length;

const FAILING = strict ? errors + warns : errors;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        filesScanned,
        linesScanned,
        summary: { error: errors, warn: warns, info: infos },
        findings: findings.sort(
          (a, b) =>
            SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line
        ),
      },
      null,
      2
    )
  );
} else {
  const G = { r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[34m", d: "\x1b[2m", x: "\x1b[0m", bold: "\x1b[1m" };
  console.log(`\n${G.bold}ui-craft audit${G.x}  ${G.d}${filesScanned} files, ${linesScanned} lines${G.x}\n`);

  if (findings.length === 0) {
    console.log(`${G.r}No findings.${G.x} That is unusual — check that the path is right.\n`);
  } else {
    let currentFile = null;
    for (const f of findings.sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.file.localeCompare(b.file) || a.line - b.line
    )) {
      if (f.file !== currentFile) {
        currentFile = f.file;
        console.log(`${G.b}${currentFile}${G.x}`);
      }
      const color = f.severity === "error" ? G.r : f.severity === "warn" ? G.y : G.d;
      const tag = f.severity === "error" ? "ERR " : f.severity === "warn" ? "WARN" : "info";
      console.log(`  ${color}${tag}${G.x} ${G.d}${String(f.line).padStart(4)}${G.x}  ${f.rule}`);
      console.log(`       ${f.message}`);
      if (f.hint) console.log(`       ${G.d}${f.hint}${G.x}`);
      if (process.env.VERBOSE) console.log(`       ${G.d}${f.code}${G.x}`);
    }
  }

  console.log(
    `\n${errors ? G.r : G.x}${errors} error${G.x}  ${warns ? G.y : G.x}${warns} warning${G.x}  ${G.d}${infos} info${G.x}\n`
  );
  if (FAILING > 0) {
    console.log(`${G.d}Errors are the ones worth fixing before shipping. Warnings are worth a look.${G.x}\n`);
  }
}

process.exit(FAILING > 0 ? 1 : 0);
