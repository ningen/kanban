/** Pure calendar utilities for the date picker. All dates are YYYY-MM-DD. */

/** Parse YYYY-MM-DD into a Date at local midnight, or null. Strict: no
 *  month/day rollover (e.g. 2026-13-40 is invalid). */
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  // Reject rollover: the constructed date must match the requested parts.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Format a Date to YYYY-MM-DD (local). */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today as YYYY-MM-DD (local). */
export function todayValue(): string {
  return formatDate(new Date());
}

export interface CalendarMonth {
  /** First day-of-week index (0=Sun) of the month's first day. */
  offset: number;
  /** Number of days in the month. */
  days: number;
  /** The month this grid represents, as [year, monthIndex]. */
  month: [number, number];
}

/** Layout of a month grid: the day cells (empty strings = blanks). */
export function monthGrid(year: number, monthIndex: number): string[] {
  const first = new Date(year, monthIndex, 1);
  const offset = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: string[] = [];
  for (let i = 0; i < offset; i++) cells.push("");
  for (let d = 1; d <= days; d++) {
    cells.push(formatDate(new Date(year, monthIndex, d)));
  }
  return cells;
}

/** Shift a (year, monthIndex) by delta months and clamp day overflow. */
export function shiftMonth(year: number, monthIndex: number, delta: number): [number, number] {
  const d = new Date(year, monthIndex + delta, 1);
  return [d.getFullYear(), d.getMonth()];
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
