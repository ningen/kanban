/**
 * Core data contract for kanban.
 *
 * The source of truth is plain-text Markdown. Each task is one file
 * `tasks/<uuidv7>.md`. The UI, CLI, and server all read/write through
 * this module so the contract stays consistent.
 */

import { parse, stringify } from "yaml";

/** Allowed statuses. `done` and `wontdo` are terminal. */
export const STATUSES = ["todo", "doing", "waiting", "done", "wontdo"] as const;
export type Status = (typeof STATUSES)[number];

/** The "active" (non-terminal) statuses shown as normal board columns. */
export const ACTIVE_STATUSES = ["todo", "doing", "waiting"] as const;

/** Terminal statuses. */
export const TERMINAL_STATUSES = ["done", "wontdo"] as const;

export const ACTOR_UI = "ui";
export const ACTOR_AI = "ai";
export type Actor = typeof ACTOR_UI | typeof ACTOR_AI;

/** Structured fields stored in the task file's YAML frontmatter. */
export interface Task {
  id: string; // uuidv7, immutable, also the filename without .md
  title: string;
  status: Status;
  rank: number; // position within the column (midpoint ordering)
  tags: string[];
  due?: string; // ISO date (YYYY-MM-DD)
  created: string; // ISO datetime
  updated: string; // ISO datetime
  completed?: string; // ISO datetime, set when moved to a terminal status
  /** Optional free-form note (not structured in frontmatter). */
  body?: string;
}

/** A single append-only event in `events.jsonl`. */
export interface Event {
  ts: string; // ISO datetime
  task: string; // task id
  field: string; // e.g. "status"
  from?: string;
  to?: string;
  actor: Actor;
}

export const DATA_DIR = "tasks";
export const ARCHIVE_DIR = "archive";
export const EVENTS_FILE = "events.jsonl";

export const BOARD_COLUMNS: Array<{ status: Status; label: string }> = [
  { status: "todo", label: "TODO" },
  { status: "doing", label: "DOING" },
  { status: "waiting", label: "WAITING" },
  { status: "done", label: "DONE" },
  { status: "wontdo", label: "WONT DO" },
];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: Status): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export const FRONTMATTER_KEYS = [
  "id",
  "title",
  "status",
  "rank",
  "tags",
  "due",
  "created",
  "updated",
  "completed",
] as const;

/** Convert the YAML frontmatter + Markdown body section into a Task. */
export function parseTask(fileContent: string): Task {
  const content = fileContent.replace(/^\uFEFF/, ""); // strip BOM
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid task file: missing YAML frontmatter block");
  }
  const yamlText = match[1];
  const body = match[2] ?? "";
  if (yamlText === undefined) {
    throw new Error("Invalid task file: missing YAML frontmatter block");
  }
  const parsed = parse(yamlText) as Record<string, unknown>;
  const id = parsed.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Invalid task file: missing id");
  }
  const status = parsed.status;
  if (!isStatus(status)) {
    throw new Error(`Invalid task file: unknown status '${String(status)}'`);
  }
  const rank = parsed.rank;
  if (typeof rank !== "number") {
    throw new Error("Invalid task file: rank must be a number");
  }
  const title = parsed.title;
  if (typeof title !== "string" || title.length === 0) {
    throw new Error("Invalid task file: missing title");
  }

  const task: Task = {
    id,
    title,
    status,
    rank,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => String(tag)) : [],
    created: typeof parsed.created === "string" ? parsed.created : "",
    updated: typeof parsed.updated === "string" ? parsed.updated : "",
  };
  if (typeof parsed.due === "string") task.due = parsed.due;
  if (typeof parsed.completed === "string") task.completed = parsed.completed;
  const trimmedBody = body.trim();
  if (trimmedBody.length > 0) task.body = trimmedBody;
  return task;
}

/** Render a Task back to the Markdown file representation. */
export function serializeTask(task: Task): string {
  const frontmatter: Record<string, unknown> = {
    id: task.id,
    title: task.title,
    status: task.status,
    rank: task.rank,
    tags: task.tags,
    created: task.created,
    updated: task.updated,
  };
  if (task.due) frontmatter.due = task.due;
  if (task.completed) frontmatter.completed = task.completed;

  const yamlText = stringify(frontmatter, { lineWidth: 0 });
  // Ensure the YAML output ends without extra trailing newline before body.
  const body = task.body?.trim();
  if (body) {
    return `---\n${yamlText}---\n\n${body}\n`;
  }
  return `---\n${yamlText}---\n`;
}
