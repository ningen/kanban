/**
 * Task operations (business logic) shared by the CLI and the server.
 *
 * These enforce the data contract: status transitions are recorded in
 * `events.jsonl`, rank is recomputed on moves, and writes are atomic.
 */

import {
  appendRank,
  appendEvent,
  archiveTask,
  deleteTask,
  listTasks,
  readEvents,
  writeTask,
} from "./repo";
import {
  isStatus,
  isTerminal,
  type Actor,
  type Status,
  type Task,
  type Event,
} from "./task";
import { uuidv7 } from "./uuidv7";

export interface CreateInput {
  title: string;
  status?: Status;
  rank?: number;
  tags?: string[];
  due?: string;
  body?: string;
}

export interface EditInput {
  title?: string;
  rank?: number;
  due?: string | null;
  tags?: string[];
  body?: string;
}

export type MoveResult = { changed: boolean };

function now(): string {
  return new Date().toISOString();
}

/** Find a task by id across the active board. */
export async function getTask(root: string, id: string): Promise<Task | undefined> {
  const tasks = await listTasks(root);
  return tasks.find((t) => t.id === id);
}

/** Create a new task file. */
export async function createTask(root: string, input: CreateInput, actor: Actor): Promise<Task> {
  const tasks = await listTasks(root);
  const status: Status = input.status ?? "todo";
  const inColumn = tasks.filter((t) => t.status === status);
  const rank = input.rank ?? appendRank(inColumn);
  const ts = now();

  const task: Task = {
    id: uuidv7(),
    title: input.title,
    status,
    rank,
    tags: input.tags ?? [],
    created: ts,
    updated: ts,
  };
  if (input.due !== undefined) task.due = input.due;
  if (input.body !== undefined) task.body = input.body;
  if (isTerminal(status)) task.completed = ts;

  await writeTask(root, task);
  await appendEvent(root, {
    ts,
    task: task.id,
    field: "status",
    to: status,
    actor,
  });
  return task;
}

/** Edit fields on an existing task. Never rewrites fields the caller didn't change. */
export async function editTask(
  root: string,
  id: string,
  input: EditInput,
): Promise<Task | undefined> {
  const task = await getTask(root, id);
  if (task === undefined) return undefined;
  const ts = now();

  if (input.title !== undefined) task.title = input.title;
  if (input.rank !== undefined) task.rank = input.rank;
  if (input.tags !== undefined) task.tags = input.tags;
  if (input.body !== undefined) task.body = input.body;
  // `due` is explicitly nullable so callers can clear it.
  if (input.due !== undefined) {
    if (input.due === null) delete task.due;
    else task.due = input.due;
  }
  task.updated = ts;

  await writeTask(root, task);
  return task;
}

/**
 * Move a task to another status. Records the transition event and
 * recomputes `rank` in the destination column.
 */
export async function moveTask(
  root: string,
  id: string,
  to: Status,
  actor: Actor,
  opts?: { rank?: number },
): Promise<MoveResult> {
  if (!isStatus(to)) throw new Error(`Unknown status: ${String(to)}`);
  const task = await getTask(root, id);
  if (task === undefined) throw new Error(`Task not found: ${id}`);
  if (task.status === to) return { changed: false };

  const ts = now();
  const from = task.status;
  task.status = to;
  if (opts?.rank !== undefined) {
    task.rank = opts.rank;
  } else {
    const tasks = await listTasks(root);
    const inDest = tasks.filter((t) => t.status === to && t.id !== id);
    task.rank = appendRank(inDest);
  }
  task.updated = ts;
  if (isTerminal(to) && task.completed === undefined) task.completed = ts;
  else if (!isTerminal(to)) delete task.completed;

  await writeTask(root, task);
  await appendEvent(root, {
    ts,
    task: task.id,
    field: "status",
    from,
    to,
    actor,
  });
  return { changed: true };
}

/** Move a task file to `archive/`. */
export async function archive(root: string, id: string): Promise<boolean> {
  const task = await getTask(root, id);
  if (task === undefined) return false;
  await archiveTask(root, id);
  await appendEvent(root, {
    ts: now(),
    task: id,
    field: "status",
    from: task.status,
    to: "archived",
    actor: "ui",
  });
  return true;
}

/** Delete a task file entirely. */
export async function remove(root: string, id: string): Promise<boolean> {
  return deleteTask(root, id);
}

export { listTasks, readEvents };

export type { Event, Task, Status };
