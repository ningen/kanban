---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 状態モデルに wontdo を加える

## Context and Problem Statement

仕事を進めるうちに「何かしらの事情があってやらなくなった」タスクが出てくる。これを「やらない」として残したい。既存の状態モデル (todo / doing / waiting / done) だけでは、このようなタスクを置く場所がない。

## Decision Drivers

- 「やらない」と判断したタスクを記録として残したい (断念の記録)。
- 進行中の列 (todo / doing / waiting) の邪魔をしないようにしたい。
- 断念理由を残せると、後から振り返り・分析に役立つ。

## Considered Options

- `done` にまとめてしまう
- 状態モデルに `wontdo` (断念・やらない) を加える

## Decision Outcome

Chosen option: "状態モデルに `wontdo` を加える", because `done` (完了) と「やらない」(断念) は意味が異なり、区別して残せる方が正確だから。`wontdo` は終端状態とし、`archive/` へは `done` と同じく手動移動する。

### Consequences

- Good, because 断念したタスクの記録が残り、後から「何を断念したか」を分析できる。
- Good, because イベントログに自然に `todo -> wontdo` が記録される。
- Bad, because 状態の選択肢が 1 つ増え、UI の列も 1 つ増える。

### Confirmation

- `status` の値は `todo | doing | waiting | done | wontdo`。
- `wontdo` は終端状態。UI ではグレー表示し、通常列の邪魔をしない。
- 「断念理由」は本文の自由記述 (`## 断念理由`)。frontmatter には構造化しない。

## Pros and Cons of the Options

### `done` にまとめる

- Bad, because 完了と断念は意味が異なる。断念の記録が失われる。

### `wontdo` を状態モデルに加える

- Good, because 断念を記録として残せる。
- Bad, because 状態・列が 1 つ増える。

## More Information

- 「断念理由」を構造化 (frontmatter) する案は、理由が 1 文とは限らないため見送った。分析したいときは `events.jsonl` の遷移履歴で足りる。
