# kanban

Personal task management. Human via Web UI, AI agent via CLI, plain-text Markdown as source of truth.

Single-user, local, no auth.

## Concept

- **Human** uses a kanban board in the browser to reorder and transition cards.
- **AI agent** uses the `kanban` CLI for deterministic operations, recording transitions and statistics safely.
- **Source of truth is plain text.** The UI and CLI both read/write the same `tasks/*.md`. The text file is the shared contract between human and AI.

The AI's primary path is the CLI. `tasks/*.md` remains the source of truth, but letting the AI touch raw Markdown would require it to also honor concurrency control and event-log consistency. Confining to the CLI makes behavior deterministic.

## Architecture overview

```
┌──────────────┐      ┌──────────────┐
│  Web UI      │      │  CLI          │
│ (React)      │      │ (AI agent)    │
└──────┬───────┘      └──────┬───────┘
       │                      │
       ▼                      ▼
   Bun + Hono server
       │  read/write / watch / SSE
       ▼
   tasks/<uuidv7>.md  ←── source of truth
   archive/           ←── archived
   events.jsonl       ←── append-only transition/operation log
```

The UI, CLI, and server all share the same data contract. The files are always the source of truth, and the event log is accumulated as a byproduct.

## Data contract

### Directory structure

```
kanban/
├─ tasks/
│   └─ <uuidv7>.md        # current state only (source of truth)
├─ archive/               # after completion (manual move)
└─ events.jsonl           # append-only log (generic field/from/to)
```

### Task file

1 task = 1 file. Filename is the immutable ID `<uuidv7>.md`. Renaming a task does not change the filename; searching uses grep + UI cache.

```markdown
---
id: 019...uuidv7
title: 四半期レビューの準備
status: doing        # todo | doing | waiting | done | wontdo
rank: 3.5            # in-column order (midpoint)
tags: [review, q3]
created: 2026-08-30
updated: 2026-09-01
completed: null      # date it became done
---

## 状況
- ...

## 断念理由
- ... (wontdo, optional)
```

- **frontmatter** = structured fields for machine read. Kept minimal.
- **body** = free-form space for AI and human notes/progress/judgment.

### Status model

| status    | meaning                              | board display       |
|-----------|--------------------------------------|---------------------|
| `todo`    | not started                          | normal column       |
| `doing`   | in progress (optimally one)          | normal column       |
| `waiting` | waiting on others / condition        | normal column       |
| `done`    | complete (terminal). hidden after 7d | normal (≤7 days)    |
| `wontdo`  | declined (terminal). grey             | grey column         |

- `done` / `wontdo` → `archive/` move is manual (archive button).
- `wontdo` reason is free-form in the body, not structured in frontmatter.

### Ordering (rank)

- No `priority` field. In-column order is `rank`.
- Dropping between A and B assigns the midpoint rank.
- Only one card's `rank` changes per reorder → fewer races.
- Midpoint repetition loses precision; periodic compaction per column is a UI-side concern.

### Event log (events.jsonl)

State transitions/operations are separated from frontmatter into an append-only `events.jsonl` so structural analysis ("how many did the AI move to `waiting` in March") becomes possible.

```jsonl
{"ts":"2026-08-30T10:00Z","task":"019...","field":"status","from":"todo","to":"doing","actor":"ui"}
```

- Recording: the AI only touches Markdown; a file watcher diffs `status` changes and appends automatically. The log is a byproduct.
- `actor`: `ui` | `ai`, so AI involvement can be audited and quantified.
- Generic `field`/`from`/`to` shape means it can later capture `rank`/`title` changes.

## Concurrency control

Human+AI simultaneous edits are handled with optimistic locking + auto-reload, no exclusive locks.

- Writes are atomic (temp file → rename).
- UI saves patch only the edited fields, not full overwrite → untouched fields edited by AI survive.
- On save, mtime/hash compared since open; if changed, it's a conflict.
- **On conflict**: abort the save, refresh UI, notify via toast. **No human overwrite allowed** (protects AI changes). `git` and `events.jsonl` preserve history for restore.
- Browser watches files via SSE and receives AI changes in real time.

## Web UI (Vite + React + TypeScript)

One screen. The board is the star; editing happens in a modal.

```
┌────────────────────────────────────────────────────────┐
│  kanban                              [🔍] [🏷]          │
├─────────┬─────────┬─────────┬─────────┬───────────────┤
│ TODO    │ DOING   │ WAITING │ DONE    │ WONT DO       │
│ [+add]  │ [+add]  │ [+add]  │ (7d)    │ [+add] (grey) │
└─────────┴─────────┴─────────┴─────────┴───────────────┘
```

Features (MVP):

