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
