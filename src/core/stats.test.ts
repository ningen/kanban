import { describe, expect, it } from "bun:test";
import process from "node:process";
import { type DwellByStatus, type LeadTime, summarize, type TransitionCount } from "./stats";
import type { Event, Status, Task } from "./task";

// The report anchors "today" and week boundaries to the machine's local time.
// Pin the timezone to UTC so the date-based assertions below are deterministic
// regardless of the machine running the suite.
process.env.TZ = "UTC";

/** Build a Task with sensible defaults; only set `due`/`body` when asked. */
function t(partial: Partial<Task> & { id: string; status: Status }): Task {
  return {
    id: partial.id,
    title: partial.title ?? "task",
    status: partial.status,
    rank: partial.rank ?? 1,
    tags: partial.tags ?? [],
    created: partial.created ?? "2026-08-30T00:00:00.000Z",
    updated: partial.updated ?? "2026-08-30T00:00:00.000Z",
    ...(partial.due !== undefined ? { due: partial.due } : {}),
  };
}

describe("stats: current board", () => {
  it("counts by status, overdue, and WIP", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const tasks: Task[] = [
      t({ id: "a", status: "todo", due: "2026-08-01" }), // overdue
      t({ id: "b", status: "todo", due: "2026-09-10" }), // not overdue
      t({ id: "c", status: "doing" }), // WIP
      t({ id: "d", status: "waiting", due: "2026-08-20" }), // overdue
      t({ id: "e", status: "done", due: "2026-08-01" }), // terminal -> not overdue
      t({ id: "f", status: "wontdo" }),
    ];
    const report = summarize([], tasks, { now });
    expect(report.board).toEqual({
      byStatus: { todo: 2, doing: 1, waiting: 1, done: 1, wontdo: 1 },
      total: 6,
      active: 4,
      done: 2,
      doing: 1,
      overdue: 2,
    });
  });

  it("flags done/wontdo as not overdue even when their due date passed", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const tasks: Task[] = [
      t({ id: "x", status: "done", due: "2026-01-01" }),
      t({ id: "y", status: "wontdo", due: "2026-01-01" }),
    ];
    const report = summarize([], tasks, { now });
    expect(report.board.overdue).toBe(0);
    expect(report.board.done).toBe(2);
  });
});

describe("stats: weekly throughput", () => {
  it("buckets created and done by week, ignoring out-of-window and non-status events", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    // Window is [now-7d, now] -> two Monday buckets: 08-24 and 08-31.
    const events: Event[] = [
      { ts: "2026-08-25T00:00:00.000Z", task: "c1", field: "status", to: "todo", actor: "ui" }, // creation
      {
        ts: "2026-08-26T00:00:00.000Z",
        task: "c1",
        field: "status",
        from: "doing",
        to: "done",
        actor: "ai",
      },
      { ts: "2026-08-31T06:00:00.000Z", task: "c2", field: "status", to: "todo", actor: "ui" }, // creation
      { ts: "2026-08-20T00:00:00.000Z", task: "old", field: "status", to: "todo", actor: "ui" }, // outside window
      { ts: "2026-08-25T00:00:00.000Z", task: "x", field: "rank", from: "1", to: "2", actor: "ai" }, // non-status
    ];
    const report = summarize(events, [], { now, periodDays: 7 });
    expect(report.periodDays).toBe(7);
    const weekly = report.throughput.weekly;
    expect(weekly.map((w) => w.weekStart)).toEqual(["2026-08-24", "2026-08-31"]);
    expect(weekly).toEqual([
      { weekStart: "2026-08-24", created: 1, done: 1 },
      { weekStart: "2026-08-31", created: 1, done: 0 },
    ]);
  });

  it("emits zeroed weekly buckets across the period window when there is no activity", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const report = summarize([], [], { now, periodDays: 7 });
    expect(report.throughput.weekly).toEqual([
      { weekStart: "2026-08-24", created: 0, done: 0 },
      { weekStart: "2026-08-31", created: 0, done: 0 },
    ]);
  });

  it("ignores an event with an invalid timestamp", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const events: Event[] = [
      { ts: "not-a-date", task: "x", field: "status", to: "todo", actor: "ui" },
    ];
    const report = summarize(events, [], { now, periodDays: 7 });
    const total = report.throughput.weekly.reduce((n, w) => n + w.created + w.done, 0);
    expect(total).toBe(0);
  });
});

function leadReport(events: Event[]): LeadTime {
  return summarize(events, [], { now: new Date("2026-09-30T00:00:00.000Z") }).throughput.leadTime;
}

