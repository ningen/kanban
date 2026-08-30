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

Rules are set to `recommended` plus all-rules-on in these categories:

- `suspicious` (incl. `noExplicitAny`, `useAwait`)
- `correctness`
- `style` (incl. `noNonNullAssertion`, `noParameterAssign`, `noDefaultExport`)
- `complexity`
- `performance`

Conventions: double quotes, semicolons, trailing commas, arrow-parentheses
always, 2-space indent, 100-column line width, LF endings, import sorting.

## Code review checklist

- No `any` (explicit or implicit). Prefer discriminated unions and Zod-free
  type narrowing; the data contract is validated in `src/core`.
- No non-null assertions; handle `undefined` explicitly.
- All I/O goes through the repository layer (`src/core/repo.ts`); never write
  files directly from the CLI or server.
- Status transitions always record an event with `actor`.
- Function boundaries: no more than ~1 responsibility; keep modules small.
- Prefer `import type` for type-only imports.
