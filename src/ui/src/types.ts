/** Mirrors the backend data contract (src/core/task.ts). */

export const STATUSES = ["todo", "doing", "waiting", "done", "wontdo"] as const;
export type Status = (typeof STATUSES)[number];

export const BOARD_COLUMNS: Array<{ status: Status; label: string }> = [
  { status: "todo", label: "TODO" },
  { status: "doing", label: "DOING" },
  { status: "waiting", label: "WAITING" },
  { status: "done", label: "DONE" },
  { status: "wontdo", label: "WONT DO" },
];

/**
 * CSS variable name for each status accent/soft color, matching `@theme` in
 * styles.css. Keeping this as a mapping (rather than raw hex) makes the CSS
 * the single source of truth for colors.
 */
export const STATUS_TONE: Record<
  Status,
  { accent: string; soft: string }
> = {
  todo: { accent: "var(--color-status-todo)", soft: "var(--color-status-todo-soft)" },
  doing: { accent: "var(--color-status-doing)", soft: "var(--color-status-doing-soft)" },
  waiting: { accent: "var(--color-status-waiting)", soft: "var(--color-status-waiting-soft)" },
  done: { accent: "var(--color-status-done)", soft: "var(--color-status-done-soft)" },
  wontdo: { accent: "var(--color-status-wontdo)", soft: "var(--color-status-wontdo-soft)" },
};

/** Backwards-compatible alias: a raw accent color per status. */
export const STATUS_COLOR: Record<Status, string> = {
  todo: "var(--color-status-todo)",
  doing: "var(--color-status-doing)",
  waiting: "var(--color-status-waiting)",
  done: "var(--color-status-done)",
  wontdo: "var(--color-status-wontdo)",
};

export interface Task {
  id: string;
  title: string;
  status: Status;
  rank: number;
  tags: string[];
  due?: string;
  created: string;
  updated: string;
  completed?: string;
  body?: string;
}

export interface TaskEvent {
  ts: string;
  task: string;
  field: string;
  from?: string;
  to?: string;
  actor: "ui" | "ai";
}

export interface BoardState {
  tasks: Task[];
  events: TaskEvent[];
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** Days (inclusive) that a `done` task stays visible on the board. */
export const DONE_VISIBLE_DAYS = 7;
