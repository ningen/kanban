---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 競合は楽観的ロック + アトミック書き込み。同一部分競合時は AI 優先

## Context and Problem Statement

人間と AI が同じタスクファイルを同時に触る状況 (UI で編集中に AI が本文を追記する、保存の瞬間に AI が書き換える等) が必ず起きる。このとき、どちらかの操作が他方の操作を消してしまう事故を防ぐ必要がある。

## Decision Drivers

- AI の作業 (進捗メモ・遷移記録) を人間のワンクリックで失いたくない。
- 単一ユーザー・ローカルなので、排他ロックやトランザクションは過剰。
- 読み書きの途中でファイルが壊れて AI が半分のファイルを読む事故を防ぎたい。

## Considered Options

- 排他ロック (編集時にロックファイルを取る)
- 最終書き込みを優先 (last-write-wins)
- 楽観的ロック + アトミック書き込み。同一部分競合時は人間の上書きを許さない (AI 優先)

## Decision Outcome

Chosen option: "楽観的ロック + アトミック書き込み。同一部分競合時は AI 優先", because 単一ユーザーでは排他ロックは過剰であり、AI の積み上げた記録を人間の上書きで消す事故を防げる。

### Consequences

- Good, because アトミック書き込み (一時ファイル → rename) で読み書き途中の破損を防げる。
- Good, because UI の保存は全文上書きではなく編集したフィールドのみ適用するため、AI が触った「編集していない部分」は失われにくい。
- Good, because 競合時は保存を中断してトーストで知らせ、「再編集」を促す。
- Bad, because AI が頻繁に同じタスクを触っていると、人間は「保存 → 競合 → 再編集」を強いられる。SSE で自動反映すれば頻度は低い。
- Bad, because 人間が自分の編集を強制適用したいときに即時反映できない (git 履歴から復元は可能)。

### Confirmation

- 書き込みは一時ファイルに書いてから rename する (POSIX のアトミック操作)。
- 保存時は開いた時からの mtime / hash 比較で競合を判定し、変更があれば上書きせず中断する。
- 競合時の人間の「強制上書き」ボタンは用意しない。

## Pros and Cons of the Options

### 排他ロック

- Good, because 競合が構造的に起きない。
- Bad, because 単一ユーザーには過剰で、編集開始から保存までの間 he タスクを他が触れない。

### last-write-wins

- Good, because 実装が最も単純。
- Bad, because 人間のワンクリックが AI の積み上げた記録を無言で消す。

### 楽観的ロック + アトミック書き込み (AI 優先)

- Good, because AI の記録を保全し、過剰なロックを避けられる。
- Bad, because 競合時の再編集が発生しうる。

## More Information

- 競合時に AI の変更が本当に間違っていた場合は、git 履歴と `events.jsonl` から復元できる。
