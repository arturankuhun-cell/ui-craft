# ui-craft

Write interface code that holds up. Correct semantics, disciplined CSS architecture, real accessibility, verified visually. Not "make it look nice" — a workflow where every rule has a corresponding check.

Interface code fails in two directions, and both are expensive.

**Downward** — broken layouts, unreachable controls, contrast violations, layout shift, re-renders on every keystroke.

**Sideways** — everything technically correct and instantly forgettable. The purple gradient on a rounded card with the shadow underneath.

Most advice pushes hard in one direction. Design skills tell you to be distinctive and hand you no way to verify the result. Performance guides hand you a spinner and call it taste. This skill is built around the idea that **the reason designs converge is that nobody verifies them.**

## What it is

A skill for coding agents. It loads when you're building or changing UI: components, pages, layouts, Tailwind or CSS styling, design tokens, color and typography, dark mode, motion and transitions, forms, dialogs, tables, responsive behavior, visual QA. Also when copying or matching an existing design, when a UI looks generic or templated, when fixing layout/spacing/overflow bugs, or when auditing for accessibility and contrast.

One `SKILL.md` plus seven reference files and three dependency-free CLI scripts. MIT.

## The workflow

Six phases. The order matters less than the fact that verification is not optional and cannot be skipped.

```
0  Read the room      existing tokens, patterns, stack — before writing anything
1  Direction          a decision, stated in one short plan
2  Architecture       components, state ownership, data flow
3  Build              tokens → semantics → styles → motion
4  Verify             run it, look at it, measure it, fix it
5  Critique           remove one thing, write down what you tried
```

### 0. Read the room

Six questions answered from the codebase, not from memory: what styling system, where the tokens live, what a sibling component looks like, how fonts load, which state library, what density the existing screens use. Tailwind v3 config and v4 `@theme` are incompatible, and writing `#3b82f6` where `--color-primary` already exists is the single most common way a codebase decays. Conventions beat preferences.

### 1. Direction

Four decisions with values, so they're arguable. Not a mood board.

- **Subject** — what is this, for whom, what is the one job of this screen
- **Tokens** — 4–6 named colors with hex, one or two typefaces with roles, a spacing tier, a motion tier
- **Composition** — one ASCII wireframe. Where does the eye go first, second, third
- **The bet** — the one thing that makes this not-generic. One element, one idea

**Spend the boldness once.** A memorable hero with disciplined everything else reads as confident. The same energy everywhere reads as an unfinished mood board. Pick one of layout, type, color, or motion to be unusual and hold the other three at a neutral standard. If the plan contains no hex and no number, it isn't a decision yet.

### 2. Architecture

Component boundaries decided before the files grow.

**Split when** a component owns state only it needs, a sub-part is reused elsewhere, a function exceeds ~80 lines of mixed concerns, or the same className string appears in three files. **Don't split when** the parts can't be described independently, you'd need props for every visual variation, or the piece is 10 lines of markup. A `Card` with a `variant` prop beats three near-identical card components.

State ownership has a shortest correct answer: server data in the server cache, shared client state in a store, component state in `useState` at the owner, derived values computed during render. The commonest architectural mistake is pushing derived values into a store — it creates sync bugs, stale values, and double renders for free.

### 3. Build

Order matters: tokens, then semantics, then style, then motion. Building motion before the layout is stable means animating a wrong thing.

**Semantics before styling.** This is the layer that's expensive to retrofit, because a div with an onClick handler cannot be made accessible later without rewriting it.

| Need | Use | Not |
|---|---|---|
| Perform an action | `<button type="button">` | `<div onClick>` |
| Go somewhere | `<a href>` | `<span onClick>` |
| Toggle on/off | `<button aria-pressed>`, `<input type="checkbox">` | styled div |
| Choose one of many | `<select>`, radio group in `<fieldset>` | custom dropdown over a div |
| Expand a region | `<button aria-expanded aria-controls>` | icon-only div |
| Show extra info on hover | also reachable by focus | `title` alone |
| Data table | `<table>` + `<th scope>` | div grid with ARIA roles bolted on |
| Label an input | `<label for>` | placeholder as the label |

