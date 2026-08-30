import { describe, expect, it } from "bun:test";
import { parseDate, formatDate, monthGrid, shiftMonth, todayValue } from "./calendar";

describe("parseDate", () => {
  it("parses YYYY-MM-DD", () => {
    const d = parseDate("2026-08-30");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7); // Aug
    expect(d?.getDate()).toBe(30);
  });

  it("returns null for invalid input", () => {
    expect(parseDate("nope")).toBeNull();
    expect(parseDate("2026-13-40")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats a Date to YYYY-MM-DD with zero padding", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("monthGrid", () => {
  it("builds a grid with leading blanks and the right day count", () => {
    // Aug 2026 starts on a Saturday (getDay 6).
    const grid = monthGrid(2026, 7);
    expect(grid[0]).toBe("");
    expect(grid.length).toBe(6 + 31);
    // days start after the offset
    expect(grid[6]).toBe("2026-08-01");
    expect(grid[grid.length - 1]).toBe("2026-08-31");
  });
});

describe("shiftMonth", () => {
  it("moves across a year boundary", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual([2027, 0]);
    expect(shiftMonth(2026, 0, -1)).toEqual([2025, 11]);
  });
});

describe("todayValue", () => {
  it("returns today in YYYY-MM-DD", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayValue()).toBe(expected);
  });
});
