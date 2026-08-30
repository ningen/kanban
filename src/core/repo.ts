/**
 * Repository layer: reads/writes the plain-text kanban files.
 *
 * All writes go through this module. Writes are atomic (write to a temp
 * file, then rename) and status transitions are recorded in `events.jsonl`.
 */

import { existsSync, mkdirSync } from "node:fs";
import { readdir, readFile, writeFile, rename, mkdir, rm, open } from "node:fs/promises";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseTask,
  serializeTask,
  type Task,
  type Status,
  type Event,
} from "./task";

export function tasksDir(root: string): string {
  return join(root, "tasks");
}

export function archiveDir(root: string): string {
  return join(root, "archive");
}

export function eventsFile(root: string): string {
  return join(root, "events.jsonl");
}

function ensureDirs(root: string): void {
  mkdirSync(tasksDir(root), { recursive: true });
  mkdirSync(archiveDir(root), { recursive: true });
}

/** Check whether a filename is a task file (ends in .md). */
function isTaskFile(name: string): boolean {
  return name.endsWith(".md");
}

async function readTaskFile(filePath: string): Promise<Task> {
  const raw = await readFile(filePath, "utf8");
  const task = parseTask(raw);
  // Guard: the id in the file should match the filename.
  const expected = basename(filePath, ".md");
  if (task.id !== expected) {
    throw new Error(`Task id mismatch: file=${expected}, frontmatter=${task.id}`);
  }
  return task;
}

/**
 * Read all active tasks (in `tasks/`), sorted by column then rank.
 * Returns a flat list; callers group by status as needed.
 */
export async function listTasks(root: string): Promise<Task[]> {
  ensureDirs(root);
  const files = await readdir(tasksDir(root));
  const tasks: Task[] = [];
  for (const name of files) {
    if (!isTaskFile(name)) continue;
    try {
      tasks.push(await readTaskFile(join(tasksDir(root), name)));
    } catch {
      // Skip unreadable/corrupt task files rather than failing the whole board.
    }
  }
  // Group ordering: by column order, then by rank.
  const order: Record<Status, number> = {
    todo: 0,
    doing: 1,
    waiting: 2,
    done: 3,
    wontdo: 4,
  };
  tasks.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.created.localeCompare(b.created);
  });
  return tasks;
}

/** Read archived tasks from `archive/`. */
export async function listArchive(root: string): Promise<Task[]> {
  const dir = archiveDir(root);
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const tasks: Task[] = [];
  for (const name of files) {
    if (!isTaskFile(name)) continue;
    try {
      tasks.push(await readTaskFile(join(dir, name)));
    } catch {
      // skip
    }
  }
  tasks.sort((a, b) => a.updated.localeCompare(b.updated));
  return tasks;
}

/** Atomic write: write to a temp file in the same dir, then rename. */
export async function writeTask(root: string, task: Task): Promise<void> {
  ensureDirs(root);
  const dir = tasksDir(root);
  const filePath = join(dir, `${task.id}.md`);
  const tmpPath = join(dir, `.${task.id}.${randomUUID()}.tmp`);
  const content = serializeTask(task);
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, filePath);
}

/** Move a task file from `tasks/` to `archive/`. */
export async function archiveTask(root: string, id: string): Promise<void> {
  const src = join(tasksDir(root), `${id}.md`);
  await mkdir(archiveDir(root), { recursive: true });
  const dst = join(archiveDir(root), `${id}.md`);
  await rename(src, dst);
}

/** Delete a task file entirely (from `tasks/` or `archive/`). */
export async function deleteTask(root: string, id: string): Promise<boolean> {
  for (const dir of [tasksDir(root), archiveDir(root)]) {
    const p = join(dir, `${id}.md`);
    if (existsSync(p)) {
      await rm(p);
      return true;
    }
  }
  return false;
}

/** Append an event to `events.jsonl`. Append-only, one JSON per line. */
export async function appendEvent(root: string, event: Event): Promise<void> {
  ensureDirs(root);
  const file = eventsFile(root);
  const line = JSON.stringify(event);
  // Append with O_APPEND to avoid read-modify-write races.
  const handle = await open(file, "a");
  try {
    await handle.write(`${line}\n`, null, "utf8");
  } finally {
    await handle.close();
  }
}

/** Read all events from `events.jsonl`. */
export async function readEvents(root: string): Promise<Event[]> {
  const file = eventsFile(root);
  if (!existsSync(file)) return [];
  const raw = await readFile(file, "utf8");
  const events: Event[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line) as Event);
    } catch {
      // skip corrupt line
    }
  }
  return events;
}

/**
 * Compute the midpoint rank between two neighbors.
 * If only one neighbor exists, nudge in the safe direction.
 */
export function midpointRank(prev: number | null, next: number | null): number {
  if (prev !== null && next !== null) return (prev + next) / 2;
  if (prev !== null) return prev + 1024; // push to the end
  if (next !== null) return next - 1024; // push to the start
  return 1024;
}

/** Compute the next free rank when appending to the end of a column. */
export function appendRank(tasksInColumn: Task[]): number {
  if (tasksInColumn.length === 0) return 2048;
  const max = Math.max(...tasksInColumn.map((t) => t.rank));
  return max + 1024;
}
