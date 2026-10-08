# Typography

Typography is most of what makes an interface look designed. Everything else — color, spacing, motion — is supporting cast.

## Choosing families

Pick for the subject and the medium, not for what's currently popular. A dashboard, a document reader, and a marketing page want different voices.

| Voice | Display | Text | Feels like |
|---|---|---|---|
| Precise / technical | Space Grotesk | DM Sans | Engineering tooling |
| Neutral / system | Inter | Inter | Interfaces that shouldn't shout |
| Editorial | Playfair Display | Source Serif 4 | Long-form, publishing |
| Geometric / modern | Sora | Public Sans | Products, docs |
| Humanist / warm | Fraunces | Nunito Sans | Consumer, education |
| Brutalist | Archivo Black | Space Mono | Deliberately raw |
| Developer | JetBrains Mono | IBM Plex Sans | Code-adjacent products |
| Luxury / display | Bodoni Moda | Lato | Editorial, fashion |

Two families is the practical maximum. When you use two, they must differ in more than weight — if they're both neutral grotesques, use one.

**Check the license and the variable axes before committing.** A font with only a 400 weight forces fake bold or a weight jump that breaks the page's rhythm.

**Load performance is part of the design decision.** A variable font covering 9 weights at once can be 300KB+ and will be the largest asset on the page. Subset it, or request only the axes you use.

## Type scale

A 1.2–1.25 modular scale from a 16px base. The ratio determines personality: 1.125 is quiet and dense, 1.333 is dramatic and marketing-flavored, 1.5+ is editorial and will not fit in a dense UI.

**Ratio 1.200 (quiet, good for dashboards):**

| Step | Size | Line height | Use |
|---|---|---|---|
| 2xs | 11px | 1.45 | Overline, table micro-labels |
| xs | 12px | 1.5 | Metadata, captions |
| sm | 14px | 1.5 | Secondary text, table cells |
| base | 16px | 1.6 | Body |
| lg | 20px | 1.45 | Lead paragraph |
| xl | 25px | 1.35 | h4, card titles |
| 2xl | 31px | 1.25 | h3 |
| 3xl | 39px | 1.2 | h2 |
| 4xl | 49px | 1.1 | h1 |
| 5xl | 59px | 1.05 | Display |

**Ratio 1.250 (balanced, the safe default):**

| Step | px | Line height |
|---|---|---|
| xs | 12 | 1.5 |
| sm | 14 | 1.5 |
| base | 16 | 1.6 |
| lg | 20 | 1.45 |
| xl | 25 | 1.35 |
| 2xl | 31 | 1.25 |
| 3xl | 39 | 1.2 |
| 4xl | 49 | 1.1 |
| 5xl | 61 | 1.05 |

**Ratio 1.333 (marketing / landing):**

| Step | px | Line height |
|---|---|---|
| base | 16 | 1.6 |
| lg | 21 | 1.5 |
| xl | 28 | 1.4 |
| 2xl | 37 | 1.3 |
| 3xl | 50 | 1.15 |
| 4xl | 66 | 1.05 |
| 5xl | 88 | 1.0 |

Cap the scale. A 9-step scale with a 1.33 ratio is a 12:1 jump from base to display — that's why such sites have a hole in the middle where the h3 should be. If you need more range, compress the ratio at the bottom.

## Line height by role

Line height is set by the *block*, not by the font size alone.

| Context | Ratio | Why |
|---|---|---|
| Multi-line body, sans | 1.5–1.6 | Comfortable return sweep |
| Multi-line body, serif | 1.6–1.75 | Higher stroke contrast needs air |
| Headings | 1.1–1.25 | Large type needs less leading to read as one block |
| Display, single line | 0.95–1.1 | Tight is a deliberate look |
| Dense UI labels | 1.3–1.4 | Space is the scarce resource |
| Table cells | 1.4 | Rows are already spaced by padding |

## Measure

| Content | Measure | Note |
|---|---|---|
| Body text | 60–75ch | Beyond 80ch the eye loses the return |
| Long-form article | 65–70ch | Slightly narrower for serif |
| UI description text | 45–65ch | Narrower, since it's read in fragments |
| Single-line display | unlimited | Set by layout, not measure |
| Code blocks | 80–90ch | Monospace needs more width |

Never set measure in pixels. It's a function of the font's average character width, so `65ch` adapts when the family changes and `520px` doesn't.

```css
.prose { max-width: 65ch; }
```

## Tracking

Tracking compensates for the fact that large type looks loose and small type looks tight.

| Size | Tracking | Why |
|---|---|---|
| ≥48px | -0.03em to -0.045em | Glyph sidebearings look too wide at display sizes |
| 24–47px | -0.02em to -0.025em | Same effect, gentler |
| 16–23px | 0 to -0.01em | Neutral |
| 11–15px | +0.01em to +0.02em | Small type needs air |
| All-caps | +0.06em to +0.12em | Capitals have no ascender/descender to carry them |

Tracking scales with size. If you set one global `letter-spacing`, large headings will look loose and small labels cramped.

## Optical alignment

Mathematically centered text often looks off because glyphs aren't symmetric.

- A circle's optical center is above its geometric center. To center a circle with a square, hang the circle slightly low.
- `O`, `C`, `G` have different sidebearings than `H`, `N`, `M`. In a headline ending in an `O`, the text may read as shifted right.
- Punctuation hangs outside the measure: quotes, hyphens, and periods can sit in the margin without breaking the edge.
- In a row of icons or buttons, align to the glyph, not the box. A circular icon in a square button needs nudging.

None of this belongs in CSS by default — it belongs in your judgment when a screenshot looks wrong and the math says it's right.

## Numerals

| Feature | Use |
|---|---|
| `font-variant-numeric: tabular-nums` | Columns of numbers, tables, timers, anything that must align |
| `font-variant-numeric: proportional-nums` | Numbers inside running text, where tabular looks gappy |
| `slashed-zero` | Code, IDs, anything where 0/O ambiguity is dangerous |

Tabular figures in a table are the difference between a column that can be scanned and one that can't.

## Hierarchy by more than size

Size alone gives you one axis. Three or four of these together give real hierarchy:

- Size
- Weight (600+ for headings, 400 for body)
- Color (secondary text recedes)
- Space above (the strongest signal on the page)
- Width of the measure
- Case, used rarely and with tracking

If your only hierarchy tool is size, everything looks like it shouts.

## Traps

| Trap | Why it fails |
|---|---|
| All-caps headings | Requires heavy tracking; loses word-shape recognition; harder to read at length |
| Centered long text | Ragged left edge destroys the return sweep |
| Justified text | Creates rivers of whitespace; only works at very wide measures with hyphenation |
| Text baked into an image | Unselectable, unscalable, invisible to screen readers, breaks i18n |
| 11px body text | Below the legibility floor for anything but an overline |
| Two similar families | Reads as a mistake; use one and vary weight instead |
| Third font "just for numbers" | Almost never worth the request |
| Disabled text under 3:1 | Looks broken rather than disabled; dim the whole component instead |

## Semantic markup

```html
<h1>Page title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
<p>Body copy.</p>
```

Heading levels are document structure, not size choices. Don't jump h2 → h4 to skip a size; set the size with CSS. Screen reader users navigate by heading level, and a broken outline is a broken document.

Skip-link target, once per page:

```html
<a href="#main" class="skip-link">Skip to content</a>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: var(--space-4);
  top: var(--space-4);
  z-index: 100;
}
```

Never `display: none` it — that removes it from the accessibility tree too.
