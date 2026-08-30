---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 1 タスク 1 Markdown ファイル、ファイル名は UUIDv7

## Context and Problem Statement

タスクデータをどう分割して保存するか。1 つの大きなファイルに全てをまとめるか、タスクごとにファイルを分けるか。また、ファイル名 (= ID) に何を使うか。

## Decision Drivers

- UI と AI が同時に触っても、競合の爆発半径を小さくしたい。
- AI が部分読み出し (grep や 1 ファイル単位の読み書き) でき、全件をコンテキストに載せなくて済むようにしたい。
- ID は、生成の衝突を避けつつ、辞書順がほぼ時系列になるものがよい。

## Considered Options

- 単一の `tasks.md` に全タスクをまとめる
- 1 タスク 1 ファイル、ファイル名を連番 (0001) にする
- 1 タスク 1 ファイル、ファイル名をタイムスタンプ + slug にする
- 1 タスク 1 ファイル、ファイル名を UUIDv7 にする

## Decision Outcome

Chosen option: "1 タスク 1 Markdown ファイル、ファイル名は `<uuidv7>.md`", because 競合の爆発半径が 1 ファイルに閉じ、AI の部分読み出し・git 履歴の追跡が容易になる。UUIDv7 は生成に調整が不要で、先頭がミリ秒タイムスタンプのため辞書順が作成順になり、連番の利点 (順序) を残しつつ衝突の懸念を消せる。

### Consequences

- Good, because 競合が高々 1 ファイルに閉じる。
- Good, because `git log -- tasks/<uuid>.md` がそのタスクの来歴になる。
- Good, because 完成タスクは `archive/` に移動するだけでよく、ボードが軽く保てる。
- Bad, because タイトルをファイル名からは引けない (grep + UI キャッシュで代替)。
- Bad, because 1000 タスクを超えるとファイル数が多く、コンパクションや一覧の負荷対策が必要になる。

## Confirmation

- ファイル名は `<uuidv7>.md` のみで、タイトルや slug を含めない。
- タイトル変更でファイル名は変わらない (不変 ID)。
- 将来の CLI は「ページをまたいだ検索」を担い、ファイル名の可読性の不足を補う。

## More Information

- タスクファイルの内容 (frontmatter + 本文) は README.md のデータ契約を参照。
