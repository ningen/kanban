# kanban design system

This document is the single source of truth for the kanban UI's visual
language. It covers the design tokens, the reusable UI primitives, the status
semantics, and the conventions for adding new components.

The system lives in `src/ui` (a Vite + React + Tailwind CSS v4 project). All
tokens are CSS variables defined in `src/ui/src/styles.css` via Tailwind's
`@theme`, and all interactive styles are reusable primitives in
`src/ui/src/components/ui`.

## Guiding principles

1. **Semantic tokens, not ad-hoc values.** Colors, radii, shadows, and type
   sizes are named by what they mean (e.g. `surface-2`, `text-dim`) and defined
   once in `@theme`. Components reference tokens, never raw hex/px.
2. **One source of truth for color.** The CSS variables in `@theme` are the
   source of truth. TypeScript mirrors the status palette as CSS-variable
   references in `STATUS_TONE`/`STATUS_COLOR` (`src/ui/src/types.ts`).
3. **Primitives over repetition.** Repeated UI patterns (buttons, badges, tag
   pills, form controls) are extracted into `components/ui`. If you find
   yourself copying a class string, extract a primitive instead.
4. **Accessibility is built in.** Focus rings, `aria`, `role`, disabled states,
   and WCAG-contrast colors are part of the primitives, not bolted on.
5. **Status colors are semantic.** The board's five statuses each have a
   dedicated accent color, intentionally distinct from the interaction accent.

---

## Tokens

Token namespaces map to Tailwind utilities. Defining a token in `@theme` makes
the corresponding utility class available (e.g. `--color-accent` → `bg-accent`,
`text-accent`).

### Color

| Token | Value (oklch) | Use |
|-------|---------------|-----|
| `bg` | `0.095 0.008 258` | app background (deepest) |
| `surface` | `0.135 0.012 258` | columns, modal |
| `surface-2` | `0.17 0.014 258` | cards, inputs |
| `surface-3` | `0.21 0.016 258` | elevated controls, badges |
| `border` | `0.27 0.018 258` | default stroke |
| `border-strong` | `0.38 0.022 258` | hover/focus stroke |
| `text` | `0.95 0.01 258` | primary text |
| `text-dim` | `0.75 0.02 258` | secondary text |
| `text-faint` | `0.60 0.02 258` | tertiary/meta text |
| `accent` | `0.55 0.21 250` | primary actions, focus, active chips |
| `accent-hover` | `0.62 0.21 250` | primary button hover |
| `accent-soft` | `0.3 0.09 250` | accent tints (marks, badges) |
| `danger` | `0.62 0.21 25` | destructive actions, overdue |
| `danger-soft` | `0.3 0.08 25` | destructive tints |

The accent is a **cool blue** at L=0.55 so white text clears WCAG AA
(≥ 4.5:1). Keep the accent's value in the `250` hue range and the `doing`
status in the `205` range so they always read as different colors.

### Status palette

Status colors drive the board accent (column dot, card left bar). Each has a
corresponding `-soft` background for badges/tints.

| Status | Accent (oklch) | Soft (oklch) | Meaning |
|--------|----------------|--------------|---------|
| `todo` | `0.68 0.02 258` | `0.26 0.02 258` | not started (neutral) |
| `doing` | `0.72 0.15 205` | `0.3 0.07 205` | in progress (cyan — distinct from accent) |
| `waiting` | `0.78 0.15 80` | `0.3 0.07 80` | blocked (amber) |
| `done` | `0.7 0.16 150` | `0.28 0.07 150` | complete (green) |
| `wontdo` | `0.68 0.18 305` | `0.28 0.08 305` | declined (violet) |

### Typography

Sizes, line-heights, and tracking are tokenized so the type ramp is
consistent.

| Utility | Size×line-height |
|---------|------------------|
| `text-xs` | 0.75rem × 1.1rem |
| `text-sm` | 0.875rem × 1.25rem |
| `text-base` | 1rem × 1.5rem |
| `text-lg` | 1.125rem × 1.75rem |
| `text-xl` | 1.25rem × 1.75rem |
| `text-2xl` | 1.5rem × 2rem |

- `font-sans` is a CJK-friendly system stack: `ui-sans-serif, system-ui, …,
  Noto Sans JP, Yu Gothic UI, Meiryo, sans-serif`.
- Leading: `tight` 1.25, `snug` 1.375, `normal` 1.5.
- Tracking: `tight` -0.01em, `normal` 0, `wide` 0.025em, `wider` 0.05em,
  `widest` 0.1em.

### Radii & elevation

| Token | Value | Use |
|-------|-------|-----|
| `radius-sm` | 0.375rem | small pills |
| `radius-md` | 0.5rem | buttons, cards |
| `radius-lg` | 0.75rem | columns, dialog |
| `radius-xl` | 1rem | large containers |
| `shadow-sm` | subtle | resting cards |
| `shadow-md` | medium | hover, lifted cards |
| `shadow-lg` | large | modal/dialog |

