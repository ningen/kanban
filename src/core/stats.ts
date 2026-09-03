/**
 * Statistics over the kanban event log and board.
 *
 * Pure functions: they take the event log and the current tasks and return a
 * structured `StatsReport`. Both the CLI (`kanban stats`) and the UI use the
 * same logic so the numbers stay consistent.
 *
 * Durations inside the report are expressed in **hours** (floats) so they are
 * unambiguous in JSON; the display layer converts to days/hours as needed.
 */

import {
  type Actor,
  type Event,
  isStatus,
  isTerminal,
  STATUSES,
  type Status,
  type Task,
} from "./task";

export interface BoardSummary {
  /** Count of tasks in each status, keyed by status. */
  byStatus: Record<Status, number>;
  total: number;
  /** Non-terminal tasks (todo / doing / waiting). */
  active: number;
  /** Terminal tasks (done + wontdo). */
  done: number;
  /** Count of tasks currently `doing` (a proxy for WIP). */
  doing: number;
  /** Active tasks whose due date is strictly before today. */
  overdue: number;
}

export interface WeeklyBucket {
  /** Monday of the week (YYYY-MM-DD, UTC). */
  weekStart: string;
  created: number;
  done: number;
}

export interface LeadTime {
  /** Number of tasks with a computable lead time. */
  sample: number;
  avgHours: number;
  medianHours: number;
  p90Hours: number;
  minHours: number;
  maxHours: number;
}

export interface DwellByStatus {
  status: Status;
  /** Number of distinct segments spent in this status. */
  visits: number;
  totalHours: number;
  avgHours: number;
}

export interface TransitionCount {
  from: Status;
  to: Status;
  count: number;
}

export type ActorSplit = Record<Actor, number>;

export interface StatsReport {
  generatedAt: string;
  periodDays: number;
  board: BoardSummary;
  throughput: {
    weekly: WeeklyBucket[];
    leadTime: LeadTime;
  };
  dwell: DwellByStatus[];
  transitions: {
    byMove: TransitionCount[];
    byActor: ActorSplit;
  };
}

export interface SummarizeOptions {
  now?: Date;
  periodDays?: number;
}

const MS_PER_HOUR = 3_600_000;
const DAY_MS = 86_400_000;

/** Parse an ISO timestamp to milliseconds, or null when invalid. */
function ms(iso: string): number | null {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? null : n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format a Date as a local YYYY-MM-DD string (machine timezone). */
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Shift a local YYYY-MM-DD date by `days` calendar days. */
function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/** The Monday (local YYYY-MM-DD) of the week containing `time`. */
function weekStart(time: number): string {
  const d = new Date(time);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  d.setHours(0, 0, 0, 0);
  return localDateString(d);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  const lower = sorted[mid - 1] ?? 0;
  const upper = sorted[mid] ?? 0;
  return (lower + upper) / 2;
}

function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((x, y) => x - y);
  const idx = (sorted.length - 1) * p;
  const lowerIdx = Math.floor(idx);
  const upperIdx = Math.ceil(idx);
  if (lowerIdx === upperIdx) return sorted[lowerIdx] ?? 0;
  const frac = idx - lowerIdx;
  const lower = sorted[lowerIdx] ?? 0;
  const upper = sorted[upperIdx] ?? 0;
  return lower + (upper - lower) * frac;
}

/** An active task is overdue when its due date is strictly before today. */
function isOverdue(t: Task, today: string): boolean {
  if (t.due === undefined) return false;
  if (isTerminal(t.status)) return false;
  return t.due < today; // YYYY-MM-DD strings compare correctly
}

function boardSummary(tasks: Task[], now: Date): BoardSummary {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  let active = 0;
  let done = 0;
  let doing = 0;
  let overdue = 0;
  const today = localDateString(now);
  for (const t of tasks) {
    byStatus[t.status] += 1;
    if (isTerminal(t.status)) done += 1;
    else active += 1;
    if (t.status === "doing") doing += 1;
    if (isOverdue(t, today)) overdue += 1;
  }
  return { byStatus, total: tasks.length, active, done, doing, overdue };
}

