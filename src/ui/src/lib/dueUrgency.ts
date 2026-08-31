/** How overdue/upcoming a task's due date is, relative to today. */
export type DueUrgency = "overdue" | "due-soon" | "normal";

/** Days before a due date counts as "due soon" (needs attention). */
export const DUE_SOON_DAYS = 3;

/** Context for judging due-date urgency in a timezone-aware way. */
export interface DueClock {
  /** Current date as a local YYYY-MM-DD string (defaults to today). */
  today: string;
}

function today(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Whole-day difference between two YYYY-MM-DD dates (positive when b > a). */
function diffDays(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/**
 * Classify how urgent a due date is. `undefined`/unparseable due dates are
 * treated as "normal" (no emphasis). Overdue results are stable within a day.
 */
export function dueUrgency(
  due: string | undefined,
  clock: DueClock = { today: today() },
): DueUrgency {
  if (due === undefined) return "normal";
  const dueTs = Date.parse(`${due}T00:00:00`);
  if (Number.isNaN(dueTs)) return "normal";
  const delta = diffDays(clock.today, due);
  if (delta < 0) return "overdue";
  if (delta <= DUE_SOON_DAYS) return "due-soon";
  return "normal";
}

/** Human label for a due date's urgency, or null when not applicable. */
export function dueUrgencyLabel(due: string | undefined, clock?: DueClock): string | null {
  const urgency = dueUrgency(due, clock);
  if (urgency === "overdue") return "期限超過";
  if (urgency === "due-soon") return "期限間近";
  return null;
}
