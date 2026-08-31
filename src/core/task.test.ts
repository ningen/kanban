import { describe, expect, it } from "bun:test";
import { appendRank, midpointRank } from "./repo";
import { parseTask, serializeTask } from "./task";
import { isValidUuidv7, uuidv7, uuidv7Timestamp } from "./uuidv7";

describe("uuidv7", () => {
  it("generates valid version-7 ids", () => {
    const id = uuidv7();
    expect(isValidUuidv7(id)).toBe(true);
  });

  it("is time-ordered (later ids sort greater)", async () => {
    const a = uuidv7();
    await new Promise((r) => setTimeout(r, 5));
    const b = uuidv7();
    expect(a < b).toBe(true);
  });

  it("extracts timestamp", () => {
    const id = uuidv7();
    const ts = uuidv7Timestamp(id);
    expect(ts).not.toBeNull();
    if (ts !== null) {
      expect(Math.abs(ts - Date.now())).toBeLessThan(10_000);
    }
  });
});

describe("task parse/serialize round-trip", () => {
  const sample = `---
id: 0192a3b4-7c00-4000-8000-000000000001
title: 四半期レビューの準備
status: doing
rank: 3.5
tags:
  - review
  - q3
created: '2026-08-30T10:00:00.000Z'
updated: '2026-08-30T10:00:00.000Z'
---

## 状況
- 数字の棚卸しがまだ。@tanaka さんの資料待ち

## 断念理由
- 来期は方針転換で不要になった
`;

  it("parses a full task file", () => {
    const task = parseTask(sample);
    expect(task.id).toBe("0192a3b4-7c00-4000-8000-000000000001");
    expect(task.title).toBe("四半期レビューの準備");
    expect(task.status).toBe("doing");
    expect(task.rank).toBe(3.5);
    expect(task.tags).toEqual(["review", "q3"]);
    expect(task.body).toContain("数字の棚卸しがまだ");
  });

  it("round-trips through serialization", () => {
    const task = parseTask(sample);
    const serialized = serializeTask(task);
    const reparsed = parseTask(serialized);
    expect(reparsed).toEqual(task);
  });
});

describe("rank math", () => {
  it("computes midpoint between neighbors", () => {
    expect(midpointRank(3, 4)).toBe(3.5);
    expect(midpointRank(2, 10)).toBe(6);
  });

  it("handles boundary ranks", () => {
    expect(midpointRank(3, null)).toBe(3 + 1024);
    expect(midpointRank(null, 4)).toBe(4 - 1024);
    expect(midpointRank(null, null)).toBe(1024);
  });

  it("computes append rank past the max", () => {
    const col = [{ rank: 1 }, { rank: 4 }, { rank: 2 }] as never[];
    expect(appendRank(col as any)).toBe(4 + 1024);
    expect(appendRank([] as any)).toBe(2048);
  });
});
