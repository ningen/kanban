import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  tasksDir,
  archiveDir,
  eventsFile,
  listTasks,
  listArchive,
  writeTask,
  archiveTask,
  deleteTask,
  appendEvent,
  readEvents,
} from "./repo";
import { createTask, editTask, moveTask, archive, remove, getTask } from "./operations";
import { parseTask, type Task, type Status } from "./task";

let root: string;

function makeTask(overrides: Partial<Task>): Task {
  const ts = "2026-08-30T10:00:00.000Z";
  return {
    id: overrides.id ?? "01111111-7f00-4000-8000-000000000001",
    title: overrides.title ?? "test task",
    status: overrides.status ?? "todo",
    rank: overrides.rank ?? 100,
    tags: overrides.tags ?? ["test"],
    created: overrides.created ?? ts,
    updated: overrides.updated ?? ts,
    ...(overrides.due !== undefined ? { due: overrides.due } : {}),
    ...(overrides.completed !== undefined ? { completed: overrides.completed } : {}),
    ...(overrides.body !== undefined ? { body: overrides.body } : {}),
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kanban-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("repo: directories & files", () => {
  it("creates tasks/archive dirs lazily via ensureDirs", async () => {
    const tasks = await listTasks(root);
    expect(tasks).toEqual([]);
    expect(existsSync(tasksDir(root))).toBe(true);
    expect(existsSync(archiveDir(root))).toBe(true);
  });

  it("exposes the events file path", () => {
    expect(eventsFile(root)).toBe(join(root, "events.jsonl"));
  });
});

describe("repo: writeTask + listTasks", () => {
  it("writes a task and reads it back sorted by column then rank", async () => {
    await writeTask(root, makeTask({ id: "0...1", status: "doing", rank: 50 }));
    await writeTask(root, makeTask({ id: "0...2", status: "todo", rank: 10 }));
    await writeTask(root, makeTask({ id: "0...3", status: "todo", rank: 5 }));
    const tasks = await listTasks(root);
    expect(tasks.map((t) => t.status)).toEqual(["todo", "todo", "doing"]);
    expect(tasks.map((t) => t.rank)).toEqual([5, 10, 50]);
  });

  it("round-trips body content through write/read", async () => {
    await writeTask(root, makeTask({ body: "## 状況\n- 進捗がある" }));
    const [task] = await listTasks(root);
    expect(task?.body).toContain("進捗がある");
  });

  it("skips corrupt task files instead of failing the board", async () => {
    await writeTask(root, makeTask({ id: "0...good" }));
    await writeTask(root, makeTask({ id: "0...bad" }));
    // manually corrupt one file
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tasksDir(root), "0...bad.md"), "not a task file", "utf8");
    const tasks = await listTasks(root);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe("0...good");
  });

  it("rejects a task whose id does not match its filename", async () => {
    await writeTask(root, makeTask({ id: "0...real" }));
    const { rename } = await import("node:fs/promises");
    await rename(
      join(tasksDir(root), "0...real.md"),
      join(tasksDir(root), "0...renamed.md"),
    );
    await expect(listTasks(root)).resolves.toEqual([]);
  });
});

describe("repo: rank helpers", () => {
  it("computes append rank past the max", async () => {
    await writeTask(root, makeTask({ id: "0...1", status: "todo", rank: 100 }));
    await writeTask(root, makeTask({ id: "0...2", status: "todo", rank: 50 }));
    const { appendRank } = await import("./repo");
    const col = await listTasks(root);
    const todos = col.filter((t) => t.status === "todo");
    expect(appendRank(todos)).toBe(100 + 1024);
  });
});

describe("repo: archive & delete", () => {
  it("moves a task to archive/", async () => {
    await writeTask(root, makeTask({ id: "0...a" }));
    await archiveTask(root, "0...a");
    expect(existsSync(join(tasksDir(root), "0...a.md"))).toBe(false);
    expect(existsSync(join(archiveDir(root), "0...a.md"))).toBe(true);
    const archived = await listArchive(root);
    expect(archived).toHaveLength(1);
  });

  it("archives a task that is ignored when listed as active", async () => {
    await writeTask(root, makeTask({ id: "0...b" }));
    await archiveTask(root, "0...b");
    const active = await listTasks(root);
    expect(active).toHaveLength(0);
  });

  it("deletes a task file and returns false when missing", async () => {
    await writeTask(root, makeTask({ id: "0...c" }));
    expect(await deleteTask(root, "0...c")).toBe(true);
    expect(await deleteTask(root, "0...c")).toBe(false);
  });
});

describe("repo: events", () => {
  it("appends and reads events (append-only)", async () => {
    await appendEvent(root, { ts: "2026-08-30T10:00Z", task: "0...x", field: "status", to: "todo", actor: "ui" });
    await appendEvent(root, { ts: "2026-08-30T11:00Z", task: "0...x", field: "status", from: "todo", to: "doing", actor: "ai" });
    const events = await readEvents(root);
    expect(events).toHaveLength(2);
    expect(events[1]?.actor).toBe("ai");
    expect(events[1]?.from).toBe("todo");
  });

  it("returns [] when there are no events yet", async () => {
    expect(await readEvents(root)).toEqual([]);
  });

  it("skips malformed lines", async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(eventsFile(root), "not-json\n{\"ts\":\"t\",\"task\":\"id\",\"field\":\"status\",\"to\":\"todo\",\"actor\":\"ui\"}\n", "utf8");
    const events = await readEvents(root);
    expect(events).toHaveLength(1);
  });
});

