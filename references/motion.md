# Motion

Motion in an interface exists to explain what changed. If it doesn't explain anything, it's decoration competing with the content.

## Duration by distance

The further something travels, the longer it should take. A 2px nudge and a full-screen panel are not the same event.

| Event | Duration | Notes |
|---|---|---|
| Press feedback | 80–120ms | Fast enough to feel like a direct response |
| Hover / focus | 120–200ms | Slow enough to not fire during mouse travel |
| Checkbox, toggle, small icon | 150–250ms | |
| Popover, tooltip, dropdown | 150–250ms | |
| Modal, drawer, sheet | 250–400ms | Travel distance justifies the time |
| Toast | 200–300ms in, 150ms out | Exits are faster than entrances |
| Page / route transition | 300–500ms | |
| Skeleton shimmer | 1200–1600ms loop | Slow enough not to strobe |

**Under 100ms reads as instant** — fine for color, but a transform that snaps feels like a jump-cut.
**Over 500ms reads as lag** — the user has finished the thought before the element arrives.

## Easing

| Curve | Use |
|---|---|
| `ease-out` | Anything the user initiated. Fast start, gentle settle. The default for hover and press |
| `ease-in` | Exits. Accelerating away feels right |
| `ease-in-out` | Elements moving between two on-screen positions, page transitions |
| `cubic-bezier(0.16, 1, 0.3, 1)` | Panels, drawers, modals. Strong deceleration, feels expensive |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot. Only for playful confirmation; overused |
| `linear` | Only for looping or scrubbed animation. Almost never for transitions |

Rule of thumb: **use `ease-out` for anything the user caused.** It puts the visual response at the front of the duration, where perception is most sensitive.

## What to animate

| Property | Cost | Use |
|---|---|---|
| `transform` | Compositor only | Movement, scale, rotation — always prefer |
| `opacity` | Compositor only | Fades, crossfades |
| `background-color`, `color`, `border-color` | Paint | Cheap enough for hover states |
| `box-shadow` | Paint | Avoid animating; use a pseudo-element crossfade |
| `width`, `height`, `top`, `left`, `margin` | Layout | Avoid. Use `transform` instead |
| `filter`, `backdrop-filter` | Composite | Expensive; keep small areas and short durations |

The layout-triggering properties are why jank happens. A sidebar that animates `width` recalculates the layout of every element inside it on every frame. `transform: translateX()` costs nothing.

```css
/* Janky */
.sidebar { transition: width 300ms; }

/* Smooth */
.sidebar { transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1); }
```

## Enter and exit must be symmetric

An element that slides in over 400ms and then vanishes instantly reads as a glitch, even though the entrance was well-tuned. Exits should be faster — 60–75% of the entrance duration — because the user has already decided they don't want it.

```css
.dialog {
  transition: opacity 200ms ease-out, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dialog[data-closed] {
  transition-duration: 150ms;   /* faster out */
  transition-timing-function: ease-in;
}
```

## Staggering

Staggered entrances feel considered when the delay is short enough that nobody consciously notices it.

| Element count | Per-item delay | Total |
|---|---|---|
| 3–6 | 40–60ms | ~300ms |
| 7–12 | 25–40ms | ~400ms |
| 13+ | Cap total at ~400ms | reduce per-item |

If the total exceeds ~500ms the last item feels broken. Compute the per-item delay as `min(60, 400 / count)` rather than hardcoding 50.

```css
.items > * { animation: rise 400ms both; }

@media (prefers-reduced-motion: no-preference) {
  .items > *:nth-child(1) { animation-delay: 0ms; }
  .items > *:nth-child(2) { animation-delay: 50ms; }
  .items > *:nth-child(3) { animation-delay: 100ms; }
}
```

**One orchestrated entrance beats a stagger on everything.** Fade-and-slide-up on every section of a page is the signature of a generated design — it's motion applied uniformly instead of to something that deserves it.

## Reduced motion

Non-negotiable, and it should change the design rather than just zero out the duration. A large parallax movement, a spinning loader, or a scroll-jacking sequence may need to be removed entirely rather than shortened.

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

The `0.01ms` rather than `0` matters: a zero duration can prevent `animationend` / `transitionend` from firing, which breaks JavaScript that waits on those events.

For anything load-bearing under reduced motion — progress indicators, loading states — check what the state looks like afterward. A spinner that stops spinning mid-load conveys nothing.

## Loading states

| Kind | Use | Note |
|---|---|---|
| Skeleton | Content of known shape | Must match the final geometry or the page jumps |
| Spinner | Unknown duration, small area | Under 200ms it should never appear |
| Progress bar | Known total | Only if you know the total; a fake bar is worse than none |
| Optimistic UI | Action likely to succeed | Update immediately, roll back with a toast on failure |
| Blocking overlay | Whole page busy | Only when the user genuinely can't act |

**Delay the spinner.** Nothing should appear for the first ~150ms; fast responses shouldn't flash a loader.

**Skeletons must match the final layout.** A skeleton at a different height than the content guarantees a visible jump when data arrives.

## Micro-interactions

The small moments that make an interface feel responsive. All of them must respect reduced motion.

| Interaction | Feedback | Timing |
|---|---|---|
| Button press | `scale(0.98)` or translateY(1px) | 80ms |
| Toggle | Knob translate + color | 150ms |
| Accordion | grid-template-rows animation | 250ms |
| Copy to clipboard | Icon swap + label change | 150ms, revert after 2s |
| Save | Checkmark draw-in | 200ms |
| Drag start | Elevation + slight scale | 120ms |
| Drop | Settle back, brief highlight | 200ms |

Accordions are worth doing with `grid-template-rows` rather than measuring heights in JS:

```css
.acc-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms cubic-bezier(0.16, 1, 0.3, 1);
}
.acc-panel[data-open] { grid-template-rows: 1fr; }
.acc-panel > div { overflow: hidden; }
```

## Gesture and pointer

- Anything with a hover state needs a focus state with the same visual weight. Keyboard users are not second-class.
- Touch targets ≥44×44px, even when the visual element is smaller. Pad the hit area rather than growing the icon.
- Drag interactions need a keyboard equivalent. Reordering a list must be possible without a pointer.
- `touch-action: manipulation` removes the 300ms tap delay on older mobile browsers.
- Never rely on hover alone for information. Hover reveals are a desktop enhancement; the content must be reachable on touch.
