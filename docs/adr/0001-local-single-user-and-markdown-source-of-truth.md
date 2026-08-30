---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []  # なし (単一ユーザー)
informed: []
---

# ローカル単一ユーザー構成と Markdown を正とするアーキテクチャ

## Context and Problem Statement

個人用のタスク管理ツールを作りたい。人間は Web UI から確認・編集し、AI agent が裏で作業する。このとき、人間と AI が同じデータを操作するための「共通契約」をどうするか。また、ツールをどこで動かし、データの正を何に置くか。

## Decision Drivers

- 単一ユーザーで、複数人が同時に触るユースケースはない。
- AI agent がテキストファイルを直接扱える形にしたい (AI の親和性)。
- データの履歴・バックアップを git で面倒なく残したい。

## Considered Options

- デプロイ型 (リモートサーバーに載せる)
- ブラウザのみ (localStorage に保存)
- ローカル単一ユーザー + ローカルの Markdown ファイルを正とする

## Decision Outcome

Chosen option: "ローカル単一ユーザー + Markdown を正とする", because 単一ユーザー要件に合致し、AI agent が同じリポジトリのファイルを直接触れる。「テキストファイルを触る」というコンセプトを最も素直に実現できる。

### Consequences

- Good, because 認証・DB・マルチテナント・リアルタイム同期が MVP から全部消える。
- Good, because git がそのまま履歴・バックアップ・監査になる。
- Bad, because 外出先からアクセスできない (ローカルのみ)。
- Bad, because 人間と AI が同時にファイルを触るため、競合制御が必須になる (ADR-0006)。

## Confirmation

- データはリポジトリ内の `tasks/*.md` に存在し、DB や外部ストレージに置かないこと。
- サーバーはローカルでのみ起動し、認証を持たないこと。

## More Information

- 開発当初は `localhost` での起動のみを想定。将来、外出先から見たい場合は別途 ADR を起こす。
