---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# AI の主体インターフェースは CLI

## Context and Problem Statement

AI agent が裏でタスクを操作する経路をどうするか。当初は「裏で保存されているテキストファイルを直接触る」ことで実現する想定だった。しかしファイルを直接いじると、競合制御や `events.jsonl` への記録の整合を AI 側でも守る必要が生じ、決定論的でなくなる。

## Decision Drivers

- 状態遷移や統計データをきちんと記録したい。
- AI に決定論的な動作をさせる。生の Markdown 編集は解釈の幅が広く、非決定的。
- ファイルは常に「正」である事実は保ちたい (手動で直接書いても動く柔軟性を残す)。

## Considered Options

- AI は生の Markdown を直接書く (ファイル直接書き込みが主)
- AI の主経路を CLI にする (ファイル直接書きにも対応するが主ではない)
- AI は必ず CLI を使い、直接書き込みは禁止

## Decision Outcome

Chosen option: "AI の主経路を CLI にする", because CLI が frontmatter のスキーマ検証・rank の計算・`events.jsonl` への記録・アトミック書き込みを肩代わりし、決定論的な操作を担保できる。`move` が状態遷移を明示して記録する。ただし `tasks/*.md` は常に正なので、直接書き込んでも動く (硬い制約にはしない)。

### Consequences

- Good, because AI の操作が決定論的になり、遷移・統計データが正確に記録される。
- Good, because 競合制御・イベントログの整合を CLI に閉じ込められる。
- Bad, because CLI の実装と維持が必要になる。

### Confirmation

- CLI には `list / add / edit / move / search / archive / serve` を備える。
- `move` は状態遷移を明示し、`events.jsonl` に `from` / `to` を記録する。

## Pros and Cons of the Options

### 生の Markdown を直接書く

- Good, because 実装が少ない。
- Bad, because 競合制御・イベントログの整合を AI 側で守る必要があり、非決定的。

### 主経路を CLI にする

- Good, because 決定論的で、スキーマ検証・イベント記録を CLI に任せられる。
- Bad, because CLI の実装が必要。

### 必ず CLI (直接書き込み禁止)

- Good, because 制約が最も強い。
- Bad, because 人がファイルを手で直しても動く、という柔軟性を損なう。単一ユーザーでは不要な制約。

## More Information

- 将来、AI agent 向けの利用手順を `docs/` に明文化する予定。この ADR がその根拠になる。