function creation(task: string, ts: string): Event {
  return { ts, task, field: "status", to: "todo", actor: "ui" };
}
function doneEvt(task: string, ts: string): Event {
  return { ts, task, field: "status", from: "doing", to: "done", actor: "ai" };
}

describe("stats: lead time", () => {
  it("computes avg/median/p90/min/max over completed tasks (odd sample)", () => {
    const events: Event[] = [
      creation("L1", "2026-08-01T00:00:00.000Z"),
      doneEvt("L1", "2026-08-03T00:00:00.000Z"), // 48h
      creation("L2", "2026-08-02T00:00:00.000Z"),
      doneEvt("L2", "2026-08-03T00:00:00.000Z"), // 24h
      creation("L3", "2026-08-03T00:00:00.000Z"),
      doneEvt("L3", "2026-08-03T00:00:00.000Z"), // 0h
      creation("L4", "2026-08-04T00:00:00.000Z"), // never done -> excluded
      doneEvt("L5", "2026-08-05T00:00:00.000Z"), // no creation -> excluded
    ];
    const lt = leadReport(events);
    expect(lt.sample).toBe(3);
    expect(lt.avgHours).toBe(24);
    expect(lt.medianHours).toBe(24);
    expect(lt.p90Hours).toBe(43.2);
    expect(lt.minHours).toBe(0);
    expect(lt.maxHours).toBe(48);
  });

  it("handles an even sample count (double median + interpolated p90)", () => {
    const events: Event[] = [
      creation("L6", "2026-08-01T00:00:00.000Z"),
      doneEvt("L6", "2026-08-03T00:00:00.000Z"), // 48h
      creation("L7", "2026-08-02T00:00:00.000Z"),
      doneEvt("L7", "2026-08-03T00:00:00.000Z"), // 24h
      creation("L8", "2026-08-02T12:00:00.000Z"),
      doneEvt("L8", "2026-08-03T00:00:00.000Z"), // 12h
      creation("L9", "2026-08-01T12:00:00.000Z"),
      doneEvt("L9", "2026-08-03T00:00:00.000Z"), // 36h
    ];
    const lt = leadReport(events);
    expect(lt.sample).toBe(4);
    expect(lt.medianHours).toBe(30); // (24+36)/2
    expect(lt.avgHours).toBe(30); // (48+24+12+36)/4
    expect(lt.p90Hours).toBe(44.4); // 36 + 0.7*(48-36)
    expect(lt.minHours).toBe(12);
    expect(lt.maxHours).toBe(48);
  });

  it("returns a zeroed lead time when nothing completed", () => {
    const events: Event[] = [creation("L0", "2026-08-01T00:00:00.000Z")];
    const lt = leadReport(events);
    expect(lt).toEqual({
      sample: 0,
      avgHours: 0,
      medianHours: 0,
      p90Hours: 0,
      minHours: 0,
      maxHours: 0,
    });
  });
});

describe("stats: dwell time", () => {
  it("accumulates time in each status and does not inflate terminal states", () => {
    const now = new Date("2026-08-31T12:00:00.000Z");
    const events: Event[] = [
      // D1: todo -> doing -> done (terminal, no tail)
      { ts: "2026-08-30T00:00:00.000Z", task: "D1", field: "status", to: "todo", actor: "ui" },
      {
        ts: "2026-08-30T10:00:00.000Z",
        task: "D1",
        field: "status",
        from: "todo",
        to: "doing",
        actor: "ui",
      },
      {
        ts: "2026-08-31T06:00:00.000Z",
        task: "D1",
        field: "status",
        from: "doing",
        to: "done",
        actor: "ai",
      },
      // D2: still active in todo -> tail extends to now
      { ts: "2026-08-30T00:00:00.000Z", task: "D2", field: "status", to: "todo", actor: "ui" },
      // D3: created doing -> done -> archived (counts time in done until archive)
      { ts: "2026-08-29T00:00:00.000Z", task: "D3", field: "status", to: "doing", actor: "ui" },
      {
        ts: "2026-08-29T20:00:00.000Z",
        task: "D3",
        field: "status",
        from: "doing",
        to: "done",
        actor: "ai",
      },
      {
        ts: "2026-08-29T22:00:00.000Z",
        task: "D3",
        field: "status",
        from: "done",
        to: "archived",
        actor: "ui",
      },
    ];
    const report = summarize(events, [], { now });
    const get = (status: Status): DwellByStatus =>
      report.dwell.find((d) => d.status === status) as DwellByStatus;
    expect(get("todo")).toEqual({ status: "todo", visits: 2, totalHours: 46, avgHours: 23 });
    expect(get("doing")).toEqual({ status: "doing", visits: 2, totalHours: 40, avgHours: 20 });
    expect(get("waiting")).toEqual({ status: "waiting", visits: 0, totalHours: 0, avgHours: 0 });
    expect(get("done")).toEqual({ status: "done", visits: 2, totalHours: 2, avgHours: 1 });
    expect(get("wontdo")).toEqual({ status: "wontdo", visits: 0, totalHours: 0, avgHours: 0 });
  });
});

