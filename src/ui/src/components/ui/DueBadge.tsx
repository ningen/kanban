import { type DueClock, dueUrgency, dueUrgencyLabel } from "../../lib/dueUrgency";
import type { Status } from "../../types";
import { Badge } from "./Badge";

/** URGENCY -> Tailwind badge variant mapping. */
const URGENCY_VARIANT = {
  overdue: "danger",
  "due-soon": "warning",
  normal: "neutral",
} as const;

/**
 * Terminal statuses where a due date is no longer a live commitment, so it
 * must not be flagged as overdue/due-soon (e.g. a past-due `done` task).
 */
const TERMINAL_STATUSES: ReadonlySet<Status> = new Set(["done", "wontdo"]);

/** Formats a task's due date as a color-coded badge (overdue/due-soon). */
export function DueBadge({
  due,
  status,
  clock,
}: {
  due: string;
  status?: Status;
  clock?: DueClock;
}) {
  const terminal = status !== undefined && TERMINAL_STATUSES.has(status);
  const urgency = terminal ? "normal" : dueUrgency(due, clock);
  const label = terminal ? null : dueUrgencyLabel(due, clock);
  const variant = URGENCY_VARIANT[urgency];
  return (
    <Badge variant={variant} title={`due ${due}`}>
      {label !== null ? `${label} · ` : ""}
      {due}
    </Badge>
  );
}