---

## Primitives (`components/ui`)

All primitives live in `src/ui/src/components/ui`. They accept a focused set
of props (often `variant`/`size`, following the shadcn/ui convention) and own
their styling so callers stay consistent.

| Component | Variants | Sizes | Notes |
|-----------|----------|-------|-------|
| `Button` | `primary`, `secondary`, `outline`, `ghost`, `danger` | `sm`, `md`, `icon` | primary actions |
| `Badge` | `neutral`, `accent`, `danger`, `warning`, `status` | — | pill; `status`+`tone` for status tint |
| `StatusDot` | — | — | small colored dot by `status` |
| `Tag` | — | — | deterministic hue from tag text |
| `DueBadge` | — | — | overdue/due-soon color from `due` |
| `FilterChip` | — | — | single-select filter pill |
| `TextField` | — | — | `label`/`error`/`hint`, forwards ref |
| `Textarea` | — | — | `label`/`error` |
| `Select` | — | — | `label`; native select |

### Button

```tsx
<Button variant="primary|secondary|outline|ghost|danger" size="sm|md|icon">
```

- `primary`: accent bg, white text (AA). Use for the single primary action in
  a view.
- `outline`: bordered, transparent. Use for secondary actions (e.g. Archive).
- `ghost`: transparent. Use for low-emphasis actions (e.g. Cancel, close).
- All buttons have a visible `focus-visible` ring and are disabled-correct.

### Badge & status tints

`Badge` is a generic pill. For status-specific tints pass
`variant="status"` with a `tone` = `--color-status-<status>`:

```tsx
<Badge variant="status" tone="--color-status-done">done</Badge>
```

`StatusDot`, `Tag`, and `DueBadge` are thin wrappers that encode kanban
semantics (status color, tag hue, due urgency) so you never hand-write those
colors in a view.

---

## Status semantics

- `todo` / `doing` / `waiting` are the active board columns.
- `done` and `wontdo` are terminal; both show an "archive" affordance.
- `done` tasks render with a strikethrough + dimmed title.
- `doing` uses **cyan**, which is visually distinct from the interaction
  **accent** (blue). Never make them the same color.

### Due urgency

`DueBadge` classifies a due date (`lib/dueUrgency.ts`):

| Urgency | Color | Window |
|---------|-------|--------|
| `overdue` | `danger` (red) | before today |
| `due-soon` | `warning` (amber) | within 3 days |
| `normal` | `neutral` | — |

---

## Accessibility

- **Contrast**: text-on-background is ≥ 17.8:1; primary button text ≥ 4.5:1.
  Colors are chosen in oklch and verified in-browser.
- **Focus**: interactive primitives expose a visible `focus-visible` ring using
  the accent color with an offset that reads on dark surfaces.
- **Semantics**: buttons are `<button>`; the modal uses `role="dialog"`,
  `aria-modal`, and Escape-to-close; filter chips use `aria-pressed`; search
  inputs carry `aria-label`; tag/status dots are `aria-hidden` (decorative).
- **Reduced motion**: interactions are short (150–160ms). Prefer subtle motion
  and revisit `prefers-reduced-motion` if adding longer animations.

---

## Component conventions

1. **Location**: put primitives in `src/ui/src/components/ui`; compose them in
   `src/ui/src/components`.
2. **Class names**: use Tailwind utilities referencing theme tokens
   (`bg-surface-2`, `text-text-dim`). Use `cn()` (`lib/cn.ts`) to merge classes
   without drop-off.
3. **Type safety**: define exported prop interfaces annotated with
   `ComponentPropsWithoutRef<...>` for HTML passthrough. Use `forwardRef`
   for inputs.
4. **No duplicate colors**: reference the theme, not hex values. For anything
   status-specific, use the `STATUS_TONE`/`STATUS_COLOR` map or the status
   primitives.
5. **Test pure logic**: extract date/color/time logic into `lib/` as pure
   functions with tests (e.g. `dueUrgency`, `formatRelative`, `tagHue`).

---

## Adding or changing a token

1. Update `src/ui/src/styles.css` under `@theme`. Use oklch for colors so the
   perceptible scale is uniform.
2. Keep semantic names; prefix colors with `--color-`, sizes with `--text-*`,
   etc. so Tailwind generates the matching utilities.
3. If the token is a status color, update the TS mirror in `types.ts`
   (`STATUS_TONE`/`STATUS_COLOR`).
4. Update this document if you add a new token category or primitive.
5. Verify contrast and re-run the UI checks:
   `cd src/ui && bun run typecheck && vite build`.