**CSS architecture.** Almost every "the styles are broken" problem is a specificity accident — two classes on one element, one written later, both silently fighting. One class per element. Never `!important` as a tiebreaker; fix the selector. Descendant selectors couple you to structure, so prefer `.card__title` over `.card > .card-header > h3`. Scope by data attribute or wrapper class, not by page id. If you write raw CSS, layer order is `@layer reset, tokens, base, layout, components, utilities, overrides` — overrides last is what makes them intentional rather than a symptom. Container queries beat viewport media queries for components: a card in a 300px sidebar and the same card full-width need different layouts, and viewport width can't tell the difference.

**Typography.** 16px minimum body (below that iOS zooms on focus), 60–75ch measure with a hard cap near 80ch, line-height 1.5 sans and 1.6 serif because serif needs more air for stroke contrast, 1.1–1.25 for headings, −0.02 to −0.045em tracking on display type and 0 in body text, +0.06em on labels, scale ratio 1.2–1.25, one family or two that are clearly different. Optical alignment beats mathematical: a circle hangs slightly lower than a square to look level, and a heading's left edge on an `H` sits inside its box. When something looks misaligned and the math is right, it isn't.

**Color.** Color carries meaning before decoration. Seven roles with an explicit failure mode each: background, surface, text primary, text secondary (the most common WCAG violation in "designed" UIs), border, accent (one thing per screen), semantic (hue-only encoding loses colorblind users entirely). Contrast floors are non-negotiable — 4.5:1 for body text, 3:1 for large text, borders, icons, focus rings and chart marks.

**Dark mode is not an inversion.** Invert luminance and every saturated color vibrates against its complement — the glow that makes cheap interfaces look cheap. Keep hue, shift lightness, reduce chroma on large surfaces. Text isn't pure white: `#e6edf3` on `#0d1117` reads cleaner than `#ffffff` on `#000000`. Derive the dark palette from the brand hue rather than picking fresh colors. Elevation comes from lightness, not shadow, because shadows are nearly invisible on dark backgrounds.

**Layout and density.** Five spacing tiers from micro (2–6px) to macro (64–96px+). Density is a decision, not an accident — a trading terminal and a marketing site use the same tokens and pick different tiers. Rules that survive real content: design for the worst case first, `min-width: 0` on flex children (the single most common responsive bug), break at the content's natural seams rather than device widths, test at 320px not 375px, and treat fixed heights on text containers as a bug waiting for the user's longer string.

**Motion.** Motion explains state changes; if it doesn't, it's noise. Durations from 80–120ms for press feedback to 300–500ms for route transitions. Animate `transform` and `opacity` — the only properties the compositor handles without layout and paint. Enter and exit must be symmetric or the element reads as a glitch. One orchestrated entrance beats a stagger on everything. Respect `prefers-reduced-motion`, not as a checkbox but as the reason large parallax is questionable in the first place.

**Text that ships.** Interface copy is design content, written during the build. Name things by what the user understands, not how the system is built. Buttons say what happens. Errors explain and fix — "Enter a date after today", not "Invalid input", with no apology and no stack trace. Empty states are invitations. One idea per element.

### 4. Verify

The phase that makes the skill worth having. Five checks; the first two take seconds and catch most problems.

- **Static audit** — catches what's invisible in a screenshot
- **Contrast** — every token pair you rely on, both themes
- **Visual** — a screenshot is worth a thousand tokens of speculation. Then actually look: is the reading order what you intended, does anything clip or overlap, is the accent used once, does the whitespace read as intentional, does mobile hold
- **Keyboard** — Tab the whole flow. Every interactive element reachable, focus ring visible on every one, modals trap focus and close on Escape, logical order matching visual order. Then use it: Space toggles, Enter submits, arrows move within a group
- **Performance** — jank on scroll means you're animating layout properties; laggy input means whole-tree re-render per keystroke; a stuttering list past ~200 rows wants virtualization; hydration warnings come from `Date.now()` in render; layout shift comes from images without dimensions

### 5. Critique

Before handing off, apply Chanel's rule: **remove one accessory.** The thing you added last, the one you liked most, is usually the one to cut. Then write two lines:

```
Tried: <the bet, and whether it landed>
Remove next time: <the accessory>
```

That note is what stops every project from converging on the same look.

## The generic tell

Generated work clusters hard. These are defaults, not forbidden — a brief may explicitly ask for one, and the brief's words always win. But when the brief leaves an axis free, spending that freedom on a default is the failure.

