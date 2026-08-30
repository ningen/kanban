import { dueUrgency, dueUrgencyLabel, type DueClock } from "../../lib/dueUrgency";
import { Badge } from "./Badge";

/** URGENCY -> Tailwind badge variant mapping. */
const URGENCY_VARIANT = {
  overdue: "danger",
  "due-soon": "warning",
  normal: "neutral",
} as const;

/** Formats a task's due date as a color-coded badge (overdue/due-soon). */
export function DueBadge({
  due,
  clock,
}: {
  due: string;
  clock?: DueClock;
}) {
  const urgency = dueUrgency(due, clock);
  const label = dueUrgencyLabel(due, clock);
  const variant = URGENCY_VARIANT[urgency];
  return (
    <Badge variant={variant} title={`due ${due}`}>
      {label !== null ? `${label} · ` : ""}
      {due}
    </Badge>
  );
}
