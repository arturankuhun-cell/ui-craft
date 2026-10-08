# React performance

Most "the app feels slow" problems are rendering problems, and most of them come from the same three sources: state placed too high, memoization applied by reflex rather than measurement, and lists that render every row.

Measure before optimizing. React DevTools Profiler shows which components rendered, how often, and how long each commit took — guessing wastes effort and usually adds complexity for no gain.

## The rendering model

State update → React re-renders the component holding that state → React re-renders its children → for each child, `React.memo` or a custom comparator decides whether to re-render it.

Three consequences:

1. **State high in the tree re-renders everything below it.** Moving state down is usually faster than any amount of memoization.
2. **A new object or function prop breaks `React.memo`.** `{...}` in render, `.map()` producing new elements without keys, an inline arrow — all defeat the memo.
3. **`useMemo` returning a stable reference is the only thing that makes memoization work.** If you wrap the whole component in `memo` but pass inline props, you paid for nothing.

## Fix order

Work down this list; the returns drop off fast.

| Step | Effort | Typical gain |
|---|---|---|
| Move state closer to where it's used | Low | Large |
| Fix an unmemoized value that should be stable | Low | Large |
| Add missing list `key`s | Low | Moderate |
| Virtualize a long list | Medium | Large |
| `React.memo` the expensive subtree | Medium | Moderate |
| `useCallback` / `useMemo` everywhere | High | Often negative |

**Never start at the bottom of this list.**

## State placement

```tsx
// Every keystroke re-renders the entire list
function App() {
  const [query, setQuery] = useState('');
  return (
    <>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ExpensiveList items={allItems} />
    </>
  );
}

// Only the filtered list re-renders
function App() {
  const allItems = useMemo(() => loadItems(), []);
  const filtered = useMemo(
    () => allItems.filter(i => i.name.includes(query)),
    [allItems, query]
  );
  return <ExpensiveList items={filtered} />;
}
```

Two rules that prevent most of this:

- **Derived state is computed, not stored.** If a value can be calculated from existing state during render, do that. Storing it creates a sync obligation and a class of bug that only appears under specific update sequences.

```tsx
// Two sources of truth that can disagree
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);

// One
const items = useMemo(() => loadItems(), []);
const count = items.length;
```

- **Context re-renders all consumers.** Split contexts by update frequency and frequency of change, so a rapidly-changing value doesn't wake a static subtree.

```tsx
<ThemeContext.Provider value={theme}>
  <SettingsContext.Provider value={settings}>   {/* split so theme changes
  <App />                                          don't re-render settings */}
</ThemeContext.Provider>
</SettingsContext.Provider>
```

## When memoization actually helps

Memoize when all three are true:

1. The component is measurably expensive (visible in the profiler).
2. Its props are referentially stable.
3. It re-renders often — a parent with per-keystroke state, a large list.

Otherwise it's overhead: extra memory, extra comparison work, and code that's harder to follow.

```tsx
const Row = memo(function Row({ item, selected, onSelect }: Props) {
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});
```

The `onSelect` prop must be stable, or every row re-renders anyway:

```tsx
// Unstable — new function every render, memo is dead weight
<Row onSelect={id => setSelected(id)} />

// Stable
const handleSelect = useCallback((id: string) => setSelected(id), []);
<Row onSelect={handleSelect} />
```

### `useMemo` and `useCallback` are not free

Each hook allocates, stores deps, and runs a comparison on every render. For a trivial computation, the comparison can cost more than the work.

```tsx
// Wasteful
const visibleItems = useMemo(() => items.filter(i => i.active), [items]);
const cls = useMemo(() => `${base} ${active ? 'on' : ''}`, [base, active]);
```

Both are cheap enough to compute directly. Reserve `useMemo` for genuinely expensive work — filtering thousands of rows, parsing, building a large index.

### Custom comparators

```tsx
const Row = memo(RowBase, (prev, next) => {
  return prev.id === next.id && prev.selected === next.selected;
});
```

A comparator that ignores a prop the component actually reads will produce stale renders that are nearly impossible to debug. Only compare props you know are pure.

## Lists

**Keys.** The index as key makes React reuse the wrong DOM node on reorder — input values land in the wrong rows, state sticks to positions instead of items.