| Tell | Why it reads as generated | Do instead |
|---|---|---|
| Cream `#F4F1EA` + high-contrast serif + terracotta `#D97757` | the signature Claude aesthetic; appears on every brief | pick from the subject's actual world |
| Near-black + one acid-green or vermilion accent | the other default cluster | constrain saturation across the palette |
| Hairline rules, zero radius, dense columns | reads as "editorial" regardless of subject | radius or rules, not both, unless earned |
| Identical rounded cards, one shadow, gradient washes | the SaaS card kit; groups nothing | group by meaning; cards only for genuinely separable units |
| ALL-CAPS tracked eyebrow above every heading | appears whatever the subject is | use the eyebrow only when it classifies |
| `·` between meta strings | template chrome | plain commas, or drop the metadata |
| `—` in every label | same | em dash only where the pause is real |
| Tinted near-black `#0B0B0B` standing in for black | looks designed, reads muddy | a real dark tone with hue in it, chosen deliberately |
| `→` appended to every link | suggests navigation that isn't there | arrow only on actual navigation |
| One word in a different color in a headline | emphasizing without hierarchy | if it matters, it gets its own line |
| Fade-and-slide-up on every section | motion as decoration | one orchestrated entrance, then stillness |
| Full-width gradient hero with centered subhead | the universal landing header | lead with the most characteristic thing in the subject |
| Emoji as a structural icon | renders differently on every OS | an icon set with one stroke weight |

## Scripts

Three dependency-free Node CLIs.

```bash
# static audit
node scripts/audit-ui.mjs src/
node scripts/audit-ui.mjs src/ --json
node scripts/audit-ui.mjs src/ --strict          # warnings become errors

# contrast
node scripts/contrast.mjs "#1e293b" "#ffffff"
node scripts/contrast.mjs "#1f2328" "#ffffff" --large --aaa
node scripts/contrast.mjs --from src/styles/tokens.css

# screenshots
node scripts/shot.mjs http://localhost:5173 --out .ui-qa
node scripts/shot.mjs http://localhost:5173 --path /settings --viewports mobile,desktop
node scripts/shot.mjs http://localhost:5173 --full
```

**audit-ui.mjs** — finds the failures that are invisible in a screenshot: hardcoded colors, magic numbers, specificity hazards, missing focus states, a11y smells in inaccessible markup. Scans `.tsx .jsx .ts .js .css .scss .html .vue .svelte`. Exit code 1 on any error-severity finding.

**contrast.mjs** — WCAG 2.x contrast for arbitrary pairs or every token pair in a CSS file. Uses the 0.04045 sRGB breakpoint, not the 0.03928 value from WCAG 1.x that still circulates in copy-pasted snippets. Exit code 1 if any pair fails.

**shot.mjs** — screenshots a running app so you can actually look at it. Strategy in order: Playwright if it resolves from the project, then browser-use if the CLI is on PATH (no npm install), otherwise it prints a copy-paste recipe. Always exits 0 unless `--strict`, because a missing screenshot tool is not a failure of the code being audited.

## References

Loaded on demand, so the file you don't need costs you nothing.

| Topic | File |
|---|---|
| Type scales, pairing heuristics, optical alignment | `references/typography.md` |
| Color systems, dark mode, contrast math | `references/color.md` |
| Spacing, breakpoints, container queries, density | `references/layout.md` |
| Durations, easings, reduced motion, gesture feel | `references/motion.md` |
| ARIA, keyboard contracts, screen readers, focus | `references/a11y.md` |
| React rendering, memoization, lists, bundle | `references/react-perf.md` |
| Component patterns with real markup | `references/patterns.md` |

## Install

```bash
git clone https://github.com/<arturankuhun-cell>/ui-craft
mkdir -p .opencode/skills
cp -r ui-craft .opencode/skills/
```

Works with opencode, Claude Code, and anything else that reads `SKILL.md` frontmatter. Requires Node 18+ for the scripts.

## Related skills

This one is about code. When the task is mainly not code, hand off:

| Task | Go to |
|---|---|
| Palette/font/style direction from a curated corpus | `ui-ux-pro-max` |
| Token architecture, three-layer tokens, deck generation | `design-system` |
| Logo, brand deliverables, banners, social images | `design` / `brand` |
| Aesthetic calibration for a landing page | `frontend-design` |
| Seeing and interacting with the rendered page | `browser-use` |

It also borrows deliberately from `taste-skill`'s three dials (now `--variance` / `--motion` / `--density` in `ui-ux-pro-max`): a high-variance project wants asymmetry, a high-density one wants tighter spacing, a low-motion one wants stillness.

## License

MIT
