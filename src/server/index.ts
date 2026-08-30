/**
 * kanban HTTP server (Bun + Hono).
 *
 * Serves the board JSON, supports CRUD, and pushes real-time updates over
 * SSE so the browser reflects AI changes without a manual refresh.
 */

import { Hono } from "hono";
import type { SSEMessage } from "hono/streaming";
import { streamSSE } from "hono/streaming";
import {
  createTask,
  editTask,
  moveTask,
  archive,
  remove,
  getTask,
  readEvents,
  listTasks,
} from "../core/operations";
import { isStatus, ACTOR_UI, type Status } from "../core/task";

export interface ServerConfig {
  root: string;
  port?: number;
}

/** A minimal SSE writer interface so broadcast can be tested without live streams. */
export interface SSEWriter {
  writeSSE: (message: SSEMessage) => Promise<void>;
}

/**
 * Broadcast a message to all connected SSE clients. Fire-and-forget; a failing
 * (disconnected) subscriber is dropped.
 */
export async function broadcast(
  subscribers: Set<SSEWriter>,
  message: string,
): Promise<void> {
  const dead: SSEWriter[] = [];
  for (const subscriber of subscribers) {
    try {
      await subscriber.writeSSE({ data: message });
    } catch {
      dead.push(subscriber);
    }
  }
  for (const subscriber of dead) {
    subscribers.delete(subscriber);
  }
}

/** Read the full board state (tasks + events). */
async function boardState(root: string) {
  const tasks = await listTasks(root);
  const events = await readEvents(root);
  return { tasks, events };
}

/** Build the kanban Hono app. Returns the app and its live subscriber set. */
export function createApp(config: ServerConfig) {
  const { root } = config;
  const app = new Hono<{ Variables: { root: string } }>();
  const subscribers = new Set<SSEWriter>();

  app.use(async (c, next) => {
    c.set("root", root);
    await next();
  });

  // --- board snapshot ---
  app.get("/api/board", async (c) => {
    const state = await boardState(c.get("root"));
    return c.json(state);
  });

  // --- task detail ---
  app.get("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const task = await getTask(c.get("root"), id);
    if (task === undefined) return c.json({ error: "not found" }, 404);
    return c.json(task);
  });

  // --- create ---
  app.post("/api/tasks", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title : "";
    if (title.length === 0) return c.json({ error: "title required" }, 400);

    const input: Parameters<typeof createTask>[1] = { title };
    if (isStatus(body.status)) input.status = body.status;
    if (typeof body.rank === "number") input.rank = body.rank;
    if (Array.isArray(body.tags)) input.tags = body.tags.map(String);
    if (typeof body.due === "string") input.due = body.due;
    if (typeof body.body === "string") input.body = body.body;

    const task = await createTask(c.get("root"), input, ACTOR_UI);
    await broadcast(subscribers, JSON.stringify({ type: "change", task }));
    return c.json(task, 201);
  });

  // --- edit ---
  app.patch("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const root = c.get("root");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const status = isStatus(body.status) ? body.status : undefined;
    // status change goes through moveTask to record the transition event
    if (status !== undefined) {
      const moved = await moveTask(root, id, status, ACTOR_UI);
      if (moved.changed) {
        await broadcast(subscribers, JSON.stringify({ type: "change", id }));
      }
    }

    const input: Parameters<typeof editTask>[2] = {};
    if (typeof body.title === "string") input.title = body.title;
    if (typeof body.rank === "number") input.rank = body.rank;
    if (Array.isArray(body.tags)) input.tags = body.tags.map(String);
    if (body.due === null) input.due = null;
    else if (typeof body.due === "string") input.due = body.due;
    if (typeof body.body === "string") input.body = body.body;

    const task = await editTask(root, id, input);
    if (task === undefined) return c.json({ error: "not found" }, 404);
    await broadcast(subscribers, JSON.stringify({ type: "change", task }));
    return c.json(task);
  });

  // --- archive ---
  app.post("/api/tasks/:id/archive", async (c) => {
    const id = c.req.param("id");
    const ok = await archive(c.get("root"), id);
    if (!ok) return c.json({ error: "not found" }, 404);
    await broadcast(subscribers, JSON.stringify({ type: "change", id }));
    return c.json({ archived: id });
  });

  // --- delete ---
  app.delete("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await remove(c.get("root"), id);
    if (!ok) return c.json({ error: "not found" }, 404);
    await broadcast(subscribers, JSON.stringify({ type: "change", id }));
    return c.json({ deleted: id });
  });

  // --- SSE live updates ---
  app.get("/api/events", (c) => {
    return streamSSE(c, async (stream) => {
      subscribers.add(stream);
      stream.onAbort(() => {
        subscribers.delete(stream);
      });
      // send a hello so the client connects immediately
      await stream.writeSSE({ data: JSON.stringify({ type: "connected" }) });
    });
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return { app, subscribers };
}

/** Start the server on the given root and return the running instance. */
export async function startServer(config: ServerConfig): Promise<ReturnType<typeof Bun.serve>> {
  const { port = 3000 } = config;
  const { app } = createApp(config);
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`kanban server running at http://localhost:${server.port}`);
  return server;
}

export type { Status };
