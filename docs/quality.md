# Quality policy

This project enforces a strict quality gate so that low-quality code does not
enter history. Every contributor (human or AI agent) must pass the gate.

## The gate

`bun run quality` runs, in order:

1. **Type check** — `tsc --noEmit` against the strictest `tsconfig.json`.
2. **Lint + format** — `biome check .`.
3. **Unit tests with coverage** — `bun test --coverage-reporter=lcov`, then a
   custom gate parses `coverage/lcov.info` and enforces thresholds.

The same sequence runs in the `pre-commit` git hook (`.githooks/pre-commit`).
If any step fails, the commit is blocked. Use `--no-verify` only when an
explicit, temporary exception is warranted.

## Coverage gate

Bun's built-in `coverageThreshold` is unreliable (it reports pass/fail
inconsistently and hides the `statements` metric). To keep the gate
deterministic, `scripts/check-coverage.ts` parses Bun's `.lcov` report and
enforces:

| metric        | threshold |
|---------------|-----------|
| global lines  | ≥ 90%     |
| global funcs  | ≥ 90%     |
| per-file lines| ≥ 90%     |
| per-file funcs| ≥ 90%     |

Run it directly with `bun run test:coverage`.

## TypeScript strictness

`tsconfig.json` enables:

- `strict` (all strict flags)
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noImplicitOverride`
- `noFallthroughCasesInSwitch`
- `noImplicitReturns`
- `useUnknownInCatchVariables`
- `noUnusedLocals` / `noUnusedParameters`
- `verbatimModuleSyntax` (enforces `import type`)
- `isolatedModules`

## Lint + format (Biome)

Biome 2.x. Rules are the `recommended` preset plus every rule in these groups
at its own default severity (`"on"` — Biome 2 removed the v1 `all: true`
option, and a group is either a severity or an object of per-rule overrides,
never both):

- `suspicious`
- `correctness`
- `complexity`
- `performance`

`style` is a curated list instead of all-on, because Biome 2 makes style rules
advisory: enabling the whole group would add ~150 warnings of noise (magic
numbers, ternaries, block statements) without failing the gate. The rules this
project cares about stay at `error`: `noNonNullAssertion`, `noParameterAssign`,
`useConsistentArrayType`, `noDefaultExport`. `useNamingConvention` is off.

Conventions: double quotes, semicolons, trailing commas, arrow-parentheses
always, 2-space indent, 100-column line width, LF endings, import sorting.

Only diagnostics with `error` severity fail the gate; warnings and infos are
reported but exit 0. Two project-specific settings keep the signal honest:

- `javascript.globals: ["Bun"]` — the `Bun` global is real, not undeclared.
- `css.parser.tailwindDirectives` — `src/ui/src/styles.css` is Tailwind v4.

`files.includes` force-ignores `**/dist` and `**/node_modules` (`!!` syntax).
Without it Biome lints the built bundle in `src/ui/dist/`, which produced 98%
of all diagnostics.

### Suppressions

A few rules are silenced inline with a reason rather than fixed, because the
warning is wrong for the element:

- `vite.config.ts` — Vite loads its config from the default export.
- `TaskModal` backdrop — click-to-close is a pointer affordance; Escape and
  Cancel are the keyboard paths.
- `TaskCard` — the card is a dnd-kit draggable; a `<button>` cannot hold its
  nested block layout, and it already exposes `role`/`tabIndex`/Enter.

### Known advisory noise

These warnings are expected for this stack and do not fail the gate:
`noNodejsModules` (Bun targets Node compatibility), `noConsole` (a CLI that
prints), `noBitwiseOperators` (uuidv7 needs them), `useTopLevelRegex`,
`noExcessiveLinesPerFunction` in `scripts/`.

## Code review checklist

- No `any` (explicit or implicit). Prefer discriminated unions and Zod-free
  type narrowing; the data contract is validated in `src/core`.
- No non-null assertions; handle `undefined` explicitly.
- All I/O goes through the repository layer (`src/core/repo.ts`); never write
  files directly from the CLI or server.
- Status transitions always record an event with `actor`.
- Function boundaries: no more than ~1 responsibility; keep modules small.
- Prefer `import type` for type-only imports.
