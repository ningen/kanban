---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 状態履歴は events.jsonl に分離する。汎用 field/from/to 形式

## Context and Problem Statement

状態の遷移 (todo → doing など) の履歴をどう残すか。最初は履歴をタスクファイルの frontmatter や本文の `## History` 節に残す案があったが、後から「◯月に AI が何件を `waiting` に動かしたか」といった構造化した分析ができないことが問題として挙がった。

## Decision Drivers

- 状態遷移や操作を、後から構造化して分析できる形で残したい。
- 誰が操作したか (`actor`: ui | ai) を記録したい。AI の関与を定量化するため。
- タスクファイルは「現在状態」だけの正としてシンプルに保ちたい。

## Considered Options

- 履歴を frontmatter に入れる
- 履歴をタスクファイル本文の `## History` 節に入れる
- 追記専用の別ファイル `events.jsonl` に分離する

## Decision Outcome

Chosen option: "追記専用の `events.jsonl` に分離する", because 履歴と現在状態を分離でき、`events.jsonl` は追記専用のため構造化分析に適し、`actor` も持たせられる。「断念理由」のような自由記述だけはタスクファイル本文に残す。

### Consequences

- Good, because 状態遷移を構造化して後から分析できる。
- Good, because `actor: ui|ai` で「誰がどう動かしたか」を監査・定量化できる。
- Bad, because 第 2 の書き込み先が増えるため、競合制御の対象になる (ADR-0006)。
- Bad, because `events.jsonl` は単調に増え続ける。将来的にはローテーションやアーカイブを検討する。

### Confirmation

- イベントは汎用形式 `{ts, task, field, from, to, actor}` を持つ。
- 初版は `field: status` のみ自動記録する。UI を介した `rank` / `title` 変更は見送るが、汎用形式なので後から拡張できる。
- AI は Markdown だけを編集し、ウォッチャーが diff で変化を検知して自動追記する (ログは副産物)。

## Pros and Cons of the Options

### 履歴を frontmatter に入れる

- Good, because タスクファイルに履歴が同居する。
- Bad, because 構造化分析がしにくく、増え続ける履歴が frontmatter を汚す。

### 履歴を本文の `## History` 節に入れる

- Good, because AI も人間もファイルを開くだけで読める。
- Bad, because 構造化した分析ができない。

### 追記専用の `events.jsonl` に分離する

- Good, because 構造化分析に適し、`actor` を持たせられる。
- Bad, because 書き込み先が増える。

## More Information

- 将来、`events.jsonl` を読み込んで統計ダッシュボードを出す想定。
