# Patterns

Real markup for the components that get rebuilt badly most often. Copy the accessibility and state handling, not the class names — those belong to whatever design system the project uses.

## The button

The most-reimplemented component, and the most often broken.

```tsx
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, asChild, children, disabled, className = '', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={`btn btn--${variant} btn--${size} ${loading ? 'btn--loading' : ''} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner aria-hidden="true" />}
        {children}
      </Comp>
    );
  }
);
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: background-color 150ms ease-out, color 150ms ease-out,
              border-color 150ms ease-out, transform 80ms ease-out;
  cursor: pointer;
}

.btn:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

.btn:active:not(:disabled) { transform: scale(0.98); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--loading { cursor: progress; }
```

Four things that are usually missing:

- `type="button"` by default. A button inside a form without a type submits it.
- `aria-busy` while loading, so a screen reader announces the state change.
- `transform` on press rather than a layout-affecting change, so nothing shifts.
- A visible focus ring.

Always set an explicit `type`. Inheriting `submit` inside a form is a bug that surfaces in someone else's feature.

## The dialog

Use a library (Radix, Headless UI, React Aria) unless there's a specific reason not to. Focus trapping, scroll locking, `Escape` handling, and focus restoration are the four things hand-rolled dialogs get wrong.

If you must build one:

```tsx
function Dialog({ open, onClose, title, children }) {
  const ref = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    ref.current?.focus();

    const originalOverflow = document.body.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      // Trap focus
      const focusables = ref.current!.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = '';
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        className="dialog"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

Note the scrollbar compensation. Locking `overflow: hidden` removes the scrollbar, the page gets 15px wider, and everything shifts. It's the most visible bug in hand-rolled modals.

## The form field

Most of a form is this component. Get it right once.

```tsx
function Field({ id, label, error, hint, children }) {
  return (
    <div className="field" data-invalid={!!error || undefined}>
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="field__hint">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} role="alert" className="field__error">{error}</p>}
    </div>
  );
}

// Usage
<Field id="email" label="Email" error={errors.email}>
  <input
    id="email"
    type="email"
    autoComplete="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
  />
</Field>
```

The spacing encodes the relationships: label 6px from its input, hint 4px below, error 4px below that, and the next field 24px away. That's what makes a form scannable — see `layout.md`.

## The data table

```tsx
function DataTable<T>({ columns, rows, getKey, selected, onSelect }) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} scope="col" style={{ width: col.width }}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr
            key={getKey(row)}
            aria-selected={selected?.includes(getKey(row)) || undefined}
            onClick={() => onSelect(getKey(row))}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(getKey(row));
              }
            }}
          >
            {columns.map(col => (
              <td key={col.key}>{col.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Things that matter here:

- `tabular-nums` on numeric cells, so columns align.
- `scope="col"` on headers, so a screen reader associates cells with their column.
- A `<th scope="row">` for the first cell when a row has a natural label.
- Horizontal scroll in a wrapper with `overflow-x: auto`, not on the page.
- Past ~200 rows, virtualize.

## The empty state

An empty screen is an invitation to act. It's not an illustration and the word "empty".

```tsx
<div className="empty">
  <h2>No projects yet</h2>
  <p>Projects group related deployments. Create one to get started.</p>
  <Button onClick={create}>Create project</Button>
</div>
```

Three parts: what belongs here, why it's absent, and the one action that fills it.

## The loading skeleton

The skeleton must match the final geometry, or the page jumps when data arrives.

```tsx
function CardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="skeleton" style={{ height: 20, width: '60%' }} />
      <div className="skeleton" style={{ height: 14, width: '90%' }} />
      <div className="skeleton" style={{ height: 14, width: '40%' }} />
    </div>
  );
}

// Announce it without reading every placeholder
<div role="status" aria-live="polite" className="sr-only">Loading projects</div>
```

The wrapper carries the live region; each skeleton is `aria-hidden` so nothing reads "blank blank blank".

## The disclosure

```tsx
function Disclosure({ summary, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="disclosure">
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
      >
        {summary}
        <Chevron aria-hidden="true" data-open={open} />
      </button>
      <div id={id} className="disclosure__panel" data-open={open} hidden={!open}>
        <div>{children}</div>
      </div>
    </div>
  );
}
```

`useId` guarantees a unique `id`, so multiple instances on one page don't collide. The chevron rotates with CSS on `[data-open]`, so no JS touches the transform.

## The toast

```tsx
function Toast({ open, message, action, onClose }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast"
      data-open={open}
    >
      {message}
      {action}
      <button onClick={onClose} aria-label="Dismiss">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
```

Keep the vocabulary consistent: if the button said "Publish", the toast says "Published". Toasts are for confirmations of things the user already decided; errors that need action belong inline.

## The tabs

```tsx
function Tabs({ tabs, active, onChange }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + tabs.length) % tabs.length;
    refs.current[next]?.focus();
    onChange(next);
  };

  return (
    <div role="tablist">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={el => { refs.current[i] = el; }}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={active === i}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === i ? 0 : -1}   // roving tabindex
          onClick={() => onChange(i)}
          onKeyDown={e => onKeyDown(e, i)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

Roving `tabindex` — the group is one tab stop, arrows move within it. Making every tab individually tabbable is the common mistake and produces a miserable keyboard experience in a long tab bar.

## The popover / dropdown

```tsx
<button aria-expanded={open} aria-haspopup="listbox" aria-controls="listbox-id">
  Options
</button>
{open && (
  <ul id="listbox-id" role="listbox">
    <li role="option" aria-selected={selected === v}>{label}</li>
  </ul>
)}
```

`Escape` closes and returns focus to the trigger. Click outside closes. Arrow keys move the active option.

If this is a menu, use `role="menu"` / `role="menuitem"` with arrow-key navigation. Choosing the wrong role is worse than not using one — a `listbox` implies multi-select semantics the component doesn't have.

## The sortable list header

```tsx
<th scope="col" aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
  <button onClick={() => toggleSort(col.key)}>
    {col.header}
    <SortIcon aria-hidden="true" direction={sort.key === col.key ? sort.dir : undefined} />
  </button>
</th>
```

`aria-sort` tells a screen reader the current state; the icon alone doesn't. Use the full words `ascending` / `descending` / `none`, not `asc` / `desc`.

## Utility classes worth having

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.stack > * + * { margin-block-start: var(--flow, var(--space-4)); }
.cluster { display: flex; flex-wrap: wrap; gap: var(--gap, var(--space-3)); align-items: center; }
```

`.stack` and `.cluster` are worth having because they encode grouping relationships correctly — spacing between children handled once, rather than margin utilities sprinkled on each element.
