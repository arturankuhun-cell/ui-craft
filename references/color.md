# Color

Color communicates faster than text and is read pre-consciously. Every color in an interface should be doing a job.

## The three-layer model

| Layer | Contains | Changes when | Example |
|---|---|---|---|
| Primitive | Raw palette, scales, ramps | Rarely | `--blue-600: #2563eb` |
| Semantic | Purpose aliases | Theme switch, rebrand | `--color-primary: var(--blue-600)` |
| Component | Per-component overrides | A component needs an exception | `--button-bg: var(--color-primary)` |

Primitive → semantic → component is the only order that scales. Components reference semantic tokens, never primitives directly. The moment a component hardcodes `--blue-600`, re-theming requires finding every usage.

**Why it matters:** when the primary changes, you edit one file. When it doesn't, you grep for a hex.

## Semantic token set

A complete set. Missing any of these is what produces arbitrary hex values later.

```
/* Surfaces */
--color-bg              page background
--color-surface         raised: cards, panels
--color-surface-raised  popovers, menus, modals
--color-overlay         scrim behind modals

/* Text */
--color-text            primary content
--color-text-muted      secondary, metadata
--color-text-subtle     disabled, least important
--color-text-inverse    on a filled accent surface

/* Lines */
--color-border          default hairline
--color-border-strong   inputs, emphasis
--color-ring            focus indicator

/* Intent */
--color-primary         the one interactive accent
--color-primary-hover
--color-primary-fg      text on primary
--color-success
--color-warning
--color-danger
--color-info

/* Data */
--color-chart-1 … -6   categorical series, contrast-separated
```

## Categorical palettes are not sequential ramps

A sequential ramp (light→dark of one hue) cannot represent six unrelated categories — the first and last look like "less" and "more".

For a categorical series, hold lightness roughly constant and vary hue, then verify adjacent pairs clear 3:1:

```
#3b82f6  #f97316  #10b981  #a855f7  #ef4444  #0891b2
 blue    amber    emerald   purple    red     cyan
```

Verify, don't eyeball. Adjacent amber/red at similar lightness is a real failure.

## Contrast, computed

WCAG 2.x relative luminance:

```
c' = c/255
c_lin = c' <= 0.04045 ? c'/12.92 : ((c' + 0.055)/1.055)^2.4

L = 0.2126 R_lin + 0.7152 G_lin + 0.0722 B_lin

ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Note the 0.04045 breakpoint. Some code in circulation uses the older 0.03928 value from WCAG 1.x; the difference is small but it's wrong, and copying it gives slightly incorrect ratios on dark colors.

**Requirements:**

| Content | Minimum |
|---|---|
| Body text | 4.5:1 |
| Large text (≥24px, or ≥18.66px bold) | 3:1 |
| Icons that carry meaning | 3:1 |
| Input borders | 3:1 |
| Focus ring vs adjacent color | 3:1 |
| Disabled | exempt, but keep ≥3:1 so it reads as disabled rather than broken |
| Pure decoration | exempt |

Run it:

```bash
node scripts/contrast.mjs "#0d1117" "#8b949e"
node scripts/contrast.mjs --from src/styles/tokens.css
```

## Dark mode

Inverting a light palette produces color that's over-saturated and vibrates. The four rules:

1. **Keep the hue.** Same brand hue, different lightness.
2. **Drop chroma on large surfaces.** A `#2563eb` page background at full saturation is exhausting; `#0d1117` with a blue cast reads as intentional.
3. **Text isn't white.** `#e6edf3` on `#0d1117` is easier on the eyes than `#ffffff` on `#000000`, and it keeps contrast headroom for images overlaid on the surface.
4. **Elevation comes from lightness.** Shadows are invisible on dark backgrounds. `#161b22` on `#0d1117` reads as raised; a drop shadow on the same pair reads as nothing.

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f6f8fa;
  --color-text: #1f2328;
  --color-text-muted: #59636e;
  --color-border: #d1d9e0;
  --color-primary: #1f6feb;
  --color-primary-fg: #ffffff;
}

[data-theme="dark"] {
  --color-bg: #0d1117;
  --color-surface: #161b22;
  --color-text: #e6edf3;
  --color-text-muted: #9198a1;
  --color-border: #30363d;
  --color-primary: #4493f8;
  --color-primary-fg: #0d1117;   /* note: inverted — light text on light blue */
}
```

That last line is the one people miss. When a primary lightens for dark mode, its foreground often has to darken.

**Both themes need testing.** Most "dark mode bugs" are contrast failures that only exist in one of them.

## Color proportions

| Share | Role |
|---|---|
| 60–70% | Background and surfaces |
| 20–30% | Text, borders, secondary |
| 5–10% | The accent — one job per screen |

An accent covering more than ~10% stops being an accent. If everything is emphasized, the emphasis is gone.

## Accent hue and meaning

| Hue | Reads as | Common domain |
|---|---|---|
| Blue | Trust, neutral, corporate | Fintech, SaaS, medical |
| Green | Success, growth | Status, finance |
| Red | Danger, urgency, error | Errors, destructive actions |
| Amber/Warning | Caution, attention | Warnings, pending states |
| Purple | Creativity, premium | Marketing, media |
| Orange | Energy, action | CTAs, consumer |
| Teal | Calm, technical | Health, dev tools |
| Pink | Playful, social | Consumer, lifestyle |

Red for a destructive button and red for "sale" in the same product is a conflict. Reserve saturated red for destructive and error; find another way to signal a sale.

**Don't encode state by hue alone.** ~8% of men have some form of color vision deficiency. Pair every status color with an icon, a label, or a shape:

```html
<span class="status status--error">
  <svg aria-hidden="true">…</svg>
  Failed
</span>
```

## Contrast traps

| Trap | Fix |
|---|---|
| Muted text on tinted surfaces | Compute against the actual background, not the base |
| White text on a mid-tone accent | Darken the accent until 4.5:1 holds, or darken the text |
| Placeholder as the only label | Real `<label>`; placeholders disappear exactly when needed |
| Disabled text too faint | Dim the whole component, keep ≥3:1 |
| Focus ring invisible against the surface | Ring color must differ from both the control and the page |
| Light gray borders on white | 1px `#e5e7eb` on `#fff` is ~1.2:1 — invisible |
| Text over an image | Scrim, or a gradient behind the text block |
| Same token for border and hover state | Distinct tokens; they're read in different conditions |

## Alpha and translucency

Translucent tokens compose badly when stacked — a 50% border on a 50% surface gives ~25% against the page, which fails 3:1 and looks broken.

Prefer opaque tokens for anything that must meet a contrast floor. Reserve alpha for decorative overlays where contrast doesn't apply.

When you do need translucency, define the *composed* color as its own token so it's testable:

```css
--color-border: #d1d9e0;
--color-border-strong: #8c959f;
```

## Quick validation checklist

- Every text token meets 4.5:1 on every surface token it can appear on — in both themes.
- Focus ring meets 3:1 against both the control and the surrounding surface.
- Meaningful icons meet 3:1.
- Status is never hue-only.
- The accent covers under ~10% of any one screen.
- Dark mode tested as deliberately as light, including the primary's foreground.
- No raw hex in component files.
