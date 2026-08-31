---
name: kanban-cli
description: Operate a personal kanban task board through the kanban CLI. Use when an AI agent needs to read the board, create or move tasks, append progress notes, search, or manage tasks on behalf of a human — instead of editing the underlying Markdown files directly. Covers data model, everyday commands, JSON output, and conventions for safe, auditable changes.
---

# kanban CLI

Operate the kanban board safely and consistently through the `kanban` CLI. The
CLI is the primary interface for agents: it keeps the file format, status
transitions, events, and atomic writes consistent. **Prefer the CLI over
editing `tasks/*.md` directly.**

## Setup

The CLI reads/writes the data directory referenced by `KANBAN_ROOT`
(defaults to `~/kanban`). Point it at the same root the human's web server
uses.

```sh
export KANBAN_ROOT="$HOME/kanban"
```

Run it from the project directory where the CLI lives:

```sh
# explicit path (agent-friendly)
bun run src/cli/index.ts <command>
```

Or rely on a shell alias like `kanban`.

## Data model

- Each task = one file `tasks/<uuid>.md` (YAML frontmatter + Markdown body).
- Status: `todo | doing | waiting | done | wontdo`.
- `done` and `wontdo` are terminal.
- `move` records a transition in `events.jsonl` with `actor: "ai"`.
- Order within a column is `rank` (lower = higher).
- The task file is always the source of truth; the CLI keeps it valid.

## Everyday commands

```sh
# See the board
kanban list                     # grouped by column
kanban list --status doing      # filter to one column
kanban list --json              # machine-readable JSON

# Create a task
kanban add "四半期レビューの準備" \
  --status doing --tags review,q3 --due 2026-09-04

# Inspect a task (including its Markdown body)
kanban show <uuid>              # human view
kanban show <uuid> --json

# Move a task (records a transition)
kanban move <uuid> waiting

# Edit fields without replacing the body's history
kanban edit <uuid> --title "..." --rank 3.5 --due 2026-09-10
kanban edit <uuid> --due null   # clear the due date

# Append a note to a task's body — the safe way to add progress
kanban note <uuid> "- [x] 数字の棚卸しが完了"

# Find tasks
kanban search "レビュー"
kanban search "レビュー" --json

# Archive / delete terminal tasks
kanban archive <uuid>
kanban delete <uuid>
```

## Conventions for agents

1. **Append progress with `kanban note`**, not by overwriting the body.
   `edit --body` replaces the whole body; `note` appends.
2. **Use `kanban move` for status changes** so the transition is recorded with
   `actor: "ai"` in `events.jsonl`. Human-facing statistics rely on this.
3. **Use `--json` on `list`/`show`/`search`** when you need stable fields to
   drive a decision instead of parsing human-readable text.
4. **Use `--rank` on `add`/`edit`/`move`** to control ordering rather than
   hand-editing `rank` values.
5. **Never edit `tasks/*.md` directly** unless explicitly told. Keep everything
   consistent through the CLI.
6. **Get a UUID** from `kanban list --json` or `kanban search --json`; pass it
   as `<uuid>`.

## Getting a UUID

```sh
kanban list --json          # -> parse "id" fields
kanban search "topic" --json
kanban show <uuid> --json   # verify before mutating
```

## Per-command help

```sh
kanban <command> --help     # e.g. kanban note --help
kanban help                 # all commands
```

## Roots and note on the web UI

The web server (`kanban serve`) serves the same board the CLI reads/writes, so
any change you make appears live (the browser auto-reloads via SSE). Data lives
outside this repo by default; set `KANBAN_ROOT` to point at the right board.