describe("operations: createTask", () => {
  it("creates a task with default status todo and append rank", async () => {
    const task = await createTask(root, { title: "hello" }, "ai");
    expect(task.status).toBe("todo");
    expect(task.rank).toBe(2048);
    expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    const events = await readEvents(root);
    expect(events).toHaveLength(1);
    expect(events[0]?.actor).toBe("ai");
    expect(events[0]?.to).toBe("todo");
  });

  it("records terminal completed timestamp for terminal statuses", async () => {
    const task = await createTask(root, { title: "done task", status: "done" }, "ui");
    expect(task.completed).toBeDefined();
  });
});

describe("operations: moveTask", () => {
  it("moves between statuses and records an event", async () => {
    const task = await createTask(root, { title: "x", status: "todo" }, "ui");
    const result = await moveTask(root, task.id, "doing", "ai");
    expect(result.changed).toBe(true);
    const updated = await getTask(root, task.id);
    expect(updated?.status).toBe("doing");
    const events = await readEvents(root);
    const transition = events.find((e) => e.from === "todo" && e.to === "doing");
    expect(transition?.actor).toBe("ai");
  });

  it("returns changed:false when already in the target status", async () => {
    const task = await createTask(root, { title: "x", status: "doing" }, "ui");
    const result = await moveTask(root, task.id, "doing", "ai");
    expect(result.changed).toBe(false);
  });

  it("sets completed on terminal move and clears it on re-activation", async () => {
    const task = await createTask(root, { title: "x", status: "doing" }, "ui");
    await moveTask(root, task.id, "done", "ui");
    expect((await getTask(root, task.id))?.completed).toBeDefined();
    await moveTask(root, task.id, "doing", "ui");
    expect((await getTask(root, task.id))?.completed).toBeUndefined();
  });

  it("throws on unknown status", async () => {
    const task = await createTask(root, { title: "x" }, "ui");
    await expect(moveTask(root, task.id, "nope" as Status, "ui")).rejects.toThrow(
      /Unknown status/,
    );
  });

  it("throws when the task does not exist", async () => {
    await expect(moveTask(root, "0...missing", "todo", "ui")).rejects.toThrow(/not found/);
  });

  it("honors an explicit rank in opts", async () => {
    const task = await createTask(root, { title: "x", status: "todo", rank: 10 }, "ui");
    await moveTask(root, task.id, "waiting", "ui", { rank: 3.5 });
    expect((await getTask(root, task.id))?.rank).toBe(3.5);
  });
});

describe("operations: editTask", () => {
  it("edits provided fields only", async () => {
    const task = await createTask(root, { title: "orig", tags: ["a"], due: "2026-09-01" }, "ui");
    const updated = await editTask(root, task.id, { title: "changed", rank: 5 });
    expect(updated?.title).toBe("changed");
    expect(updated?.tags).toEqual(["a"]);
    expect(updated?.due).toBe("2026-09-01");
    expect(updated?.rank).toBe(5);
  });

  it("clears due via null", async () => {
    const task = await createTask(root, { title: "orig", due: "2026-09-01" }, "ui");
    const updated = await editTask(root, task.id, { due: null });
    expect(updated?.due).toBeUndefined();
  });

  it("returns undefined for a missing task", async () => {
    expect(await editTask(root, "0...missing", { title: "x" })).toBeUndefined();
  });
});

describe("operations: archive & remove", () => {
  it("archives a task and moves it out of active list", async () => {
    const task = await createTask(root, { title: "x" }, "ui");
    const ok = await archive(root, task.id);
    expect(ok).toBe(true);
    expect(await listTasks(root)).toHaveLength(0);
    expect(await listArchive(root)).toHaveLength(1);
  });

  it("returns false when archiving a missing task", async () => {
    expect(await archive(root, "0...missing")).toBe(false);
  });

  it("removes a task entirely", async () => {
    const task = await createTask(root, { title: "x" }, "ui");
    expect(await remove(root, task.id)).toBe(true);
    expect(await getTask(root, task.id)).toBeUndefined();
  });
});

describe("parseTask edge cases", () => {
  it("parses a file with no body", () => {
    const raw = `---
id: 01111111-7f00-4000-8000-000000000001
title: no body
status: todo
rank: 1
tags: []
created: '2026-08-30T10:00:00.000Z'
updated: '2026-08-30T10:00:00.000Z'
---
`;
    const task = parseTask(raw);
    expect(task.body).toBeUndefined();
  });

  it("throws on missing frontmatter", () => {
    expect(() => parseTask("# just markdown")).toThrow(/frontmatter/);
  });

  it("throws on invalid status", () => {
    const raw = `---
id: 01111111-7f00-4000-8000-000000000001
title: x
status: nope
rank: 1
tags: []
created: ''
updated: ''
---
`;
    expect(() => parseTask(raw)).toThrow(/unknown status/);
  });

  it("throws on missing id", () => {
    const raw = `---
title: x
status: todo
rank: 1
tags: []
created: ''
updated: ''
---
`;
    expect(() => parseTask(raw)).toThrow(/missing id/);
  });
});
