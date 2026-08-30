---
status: accepted
date: 2026-08-30
decision-makers: [ningen]
consulted: []
informed: []
---

# 技術スタック: Bun + Hono、Vite + React + dnd-kit

## Context and Problem Statement

サーバーとフロントエンドの技術スタックをどうするか。このツールはローカル単一ユーザーで、ファイル読み書き・watch・SSE、カンバンのドラッグ&ドロップが中心処理となる。

## Decision Drivers

- ファイル操作とローカルサーバーが得意な言語にしたい。
- フロントエンドでカンバンのドラッグ&ドロップを最良のライブラリで実現したい (UX 優先)。
- データ契約 (frontmatter の型) をサーバーとブラウザで共有したい。

## Considered Options

- Next.js
- Electron / Tauri (デスクトップアプリ)
- Bun + Hono + vanilla TS
- Bun + Hono + Vite + React + dnd-kit

## Decision Outcome

Chosen option: "Bun + Hono + Vite + React + dnd-kit", because ドラッグ&ドロップの定番ライブラリ `dnd-kit` が React 前提でカンバン操作の実績が最も豊富。型をサーバーとブラウザで共有でき、単一コマンドでローカルサーバーを立てられる。

### Consequences

- Good, because カンバンのコア操作 (列間ドラッグで status と rank を計算) を dnd-kit の `onDragEnd` に委ねられる。
- Good, because frontmatter のスキーマ型をサーバー/UI/CLI で共有できる。
- Bad, because React を導入する分、複雑さが増す。ルーター・状態管理ライブラリは入れず `useState` + SSE で抑える。

### Confirmation

- サーバーは Bun + Hono + TypeScript。
- フロントは Vite + React + TypeScript、`dnd-kit` でドラッグ&ドロップ。
- UI はボード 1 画面 + 編集モーダル 1 個を超える複雑さを持たない。

## Pros and Cons of the Options

### Next.js

- Good, because 開発体験が良い。
- Bad, because ローカルツールにはオーバーキル。クライアント/サーバー分離の重みが余計。

### Electron / Tauri

- Good, because デスクトップアプリとして完成度が高い。
- Bad, because ブラウザツールの方が AI との契約 (ファイル操作) に素直に繋がる。

### Bun + Hono + vanilla TS

- Good, because 依存が最小で軽い。
- Bad, because UX 重視のカンバンドラッグ&ドロップを手書きする複雑さが生まれる。

### Bun + Hono + Vite + React + dnd-kit

- Good, because カンバン UX を完成度の高いライブラリで実現できる。
- Bad, because React の複雑さが加わる。

## More Information

-「ユーザ体験を優先したい」という要件から React を採用した。React の軽量化が必要なら Preact などへの代替を検討できるが、dnd-kit との互換を保てるか要検証。
