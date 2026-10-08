---
name: ui-craft
description: "Write interface code that holds up — correct semantics, disciplined CSS architecture, real accessibility, verified visually. Use whenever building or changing UI: components, pages, layouts, Tailwind or CSS styling, design tokens, color and typography, dark mode, motion and transitions, forms, dialogs, tables, responsive behavior, or visual QA. Also use when copying or matching an existing design, when a UI looks generic or templated, when fixing layout/spacing/overflow bugs, when auditing an interface for accessibility or contrast, or when the user mentions UI, UX, component, layout, style, theme, pixel-perfect, or 'make it look good'. Prefer this over other design skills for actual code work; it complements the retrieval and brand skills rather than replacing them."
argument-hint: "[component | page | audit | 'fix contrast']"
license: MIT
metadata:
  author: local
  version: "1.0.0"
---

# ui-craft

Interface code fails in two directions, and both are expensive. It fails *downward* — broken layouts, unreachable controls, contrast violations, layout shift, re-renders on every keystroke. It fails *sideways* — everything technically correct and instantly forgettable, the purple gradient on a rounded card with the shadow underneath.

Most advice pushes hard in one direction. Design-skills tell you to be distinctive and hand you no way to check the result. Performance guides hand you a spinner and call it taste. This skill is built around the idea that **the reason designs converge is that nobody verifies them.** Every rule here has a corresponding check.

## The workflow

Five phases. The order matters less than the fact that verification is not optional and cannot be skipped.

```
0  Read the room      existing tokens, patterns, stack — before writing anything
1  Direction          a decision, stated in one short plan
2  Architecture       components, state ownership, data flow
3  Build              tokens → semantics → styles → motion
4  Verify             run it, look at it, measure it, fix it
5  Critique           remove one thing, write down what you tried
```

### 0. Read the room

Before writing any markup, answer these from the codebase, not from memory:

| Question | Where to look | Why it matters |
|---|---|---|
| What styling system? | `package.json` deps, CSS entry | Tailwind v3 config vs v4 `@theme` are incompatible; CSS Modules, vanilla-extract, styled-components all change the answer |
| Where do tokens live? | `:root` block, `tailwind.config`, `@theme` | Writing `#3b82f6` where `--color-primary` exists is the single most common way to make a codebase decay |
| What does a sibling component look like? | nearest analogous file | Conventions beat your preferences. Match the house style even when you'd choose differently |
| How are fonts loaded? | `index.html` link, `@font-face`, `next/font` | Determines whether you can rely on `font-display: swap` and preload |
| What state library? | deps + store files | Decides where interaction state lives before you start |
| What is the density? | any existing screen | Dense data app and marketing page want different spacing tiers; infer before choosing |

Also run the audit script — it tells you where the codebase is already in trouble, so you don't add to it:

```bash
node .opencode/skills/ui-craft/scripts/audit-ui.mjs src/
```

### 1. Direction

One short plan before code. Not a mood board — four decisions with values, so they're arguable.

- **Subject**: what is this, for whom, and what is the one job of this screen? If the brief doesn't say, infer and say the inference out loud.
- **Tokens**: 4–6 named colors with hex, one or two typefaces with roles, a spacing tier, a motion tier.
- **Composition**: one ASCII wireframe. Where does the eye go first, second, third?
- **The bet**: the one thing that makes this not-generic. One element, one idea.

**Spend the boldness once.** A memorable hero and disciplined everything else reads as confident. The same energy everywhere reads as an unfinished mood board. Concretely: pick one of the layout, the type, the color, or the motion to be unusual, and hold the other three at a neutral standard.

Numbers before aesthetics. If the plan doesn't contain a hex and a number, it's not a decision yet.

### 2. Architecture

Decide component boundaries before you know how big the files get.

**Split when**: a component owns state that only it needs; a sub-part is reused elsewhere; a function exceeds ~80 lines of mixed concerns; the same className string appears in three files.

**Don't split when**: the parts can't be tested or described independently; you'd need props for every visual variation; the piece is 10 lines of markup. A `Card` with a `variant` prop beats three near-identical card components.

**State ownership** — the shortest correct answer:

| State kind | Belongs in | Example |
|---|---|---|
| Server data | Server cache | list of records, fetched once |
| Shared client state | Store (Zustand/Redux/Context) | current selection, filters, session |
| Component state | `useState` in the owner | open/closed, draft input |
| Derived | Compute during render | `const total = items.reduce(...)` |

The commonest architectural mistake is pushing derived values into a store. It creates sync bugs, stale values, and double renders for free. If you can compute it during render, don't store it.

