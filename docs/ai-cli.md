# AI agent CLI guide

This is the contract for how an AI agent (e.g. a coding agent) operates on the
kanban board. The agent's primary interface is the `kanban` CLI (see
ADR-0008). Use the CLI rather than editing raw Markdown so that status
transitions, events, ranks, and atomic writes stay consistent.

## Setup

The CLI reads/writes the data directory referenced by `KANBAN_ROOT`
(defaults to `~/kanban`). Point it at the same root the human's web server
uses.

```sh
export KANBAN_ROOT="$HOME/kanban"
```

Run the CLI from the project directory (where `src/cli/index.ts` lives), or
install it:

```sh
bun run src/cli/index.ts <command>
```

## Data model

- Each task is one file in `tasks/<uuid>.md` (YAML frontmatter + Markdown body).
- Status is one of `todo | doing | waiting | done | wontdo`.
- `done` and `wontdo` are terminal.
- `move` records the transition in `events.jsonl` (with `actor: "ai"`).
- Order within a column is `rank` (lower = higher).

## Everyday commands

```sh
# See the board
kanban list                      # grouped by column
kanban list --status doing       # filter to one column
kanban list --json               # machine-readable JSON

# Create a task
kanban add "四半期レビューの準備" \
  --status doing --tags review,q3 --due 2026-09-04

# Inspect a single task (with its Markdown body)
kanban show <uuid>               # human view
kanban show <uuid> --json

# Move a task (records a transition)
kanban move <uuid> waiting

# Edit fields without changing the body's history
kanban edit <uuid> --title "..." --rank 3.5 --due 2026-09-10
kanban edit <uuid> --due null    # clear the due date

# Append a note to a task's body — the safe way to add progress
kanban note <uuid> "- [x] 数字の棚卸しが完了"

# Find tasks
kanban search "レビュー"
kanban search "レビュー" --json

# Summarize the board + activity (from the event log)
kanban stats                      # human view
kanban stats --period 7           # focus the weekly view on 7 days
kanban stats --json               # structured report

# Archive / delete terminal tasks
kanban archive <uuid>
kanban delete <uuid>
```

## Guidance for the agent

1. **Prefer `kanban note` to append** progress rather than overwriting the
   body. `edit --body` replaces the whole body.
2. **Use `kanban move` for status changes** — it records `actor: "ai"` in
   `events.jsonl`, which is what later statistics/analysis rely on.
3. **Use `--json` on `list`/`show`/`search`/`stats`** when you need stable fields to
   drive decisions instead of parsing human text.
4. **Use the CLI for rank ordering** (`--rank` on `add`/`edit`/`move`) rather
   than hand-editing `rank` values.
5. **Never edit `tasks/*.md` directly** unless explicitly told. The CLI keeps
   the file format, events, and atomic writes consistent.
6. **Get a UUID** from `kanban list --json` or `kanban search --json`; pass it
   as `<uuid>` to commands.

## Per-command help

```sh
kanban <command> --help    # e.g. kanban note --help
kanban help                # list all commands
```

## Roots

Data lives outside this repo by default. Set `KANBAN_ROOT` to point at the
right board. The web server (`kanban serve`) serves the same board.
