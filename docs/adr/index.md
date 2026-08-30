# Architecture Decision Records

このディレクトリには、kanban のアーキテクチャ上の決定を ADR (Architecture Decision Record) として永続化する。

## ルール

- 各 ADR は `NNNN-short-title.md` の連番命名。`NNNN` は 4 桁連番で、一度採番したら再利用しない。
- 1 つの ADR は 1 つのアーキテクチャ決定を扱う。複数の決定を 1 ファイルに混ぜない。
- フォーマットは [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/) の標準テンプレートに準拠する。
- `status` は `proposed | accepted | rejected | deprecated | superseded`。決定が覆されたときは、その ADR を `superseded by ADR-NNNN` に変更し、新しい ADR を作る。過去の ADR は削除・書き換えしない (履歴を残す)。
- 日付は ISO 8601 (`YYYY-MM-DD`)。

## インデックス

一覧は `docs/adr/README.md` を参照。数が増えたら、ここ/README の一覧表で管理する。

| ADR | タイトル | 状態 |
|-----|---------|------|
| [0001](./0001-local-single-user-and-markdown-source-of-truth.md) | ローカル単一ユーザー構成と Markdown を正とするアーキテクチャ | accepted |
| [0002](./0002-one-task-one-uuidv7-markdown-file.md) | 1 タスク 1 Markdown ファイル、ファイル名は UUIDv7 | accepted |
| [0003](./0003-event-log-in-events-jsonl.md) | 状態履歴は events.jsonl に分離。汎用 field/from/to 形式 | accepted |
| [0004](./0004-column-rank-instead-of-priority.md) | 優先度フィールドではなく列内 rank (中間値方式) で並び替え | accepted |
| [0005](./0005-add-wontdo-status.md) | 状態モデルに wontdo を加える | accepted |
| [0006](./0006-optimistic-concurrency-and-atomic-writes.md) | 競合は楽観的ロック + アトミック書き込み。同一部分競合時は AI 優先 | accepted |
| [0007](./0007-tech-stack-bun-hono-react.md) | 技術スタック: Bun + Hono、Vite + React + dnd-kit | accepted |
| [0008](./0008-cli-as-primary-ai-interface.md) | AI の主体インターフェースは CLI | accepted |