For effect-heavy work, prefer the source of truth that lives closest to the interaction. `useState` for what the user is doing right now, a store only when two distant components genuinely need the same value.

### 3. Build

Order matters: tokens first, then semantics, then style, then motion. Building motion before the layout is stable means animating a wrong thing.

#### Semantics before styling

Choose the element for the job. This is the layer that is expensive to retrofit, because a div with an onClick handler cannot be made accessible later without rewriting it.

| Need | Use | Not |
|---|---|---|
| Perform an action | `<button type="button">` | `<div onClick>` |
| Go somewhere | `<a href>` | `<span onClick>` |
| Toggle on/off | `<button aria-pressed>` or `<input type="checkbox>` | styled div with a class |
| Choose one of many | `<select>`, radio group in `<fieldset>` | custom dropdown over a div |
| Expand a region | `<button aria-expanded aria-controls>` | icon-only div |
| Show extra info on hover | also reachable by focus | `title` alone |
| Data table | `<table>` + `<th scope>` | div grid with ARIA roles bolted on |
| Label an input | `<label for>` wrapping or referencing | placeholder as the label |

`placeholder` is not a label. It disappears exactly when the user needs it.

#### CSS architecture

Most "the styles are broken" problems are specificity accidents. Two classes matching the same element, one written later, both silently fighting. The rules that prevent it:

**One class per element.** If an element needs two style sources, one of them is wrong. Tailwind's whole argument is a single utility string per element — mixing `className="btn btn--lg"` with a `.card .header` descendant rule creates the exact ambiguity that makes maintenance expensive.

**Never** use `!important` as a tiebreaker. It's an admission that a specific selector was too greedy. Fix the selector.

**Descendant selectors couple you to structure.** `.card > .card-header > h3` breaks the moment anyone wraps the heading in a `<div>`. Prefer `.card__title` — the class says what it is, not where it lives.

**Scope by data attribute or a wrapper class, not by page id.** `.settings-page .field` means the field styles only work on one page. `.field` with modifiers means they're reusable.

**Layer order**, if you write raw CSS:

```
@layer reset, tokens, base, layout, components, utilities, overrides;
```

Overrides last is what makes them intentional rather than a symptom.

**Container queries beat viewport media queries for components.** A card in a 300px sidebar and the same card full-width need different layouts, and viewport width can't tell the difference:

```css
.card-wrapper { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { grid-template-columns: auto 1fr; gap: var(--space-4); }
}
```

This is the difference between a component library and a pile of page styles.

#### Typography

| Property | Value | Reasoning |
|---|---|---|
| Body size | 16px minimum | Below that, iOS zooms on focus and users on desktop strain |
| Measure | 60–75ch, hard cap ~80ch | Beyond 80ch the eye loses the line return |
| Body line-height | 1.5 sans, 1.6 serif | Serif needs more air because of stroke contrast |
| Heading line-height | 1.1–1.25 | Large type needs less leading to hold together |
| Display tracking | -0.02em to -0.045em | Large glyphs read loose without it |
| Body tracking | 0 | Anything negative hurts long-form readability |
| Label tracking | +0.06em | Small caps need air to not look like a mistake |
| Scale ratio | 1.2–1.25 | Bigger ratios break at small sizes, smaller look timid |
| Family count | 1, or 2 that are clearly different | Two similar faces is worse than one |

Optical alignment beats mathematical alignment. A circle needs to hang slightly lower than a square to look level. A heading's left edge on an `H` sits slightly inside its box. When something looks misaligned and the math is right, it isn't.

Set the scale once, derive everything from it. Read `references/typography.md` for full scale tables, pairing heuristics, and the optical-size notes.

#### Color

Color carries meaning before it carries decoration. Every color decision should answer: what does this tell the user?

| Role | Job | Failure when |
|---|---|---|
| Background | Establishes context | More than two surface levels on one screen |
| Surface | Groups content | Cards used to hold whitespace together instead of to group a semantic unit |
| Text primary | Content | Contrast under 4.5:1 |
| Text secondary | Metadata, labels | Fails contrast — the most common WCAG violation in "designed" UIs |
| Border | Separation | Borders used where spacing would do; hairlines at 1px on dark backgrounds vanish |
| Accent | One thing per screen | Two accents fighting; accent used for decoration |
| Semantic | Success/warn/error/info | Hue-only encoding — colorblind users lose the distinction entirely |

**Contrast floors** — non-negotiable, they're the difference between a UI and an unusable one:

| Content | AA | AAA |
|---|---|---|
| Body text (<18.66px / <14px bold) | 4.5:1 | 7:1 |
| Large text (≥24px, or ≥18.66px bold) | 3:1 | 4.5:1 |
| UI borders, icons, focus rings, chart marks | 3:1 | — |
| Disabled elements | exempt, but keep ≥3:1 for legibility | — |

