import { type BoardState, isStatus, type Status, type Task } from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error !== undefined) message = body.error;
    } catch {
      // ignore body parse errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchBoard(): Promise<BoardState> {
  return request<BoardState>("/board");
}

export async function fetchTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export interface CreatePayload {
  title: string;
  status?: Status;
  rank?: number;
  tags?: string[];
  due?: string;
  body?: string;
}

export async function createTask(payload: CreatePayload): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface EditPayload {
  title?: string;
  status?: Status;
  rank?: number;
  tags?: string[];
  due?: string | null;
  body?: string;
}

export async function editTask(id: string, payload: EditPayload): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function archiveTask(id: string): Promise<void> {
  await request<unknown>(`/tasks/${id}/archive`, { method: "POST" });
}

export async function deleteTask(id: string): Promise<void> {
  await request<unknown>(`/tasks/${id}`, { method: "DELETE" });
}

/** Compute a midpoint rank for a drop between two neighbors. */
export function midpointRank(prev: number | null, next: number | null): number {
  if (prev !== null && next !== null) return (prev + next) / 2;
  if (prev !== null) return prev + 1024;
  if (next !== null) return next - 1024;
  return 1024;
}

/**
 * Given the current tasks and a move target (destination column + index),
 * compute the new rank and status for a dragged task.
 */
export function computeMove(
  tasks: Task[],
  draggedId: string,
  targetStatus: Status,
  targetIndex: number,
): { status: Status; rank: number } {
  // destination column, excluding the dragged task
  const column = tasks
    .filter((t) => t.status === targetStatus && t.id !== draggedId)
    .sort((a, b) => a.rank - b.rank);

  const prev = column[targetIndex - 1];
  const next = column[targetIndex];
  return {
    status: targetStatus,
    rank: midpointRank(prev ? prev.rank : null, next ? next.rank : null),
  };
}

export function isStatusValue(value: unknown): value is Status {
  return isStatus(value);
}
