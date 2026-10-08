# Layout

Layout is the structure that decides whether an interface reads as designed or assembled.

## Spacing scale

One scale, used everywhere. Half-steps exist because 12px is a real requirement, not because 12 is on a 4-grid.

```css
--space-0: 0;
--space-1: 2px;
--space-2: 4px;
--space-3: 6px;
--space-4: 8px;
--space-5: 12px;
--space-6: 16px;
--space-7: 20px;
--space-8: 24px;
--space-10: 32px;
--space-12: 40px;
--space-14: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

**Tiers** — which values you actually reach for depends on the product:

| Tier | Values | Use |
|---|---|---|
| Micro | 2, 4, 6 | Icon-to-label, badge padding, dense controls |
| Tight | 8, 12 | Inside a control, label-to-field |
| Normal | 16, 20, 24 | Between items in a group |
| Section | 32, 48 | Between groups |
| Macro | 64, 96+ | Between page regions |

Density is a product decision. Pick a tier per surface and hold it. A settings page and a data table in the same app can legitimately sit in different tiers — what breaks the illusion is one *component* mixing them.

## Spacing expresses relationship

Distance is how the user learns what's grouped. This is the highest-leverage rule in the layout section.

| If A and B are… | Spacing |
|---|---|
| Label and its input | 6–8px |
| Input and its helper text | 4–6px |
| Two inputs in a group | 12–16px |
| Form fields in a section | 24–32px |
| Sections on a page | 48–96px |

The test: cover the labels. If the visual grouping still matches the semantic grouping, your spacing is right. If everything looks equally related, spacing isn't doing its job.

## Container queries for components

Media queries ask "how wide is the window." Components need "how wide am I." The same card in a sidebar and in a main column must lay out differently, and viewport width can't tell them apart.

```css
.card-host { container-type: inline-size; }

@container (min-width: 30rem) {
  .card { grid-template-columns: auto 1fr; }
}
```

Give every container a name when you have more than one, so queries stay readable:

```css
.sidebar { container: sidebar / inline-size; }

@container sidebar (min-width: 20rem) {
  .nav-item { flex-direction: row; }
}
```

**Reach for these when:** a component appears in more than one container width, a sidebar can be collapsed or expanded, a card appears in a grid and in a list, or the layout depends on available space rather than device class.

**Skip them when:** the page has exactly one column, and full-width means viewport width. Then a media query is simpler and more obvious.

## Breakpoints

Break at your content's natural seams, not at device widths. The number 768 is not a magic number; it's where *your* layout happens to break.

Find them empirically: set the layout to one column, then widen slowly until something looks wrong. That's a breakpoint.

Typical ranges for a content-driven set:

| Name | Width | Usually the point where |
|---|---|---|
| — | <480 | Single column, no persistent nav |
| sm | 480 | Two-up cards become viable |
| md | 768 | Sidebar can sit beside content |
| lg | 1024 | Full nav, three-up grids |
| xl | 1280 | Measure can hit 65ch without gutters shrinking |

Test at 320px even if you think nothing goes there. If it survives 320 it survives everything.

## Responsive rules that hold

- **`min-width: 0` on flex children.** Without it, a long unbroken string refuses to shrink and blows out the layout. This is the single most common responsive bug.

```css
.row { display: flex; }
.row > * { min-width: 0; }   /* children may now shrink */
```

- **Never fix the height of anything containing text.** Use `min-height`. The user's German translation will be longer than yours.
- **`clamp()` for fluid type and spacing** removes most breakpoint needs:

```css
--text-fluid: clamp(1.5rem, 1rem + 2vw, 2.5rem);
--gap-fluid:  clamp(1rem, 0.5rem + 2vw, 2rem);
```

- **Intrinsic sizing before breakpoints.** `width: fit-content`, `min()`, `max()`, and `grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))` handle a surprising number of cases with no media query at all.
- **Design the worst case first.** Empty state, one item, 500 items, a 40-character German string, a 12-digit number.

## Grid patterns

| Need | Pattern |
|---|---|
| Responsive auto-fit cards | `grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr))` |
| Sidebar + content | `grid-template-columns: minmax(0, 1fr)` + `auto` for the sidebar |
| Centered measure | `max-width: 65ch; margin-inline: auto` |
| Full-bleed inside a container | child with `margin-inline: calc(50% - 50vw)` |
| Sticky header, scrolling content | grid rows `auto 1fr` with `min-height: 0` on the scrolling child |

The `minmax(0, 1fr)` is important — plain `1fr` has an implicit `min-width: auto` that prevents shrinking, the same bug as the flex case.

## Alignment

- **Left-align body text.** Centered text over more than two lines has no left edge to return to.
- **Align to a shared baseline** in dense data views, or at least to shared column boundaries.
- **Align form labels consistently** — right-aligned labels against left-aligned inputs is the standard in dense forms because it puts the variable-length text nearest the field.
- **Optical, not mathematical**, when something looks off but the math is right. See `typography.md`.
- **One alignment per edge.** If the left edges of a group aren't shared, the group isn't a group.

## Z-index

Named layers, not numbers chosen by feel. Numbers collide; names don't.

```css
--z-base: 0;
--z-sticky: 100;
--z-dropdown: 200;
--z-overlay: 300;    /* modal scrim */
--z-modal: 400;
--z-toast: 500;
--z-tooltip: 600;
```

A `z-index: 99999` in a component is a bug. If a component needs to escape a stacking context, fix the context.

## Layout bugs and their causes

| Symptom | Cause | Fix |
|---|---|---|
| Child overflows parent | Missing `min-width: 0` | Add to flex/grid child |
| Scrollbar on the page instead of a panel | Fixed-height parent | `min-height: 0` on the flex child |
| Content jumps on data load | No reserved space | `min-height`, `aspect-ratio`, skeletons matching final geometry |
| iOS Safari zooms on focus | Input font <16px | Set input font-size to 16px |
| Sticky header doesn't stick | Ancestor has `overflow: hidden` or `transform` | Remove it; `transform` creates a containing block |
| Text overlaps at 320px | Fixed widths | Fluid sizing |
| Modal scrolls body behind it | Missing scroll lock | Lock `overflow: hidden` on `body`, compensate for scrollbar width |