Check them, don't estimate:

```bash
node .opencode/skills/ui-craft/scripts/contrast.mjs "#1e293b" "#ffffff"
node .opencode/skills/ui-craft/scripts/contrast.mjs --from src/styles/tokens.css
```

**Dark mode is not an inversion.** Invert luminance and every saturated color vibrates against its complement — the "dark mode glow" that makes cheap interfaces look cheap. Instead: keep hue, shift lightness, and *reduce chroma* on large surfaces. Text isn't pure white; `#e6edf3` on `#0d1117` reads cleaner and less glaring than `#ffffff` on `#000000`.

Derive the dark palette from the brand hue rather than picking fresh colors. If the brand color fails contrast as a button background in dark mode, darken its background and lighten the text, rather than switching to a different brand color.

**Elevation in dark mode comes from lightness, not shadow.** Shadows are nearly invisible on dark backgrounds. Lighter surface = closer to the viewer.

#### Layout and density

| Tier | Spacing | Use |
|---|---|---|
| Micro | 2, 4, 6px | Icon-to-label, badge padding |
| Tight | 8, 12px | Within a control, between related labels |
| Normal | 16, 24px | Between elements in a group |
| Section | 32, 48px | Between groups |
| Macro | 64, 96px+ | Between major page regions |

Density is a decision, not an accident. A trading terminal and a marketing site both use the same tokens; they pick different tiers. Pick a tier per surface and hold it — mixed density inside one component is what makes interfaces feel unfinished.

Responsive rules that survive contact with real content:

- Design for the content's worst case first. A 40-character German string, a 12-digit number, an empty list, a 500-item list.
- `min-width: 0` on flex children. Without it, a long word refuses to shrink and blows out the layout — the single most common responsive bug.
- Break at the content's natural seams, not at device widths. Nobody's layout breaks at exactly 768px.
- Test at 320px, not 375px. If it survives 320 it survives everything.
- Fixed heights on anything containing text are a bug waiting for the user's longer string.

#### Motion

Motion explains state changes. If it doesn't, it's noise.

| Purpose | Duration | Easing |
|---|---|---|
| Feedback on press | 80–120ms | `ease-out` |
| Hover / focus transition | 120–200ms | `ease-out` |
| Small element appear/disappear | 150–250ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Panel, drawer, modal | 250–400ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Page or route transition | 300–500ms | `ease-in-out` |
| Skeleton shimmer | 1200–1600ms loop | `ease-in-out` |

Rules that keep motion from becoming noise:

- **Animate `transform` and `opacity`.** They're the only properties the compositor handles without layout and paint. Animating `width`, `height`, `top`, or `left` forces layout on every frame.
- **Enter and exit must be symmetric.** An element that slides in and instantly disappears reads as a glitch.
- **One orchestrated entrance beats a stagger on everything.** Fade-and-slide-up on every section is the signature of a generated page.
- **Respect `prefers-reduced-motion`.** Not as a checkbox — as the reason large parallax and autoplay motion is questionable in the first place.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

#### Text that ships

Interface copy is design content. Write it during the build, not after.

- **Name by what the user understands**, not how the system is built. "Notifications", not "webhook config".
- **Buttons say what happens.** "Save changes", not "Submit". If the button says "Publish", the toast says "Published".
- **Errors explain and fix.** Not "Invalid input". "Enter a date after today". No apology, no blame, no raw stack.
- **Empty states are invitations.** Say what's here and what to do about the absence.
- **One idea per element.** An element with two jobs has two designs fighting.

### 4. Verify

This is the phase that makes the skill worth having. Run all five checks; the first two take seconds and catch most problems.

**Static audit** — catches the failures that are invisible in a screenshot:

```bash
node .opencode/skills/ui-craft/scripts/audit-ui.mjs src/
```

**Contrast** — every token pair you rely on, both themes:

```bash
node .opencode/skills/ui-craft/scripts/contrast.mjs --from src/styles/tokens.css
```

**Visual** — a screenshot is worth a thousand tokens of speculation:

```bash
node .opencode/skills/ui-craft/scripts/shot.mjs http://localhost:5173 --out .ui-qa
```

Look at it. Specifically check: is the reading order what you intended; does anything clip, overlap, or sit at an awkward angle; is the accent used once; does the whitespace read as intentional or as a gap; does the mobile width hold.

**Keyboard** — Tab through the whole flow. Every interactive element reachable, focus ring visible on every one, modals trap focus and close on Escape, no invisible click targets, logical order matching visual order. Then use it: Space toggles, Enter submits, arrows move within a group.