1. **Card display** — title, rank order, tags, due. `done` only ≤7 days.
2. **Drag & drop across columns** — `dnd-kit`; recomputes `status` + `rank`.
3. **Add task** — via `+ 追加`; modal creates a new file.
4. **Click card → edit modal** — title/tag/due/body. Concurrency check runs here.
5. **Archive button** — move `done`/`wontdo` to `archive/`.
6. **Search & tag filter** — header search box + tag chips.
7. **SSE auto-reload** — reflects AI changes live.

Deferred: calendar, Gantt, stats dashboard (after `events.jsonl` fills), multi-user/permissions/mobile, due reminders.

- No router or state-management library. `useState` + server SSE only.
- UI = one board + one modal.

## Server (Bun + Hono + TypeScript)

- File read/write, watch, SSE, atomic writes, `events.jsonl` appends.
- Start: `kanban` → starts server → auto-opens `localhost:3000`.

## CLI

The AI's primary path, usable by humans. `move` explicitly records the transition to `events.jsonl`. `--json` emits structured JSON for programmatic use.

```
kanban list                        # tree view
kanban list --status doing        # filter
kanban list --json                # structured JSON

kanban show <uuid>                # task detail (with body)
kanban show <uuid> --json

kanban add "Title" \
  --status todo --rank 1 --tags review --due 2026-09-04

kanban edit <uuid> --status doing --rank 3.5 --due 2026-09-10

kanban move <uuid> doing        # record transition

kanban note <uuid> "progress…"   # append a Markdown note to the body

kanban search "query"
kanban search "query" --json

kanban archive <uuid>

kanban serve
```

## Agent skill

An AI agent can be taught to operate the board correctly with a reusable
**skill** (a `SKILL.md` in [Agent Skills](https://agentskills.io) format) shipped
in this repo under `skills/kanban-cli/`. It encodes the data model, the
everyday commands, the `--json`/`note` conventions, and the rule to use the CLI
rather than edit raw Markdown.

Install it anywhere with the [Skills CLI](https://skills.sh):

```sh
# list the skill
npx skills add ningen/kanban --list

# install for a specific agent (e.g. Codex), global scope
npx skills add ningen/kanban --skill kanban-cli -g -a codex -y
```

- Use `-g` for global (`~/<agent>/skills/`) or omit for project scope.
- Use `-a` to target an agent (opencode, codex, claude-code, cursor, ...).
- See `docs/ai-cli.md` for the underlying CLI guide.

## Tech stack

| layer     | tech                         | why |
|-----------|------------------------------|-----|
| server    | Bun + Hono + TypeScript      | file ops/watch/SSE, fast start, CLI-friendly |
| frontend  | Vite + React + TypeScript    | `dnd-kit` board, share types with server |
| drag/drop | dnd-kit                      | best-in-class kanban drag |
| data      | local Markdown               | source of truth; git = history/backup |

## Quality gate

The repo enforces high code quality with a strict, gated toolchain. See `docs/quality.md` for details.

- **TypeScript**: strictest `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, no unused locals/params, ...).
- **Lint + format**: [Biome](https://biomejs.dev) with `recommended` + all-rules-on categories (`suspicious`, `correctness`, `style`, `complexity`, `performance`).
- **Tests + coverage**: `bun test` plus a deterministic gate (`scripts/check-coverage.ts`) that enforces lines/functions ≥90% globally and per-file.
- **Commit gate**: `.githooks/pre-commit` runs `typecheck + biome + test:coverage`; git hooks are wired via `core.hooksPath`.

```sh
bun run quality    # typecheck + biome check + tests with coverage
```

## Development

```sh
bun install
bun run test           # unit tests
bun run typecheck      # strict type check
bun run check:all      # biome lint + format check
bun run quality        # everything, as the commit gate does
```

## Directory layout

```
kanban/
├─ .githooks/          # git hooks (pre-commit quality gate)
├─ docs/
│  ├─ adr/             # Architecture Decision Records
│  ├─ ai-cli.md        # AI agent CLI guide
│  ├─ design-system.md # UI design tokens & primitives
│  └─ quality.md       # toolchain & policy
├─ scripts/
│  └─ check-coverage.ts  # deterministic coverage gate (parses lcov)
├─ skills/
│  └─ kanban-cli/      # installable agent skill (npx skills add)
├─ src/
│  ├─ core/            # data contract: schema, repo, operations, uuidv7
│  ├─ cli/             # kanban CLI
│  ├─ server/          # Bun + Hono (SSE)
│  └─ ui/              # Vite + React frontend (own package)
├─ tasks/ archive/ events.jsonl   # runtime data (gitignored)
├─ biome.json
├─ bunfig.toml
├─ tsconfig.json
└─ package.json
```

## Related docs

- Architecture decisions are persisted in `docs/adr/`.
- The AI agent's CLI operating guide is in `docs/ai-cli.md`.
- The UI design system (tokens, primitives, semantics) is documented in `docs/design-system.md`.
- Code quality and the toolchain are documented in `docs/quality.md`.
- A handoff note for the next agent (deferred features, UX candidates, env quirks) is in `docs/handoff.md`.