describe("stats: transitions", () => {
  it("ranks status moves by frequency and splits activity by actor", () => {
    const events: Event[] = [
      {
        ts: "2026-08-30T01:00:00.000Z",
        task: "t",
        field: "status",
        from: "todo",
        to: "doing",
        actor: "ui",
      },
      {
        ts: "2026-08-30T02:00:00.000Z",
        task: "t",
        field: "status",
        from: "doing",
        to: "done",
        actor: "ai",
      },
      {
        ts: "2026-08-30T03:00:00.000Z",
        task: "t2",
        field: "status",
        from: "todo",
        to: "doing",
        actor: "ai",
      },
      { ts: "2026-08-29T00:00:00.000Z", task: "t3", field: "status", to: "todo", actor: "ui" }, // creation
      {
        ts: "2026-08-30T04:00:00.000Z",
        task: "t4",
        field: "status",
        from: "done",
        to: "doing",
        actor: "ai",
      },
      {
        ts: "2026-08-30T05:00:00.000Z",
        task: "t5",
        field: "status",
        from: "doing",
        to: "waiting",
        actor: "ui",
      },
    ];
    const report = summarize(events, [], { now: new Date("2026-09-30T00:00:00.000Z") });
    const { byMove, byActor } = report.transitions;
    const top = byMove[0] as TransitionCount;
    expect(top).toEqual({ from: "todo", to: "doing", count: 2 });
    expect(byMove).toHaveLength(4);
    expect(byMove.map((m) => `${m.from}->${m.to}`)).toEqual([
      "todo->doing",
      "doing->done",
      "done->doing",
      "doing->waiting",
    ]);
    expect(byActor).toEqual({ ui: 3, ai: 3 });
  });
});

describe("stats: empty + options", () => {
  it("returns a zeroed report for no events and no tasks", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const report = summarize([], [], { now });
    expect(report.generatedAt).toBe(now.toISOString());
    expect(report.periodDays).toBe(30);
    expect(report.board).toEqual({
      byStatus: { todo: 0, doing: 0, waiting: 0, done: 0, wontdo: 0 },
      total: 0,
      active: 0,
      done: 0,
      doing: 0,
      overdue: 0,
    });
    expect(report.throughput.weekly.length).toBeGreaterThan(0);
    expect(report.throughput.weekly.every((w) => w.created === 0 && w.done === 0)).toBe(true);
    expect(report.throughput.leadTime.sample).toBe(0);
    expect(report.dwell).toHaveLength(5);
    expect(report.transitions.byMove).toEqual([]);
    expect(report.transitions.byActor).toEqual({ ui: 0, ai: 0 });
  });

  it("defaults periodDays to 30 when not provided", () => {
    const report = summarize([], [], { now: new Date("2026-09-02T12:00:00.000Z") });
    expect(report.periodDays).toBe(30);
  });

  it("rejects a non-status destination in the event log", () => {
    const events: Event[] = [
      {
        ts: "2026-08-30T00:00:00.000Z",
        task: "x",
        field: "status",
        from: "todo",
        to: "bogus",
        actor: "ui",
      },
    ];
    const report = summarize(events, [], { now: new Date("2026-08-31T12:00:00.000Z") });
    // bogus `to` is not a status -> not counted as a move or dwell
    expect(report.transitions.byMove).toEqual([]);
    expect(report.dwell.every((d) => d.visits === 0)).toBe(true);
  });
});

describe("stats: local timezone", () => {
  it("anchors week boundaries to local time rather than UTC", () => {
    const prev = process.env.TZ;
    try {
      // UTC-10 (no DST): 2026-08-31T00:00Z is Monday 00:00 in UTC, but
      // Sunday 14:00 locally, so it belongs to the week starting Mon 08-24.
      process.env.TZ = "Pacific/Honolulu";
      const report = summarize([], [], {
        now: new Date("2026-08-31T00:00:00.000Z"),
        periodDays: 7,
      });
      const weeks = report.throughput.weekly.map((w) => w.weekStart);
      expect(weeks[weeks.length - 1]).toBe("2026-08-24");
      expect(weeks).not.toContain("2026-08-31");
    } finally {
      process.env.TZ = prev ?? "UTC";
    }
  });
});