**Performance** — check the things that actually cost:

| Symptom | Likely cause | Check |
|---|---|---|
| Jank on scroll | Layout/paint animation, not transform | Are you animating `top`/`height`/`width`? |
| Input feels laggy | Whole-tree re-render per keystroke | Is state above the input, and memoized? |
| List stutters | All rows rendered | Virtualize past ~200 rows |
| Hydration warning | `Date.now()` / `Math.random()` in render | Move to `useEffect` |
| Flash of unstyled content | Fonts blocking | `font-display: swap`, preload the critical face |
| Layout shift on load | Images without dimensions | Explicit `width`/`height` or `aspect-ratio` |

`references/react-perf.md` has the memoization patterns, including when `useMemo` is a pessimization.

### 5. Critique

Before handing off, look again with fresh eyes and apply Chanel's rule: **remove one accessory.** The thing you added last, the one you liked most, is usually the one to cut.

Write two lines at the end of your summary:

```
Tried: <the bet, and whether it landed>
Remove next time: <the accessory>
```

That note is what stops every project from converging on the same look.

## The generic tell

Generated work clusters hard. These are defaults, not forbidden — a brief may explicitly ask for one, and the brief's words always win. But when the brief leaves an axis free, spending that freedom on a default is the failure.

| Tell | Why it reads as generated | Do instead |
|---|---|---|
| Cream `#F4F1EA` + high-contrast serif + terracotta `#D97757` | The signature Claude aesthetic; it appears on every brief | Pick from the subject's actual world |
| Near-black + one acid-green or vermilion accent | The other default cluster | Constrain saturation across the palette |
| Hairline rules, zero radius, dense columns | Reads as "editorial" regardless of subject | Radius or rules, not both, unless earned |
| Identical rounded cards, one shadow, gradient washes | The SaaS card kit; groups nothing | Group by meaning; cards only where content is genuinely separable units |
| ALL-CAPS tracked eyebrow above every heading | Appears whatever the subject is | Use the eyebrow only when it classifies |
| `·` between meta strings | Template chrome | Plain commas, or better, drop the metadata |
| `—` in every label | Same | Em dash only where the pause is real |
| Tinted near-black `#0B0B0B` standing in for black | Looks designed, reads muddy | A real dark tone with hue in it, chosen deliberately |
| `→` appended to every link | Suggests navigation that isn't there | Arrow only on actual navigation |
| One word in a different color in a headline | Emphasizing without hierarchy | If it matters, it gets its own line |
| Fade-and-slide-up on every section | Motion as decoration | One orchestrated entrance, then stillness |
| Full-width gradient hero with centered subhead | The universal landing header | Lead with the most characteristic thing in the subject |
| Emoji as a structural icon | Renders differently on every OS | An icon set with one stroke weight |

## Working with the rest of the toolkit

These skills overlap; this one is about code. When the task is mainly *not* code, hand off:

| Task | Go to |
|---|---|
| Need a palette/font/style direction retrieved from a curated corpus | `ui-ux-pro-max` |
| Need token architecture, three-layer tokens, slide/deck generation | `design-system` |
| Need a logo, CIP deliverables, banners, social images | `design` / `brand` |
| Need a specific aesthetic calibration for a landing page | `frontend-design` |
| Need to *see* the rendered page and interact with it | `browser-use` skill |

Two things this skill borrows deliberately: the three dials from the original `taste-skill` (now `--variance` / `--motion` / `--density` in `ui-ux-pro-max`) — a high-variance project wants asymmetry, a high-density one wants tighter spacing, a low-motion one wants stillness; and the calibration list in the section above, which is a rewrite of the traits `frontend-design` identified, kept here because it survives in code where aesthetic advice tends to get dropped.

## References

| Topic | File |
|---|---|
| Type scales, pairing, optical alignment | `references/typography.md` |
| Color systems, dark mode, contrast math | `references/color.md` |
| Spacing, breakpoints, container queries, density | `references/layout.md` |
| Durations, easings, reduced motion, gesture feel | `references/motion.md` |
| ARIA, keyboard contracts, screen readers, focus | `references/a11y.md` |
| React rendering, memoization, lists, bundle | `references/react-perf.md` |
| Component patterns with real markup | `references/patterns.md` |

| Script | Purpose |
|---|---|
| `scripts/audit-ui.mjs` | Static audit: hardcoded colors, magic numbers, missing focus states, a11y smells, specificity hazards |
| `scripts/contrast.mjs` | WCAG contrast for arbitrary pairs or every token pair in a CSS file |
| `scripts/shot.mjs` | Screenshot a running app at multiple viewports, both themes |