```tsx
// Wrong: breaks on sort, filter, delete
{items.map((item, i) => <Row key={i} {...item} />)}

// Right
{items.map(item => <Row key={item.id} {...item} />)}
```

Use an index key only for a list that never reorders and never removes items.

**Virtualization.** Past roughly 200 rows, render only what's visible.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56,
  overscan: 8,
});
```

Only worth it when rows have predictable heights or you can measure them. Variable-height virtualization needs measurement, which is its own complexity — for a few hundred rows a flat list is often the better trade.

Other list costs worth knowing:

- **Don't put functions or objects in context** and pass them down; it breaks every memo below.
- **Avoid inline styles from object literals** in list items; a new object each render defeats memo.
- **Paginate or infinite-scroll** rather than rendering a full audit log. A log that grows without bound will eventually stall regardless of virtualization.

## Effects

`useEffect` is for synchronizing with systems outside React. Most things people put in effects don't need one.

| Want | Use |
|---|---|
| Compute from props/state | Compute during render |
| Respond to a prop change | Compute during render with a comparison, or `useMemo` |
| Reset state when a prop changes | `key` on the component |
| Subscribe to an external store | `useSyncExternalStore` |
| Fetch data | Framework loader, or a library with caching |
| Manually sync to an external system | `useEffect` |

Effects that fetch on mount without cleanup are the classic source of race conditions in React 18's StrictMode:

```tsx
useEffect(() => {
  let cancelled = false;
  fetchData().then(data => {
    if (!cancelled) setData(data);
  });
  return () => { cancelled = true; };
}, []);
```

Prefer a data library with caching and deduplication over hand-rolled fetching. Hand-rolled fetching is where most stale-data bugs live.

**Effects with dependencies that aren't stable run every render.** If an effect must run on a change but its deps are new objects each time, the effect runs constantly — a subtle infinite loop that doesn't error.

## Rendering performance

**`useDeferredValue`** — let a heavy list lag behind an input so typing stays responsive.

```tsx
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => search(all, deferredQuery), [all, deferredQuery]);
const stale = query !== deferredQuery;
```

**`useTransition`** — mark a non-urgent state update.

```tsx
const [isPending, startTransition] = useTransition();

startTransition(() => setTab(next));
```

**`useTransition` cannot control a pending promise** — that's `useActionState` (React 19). Conflating the two is a common source of confusion.

## Bundle and load

| Technique | Effect |
|---|---|
| `React.lazy` + `Suspense` | Split routes and heavy components out of the initial bundle |
| Route-level code splitting | Biggest single win in most apps |
| Tree-shakeable imports | `import { debounce } from 'lodash-es'`, not `import _ from 'lodash'` |
| Barrel files | They defeat tree-shaking in some bundlers — import deep paths |
| `next/dynamic`, `React.lazy` for modals | A modal nobody opens shouldn't be in the first load |
| Font subsetting | A variable font with unused axes can be 300KB |

Check what's actually in the bundle before optimizing — a 400KB dependency you never expected is more common than a render bottleneck.

## Profiler triage

| Reading | Meaning | Action |
|---|---|---|
| Many commits, all fast | Fine | Nothing — this is React working normally |
| One long commit on typing | Heavy render | Find the expensive component in the flame graph, memo it |
| Long commit on mount | Bundle or data | Lazy-load, or move work out of render |
| Double renders in dev | StrictMode | Expected in dev only; not a bug |
| Commits on scroll | Unmemoized list rows | Add `memo` + stable props |
| Layout taking most of the time | Expensive CSS | Long selectors, deep nesting, wide box-shadows |

## Anti-patterns

| Pattern | Problem |
|---|---|
| `useMemo` on trivial computations | Comparison costs more than the work |
| `memo` with unstable props | Memo compares, then re-renders anyway |
| Storing derived state | Sync obligation, stale values |
| One context for everything | Every provider change re-renders every consumer |
| `useEffect` for derived values | Extra render pass, race conditions |
| Index as list key | Broken state on reorder |
| `React.memo` on a cheap component | Overhead exceeds the saving |
| Fetching in `useEffect` | Race conditions; use a caching library |
| Virtualizing below ~200 rows | Complexity with no benefit |