function weeklyThroughput(events: Event[], now: Date, periodDays: number): WeeklyBucket[] {
  const end = now.getTime();
  const start = end - periodDays * DAY_MS;
  const buckets = new Map<string, WeeklyBucket>();

  let key = weekStart(start);
  const endKey = weekStart(end);
  for (let guard = 0; key <= endKey && guard < 100; guard++) {
    buckets.set(key, { weekStart: key, created: 0, done: 0 });
    key = addDays(key, 7);
  }

  for (const e of events) {
    const bucket = bucketFor(e, buckets, start, end);
    if (bucket === undefined) continue;
    if (e.from === undefined) bucket.created += 1;
    if (e.to === "done") bucket.done += 1;
  }

  return [...buckets.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** The weekly bucket for a status event inside the window, or undefined. */
function bucketFor(
  e: Event,
  buckets: Map<string, WeeklyBucket>,
  start: number,
  end: number,
): WeeklyBucket | undefined {
  if (e.field !== "status") return undefined;
  const t = ms(e.ts);
  if (t === null) return undefined;
  if (t < start || t > end) return undefined;
  return buckets.get(weekStart(t));
}

function recordCreation(e: Event, t: number, createdByTask: Map<string, number>): void {
  if (e.from === undefined && !createdByTask.has(e.task)) createdByTask.set(e.task, t);
}

function recordDone(e: Event, t: number, doneByTask: Map<string, number>): void {
  if (e.to === "done" && !doneByTask.has(e.task)) doneByTask.set(e.task, t);
}

function collectLeadSamples(
  createdByTask: Map<string, number>,
  doneByTask: Map<string, number>,
): number[] {
  const samples: number[] = [];
  for (const [taskId, created] of createdByTask) {
    const done = doneByTask.get(taskId);
    if (done === undefined) continue;
    const h = (done - created) / MS_PER_HOUR;
    if (h >= 0) samples.push(h);
  }
  return samples;
}

function summarizeHours(samples: number[]): LeadTime {
  if (samples.length === 0) {
    return { sample: 0, avgHours: 0, medianHours: 0, p90Hours: 0, minHours: 0, maxHours: 0 };
  }
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  const sorted = [...samples].sort((x, y) => x - y);
  return {
    sample: samples.length,
    avgHours: round2(avg),
    medianHours: round2(median(samples)),
    p90Hours: round2(percentile(samples, 0.9)),
    minHours: round2(sorted[0] ?? 0),
    maxHours: round2(sorted[sorted.length - 1] ?? 0),
  };
}

/** Lead time = time from a task's creation event to its first `done` event. */
function leadTime(events: Event[]): LeadTime {
  const createdByTask = new Map<string, number>();
  const doneByTask = new Map<string, number>();
  for (const e of events) {
    if (e.field !== "status") continue;
    const t = ms(e.ts);
    if (t === null) continue;
    recordCreation(e, t, createdByTask);
    recordDone(e, t, doneByTask);
  }
  return summarizeHours(collectLeadSamples(createdByTask, doneByTask));
}

function dwellByStatus(events: Event[], now: Date): DwellByStatus[] {
  const byTask = statusEventsByTask(events);
  const totals = new Map<Status, number>();
  const visits = new Map<Status, number>();
  const nowMs = now.getTime();
  for (const list of byTask.values()) {
    accumulateDwell(list, nowMs, totals, visits);
  }
  return toDwellRows(totals, visits);
}

/** Gather status events per task, sorted chronologically. */
function statusEventsByTask(events: Event[]): Map<string, Event[]> {
  const byTask = new Map<string, Event[]>();
  for (const e of events) {
    if (e.field !== "status") continue;
    if (e.to !== undefined && e.to !== "archived" && !isStatus(e.to)) continue;
    const list = byTask.get(e.task);
    if (list === undefined) byTask.set(e.task, [e]);
    else list.push(e);
  }
  for (const list of byTask.values()) {
    list.sort((a, b) => (ms(a.ts) ?? 0) - (ms(b.ts) ?? 0));
  }
  return byTask;
}

function accumulateDwell(
  list: Event[],
  nowMs: number,
  totals: Map<Status, number>,
  visits: Map<Status, number>,
): void {
  for (let i = 0; i < list.length; i++) {
    const cur = list[i];
    if (cur === undefined || !isStatus(cur.to)) continue;
    const curTs = ms(cur.ts);
    if (curTs === null) continue;
    const next = list[i + 1];
    const nextTs = next === undefined ? null : ms(next.ts);
    const intervalEnd = dwellIntervalEnd(nextTs, curTs, cur.to, nowMs);
    const hours = (intervalEnd - curTs) / MS_PER_HOUR;
    if (hours < 0) continue;
    totals.set(cur.to, (totals.get(cur.to) ?? 0) + hours);
    visits.set(cur.to, (visits.get(cur.to) ?? 0) + 1);
  }
}

function dwellIntervalEnd(
  nextTs: number | null,
  curTs: number,
  status: Status,
  nowMs: number,
): number {
  if (nextTs !== null && nextTs >= curTs) return nextTs;
  if (isTerminal(status)) return curTs;
  return nowMs;
}

function toDwellRows(totals: Map<Status, number>, visits: Map<Status, number>): DwellByStatus[] {
  return STATUSES.map((status) => {
    const total = totals.get(status) ?? 0;
    const v = visits.get(status) ?? 0;
    return {
      status,
      visits: v,
      totalHours: round2(total),
      avgHours: v === 0 ? 0 : round2(total / v),
    };
  });
}

function countMove(e: Event, moveCounts: Map<string, number>): void {
  if (e.from === undefined || !isStatus(e.from)) return;
  if (e.to === undefined || !isStatus(e.to)) return;
  const key = `${e.from}\u0000${e.to}`;
  moveCounts.set(key, (moveCounts.get(key) ?? 0) + 1);
}

function countActor(e: Event, byActor: ActorSplit): void {
  if (e.actor === "ui" || e.actor === "ai") byActor[e.actor] += 1;
}

function transitionStats(events: Event[]): {
  byMove: TransitionCount[];
  byActor: ActorSplit;
} {
  const moveCounts = new Map<string, number>();
  const byActor: ActorSplit = { ui: 0, ai: 0 };
  for (const e of events) {
    if (e.field !== "status") continue;
    countMove(e, moveCounts);
    countActor(e, byActor);
  }
  const byMove = [...moveCounts].map(([key, count]) => {
    const [from, to] = key.split("\u0000") as [Status, Status];
    return { from, to, count };
  });
  byMove.sort((a, b) => b.count - a.count);
  return { byMove, byActor };
}

/** Compute a full statistics report from the event log and current tasks. */
export function summarize(
  events: Event[],
  tasks: Task[],
  opts: SummarizeOptions = {},
): StatsReport {
  const now = opts.now ?? new Date();
  const periodDays = opts.periodDays ?? 30;
  return {
    generatedAt: now.toISOString(),
    periodDays,
    board: boardSummary(tasks, now),
    throughput: {
      weekly: weeklyThroughput(events, now, periodDays),
      leadTime: leadTime(events),
    },
    dwell: dwellByStatus(events, now),
    transitions: transitionStats(events),
  };
}
