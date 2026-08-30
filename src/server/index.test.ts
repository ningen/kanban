import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp, broadcast, type SSEWriter } from "./index";
import { listTasks, readEvents } from "../core/operations";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kanban-server-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("server: board snapshot", () => {
  it("returns an empty board when there are no tasks", async () => {
    const { app } = createApp({ root });
    const res = await app.request("/api/board");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: unknown[] };
    expect(body.tasks).toEqual([]);
  });
});

describe("server: create task", () => {
  it("creates a task and returns 201", async () => {
    const { app } = createApp({ root });
    const res = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "hello", status: "todo", tags: ["a"] }),
    });
    expect(res.status).toBe(201);
    const task = (await res.json()) as { id: string; title: string };
    expect(task.title).toBe("hello");

    const tasks = await listTasks(root);
    expect(tasks).toHaveLength(1);
  });

  it("rejects a create without a title with 400", async () => {
    const { app } = createApp({ root });
    const res = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("server: get/update/move/archive/delete", () => {
  it("GET a task detail and 404 for unknown", async () => {
    const { app } = createApp({ root });
    const create = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const task = (await create.json()) as { id: string };

    const res = await app.request(`/api/tasks/${task.id}`);
    expect(res.status).toBe(200);

    const missing = await app.request("/api/tasks/0...missing");
    expect(missing.status).toBe(404);
  });

  it("PATCH edits a task status via move and records an event", async () => {
    const { app } = createApp({ root });
    const create = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x", status: "todo" }),
    });
    const task = (await create.json()) as { id: string };

    const res = await app.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "doing" }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { status: string };
    expect(updated.status).toBe("doing");

    const events = await readEvents(root);
    expect(events.find((e) => e.field === "status" && e.from === "todo" && e.to === "doing")).toBeDefined();
  });

  it("POST archive moves the task and returns 404 for unknown", async () => {
    const { app } = createApp({ root });
    const create = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const task = (await create.json()) as { id: string };

    const res = await app.request(`/api/tasks/${task.id}/archive`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(await listTasks(root)).toHaveLength(0);

    const missing = await app.request("/api/tasks/0...x/archive", { method: "POST" });
    expect(missing.status).toBe(404);
  });

  it("DELETE removes a task and returns 404 for unknown", async () => {
    const { app } = createApp({ root });
    const create = await app.request("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const task = (await create.json()) as { id: string };

    const res = await app.request(`/api/tasks/${task.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const missing = await app.request("/api/tasks/0...x", { method: "DELETE" });
    expect(missing.status).toBe(404);
  });
});

describe("server: SSE", () => {
  it("streams a connected hello event", async () => {
    const { app } = createApp({ root });
    const res = await app.request("/api/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"type":"connected"');
  });

  it("cleans up subscribers when the client aborts", async () => {
    const { app, subscribers } = createApp({ root });
    const res = await app.request("/api/events");
    // Read the first chunk, then abort the stream to trigger onAbort.
    const reader = res.body?.getReader();
    if (reader) {
      await reader.read();
      await reader.cancel();
    }
    expect(subscribers.size).toBe(0);
  });
});

describe("server: broadcast", () => {
  it("enqueues a message to healthy subscribers", async () => {
    const { subscribers } = createApp({ root });
    let received = "";
    const fake: SSEWriter = {
      writeSSE: async (msg) => {
        received = String(await msg.data);
      },
    };
    subscribers.add(fake);
    await broadcast(subscribers, "hello");
    expect(received).toBe("hello");
  });

  it("drops subscribers that throw", async () => {
    const { subscribers } = createApp({ root });
    const dead: SSEWriter = {
      writeSSE: async () => {
        throw new Error("gone");
      },
    };
    subscribers.add(dead);
    await broadcast(subscribers, "hello");
    expect(subscribers.size).toBe(0);
  });
});

describe("server: runtime", () => {
  it("starts on an ephemeral port and serves a request", async () => {
    const { startServer } = await import("./index");
    const server = await startServer({ root, port: 0 });
    const url = `http://localhost:${server.port}/api/board`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: unknown[] };
    expect(body.tasks).toEqual([]);
    server.stop(true);
  });
});

describe("server: onError", () => {
  it("returns 500 when a handler throws", async () => {
    // Point the root at a path that cannot be a directory so boardState throws.
    const filePath = join(root, "not-a-dir");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, "x", "utf8");
    const { app } = createApp({ root: filePath });
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("/api/board");
    expect(res.status).toBe(500);
    errSpy.mockRestore();
  });
});
