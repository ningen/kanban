---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 優先度フィールドではなく列内 rank (中間値方式) で並び替え

## Context and Problem Statement

タスクの優先順位をどう表現するか。当初 `priority` (1/2/3) の数値フィールドを検討したが、利用者は「看板上で順番を入れ替えられる」方が実感に合うと判断した。各列 (todo / doing etc.) の中で並び替えたい。

## Decision Drivers

- 列の中で手動で順番を入れ替えたい。
- 他のカードを書き換えずに、1 枚の変更だけで並び替えを表現したい (競合を避ける)。
- 数値による抽象的な優先度は使わない。

## Considered Options

- `priority` を 1/2/3 の数値フィールドとして持つ
- 列内の並び順を `rank` の中間値方式で持つ

## Decision Outcome

Chosen option: "列内 `rank` (中間値方式)", because ドロップ時に前後の rank の中間値を割り当てるだけで並び替えられ、他のカードを書き換える必要がない。優先度の数値による抽象化を避け、「見た目の順序」に合致する。

### Consequences

- Good, because 並び替えが 1 枚の `rank` 変更だけで済み、競合が起きにくい。
- Good, because 「今これをやっている」順序が視覚的に詰まる。
- Bad, because 中間値を繰り返すと精度が尽きる。要所で列ごとのコンパクション (振り直し) が必要になる。

### Confirmation

- frontmatter に `priority` は持たない。
- `rank` は数値 (浮動小数点的中間値) とし、列内で昇順に並ぶ。

## Pros and Cons of the Options

### `priority` を数値フィールドで持つ

- Bad, because 抽象的な優先度を人間が管理し続ける必要があり、並び替えの感覚と合わない。

### 列内 `rank` (中間値方式)

- Good, because 並び替えの実感に合い、1 枚の変更で済む。
- Bad, because 中間値の限界に対するコンパクションが必要。

## More Information

- コンパクションは UI / CLI 側の処理。AI は rank の値を意識するだけでよい。
