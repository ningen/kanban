import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { listTasks, readEvents } from "../core/operations";
import { ACTOR_AI } from "../core/task";
import { cliMain, runCli } from "./index";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kanban-cli-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Run the CLI in-process, capturing stdout so assertions see printed output. */
async function run(args: string[]): Promise<string[]> {
  const log = spyOn(console, "log").mockImplementation(() => {});
  const lines: string[] = [];
  log.mockImplementation((...parts: unknown[]) => {
    lines.push(parts.map(String).join(" "));
  });
  try {
    await runCli(args, root);
  } finally {
    log.mockRestore();
  }
  return lines;
}

/** Run the CLI expecting a usage error (exit-code-1 path via CliError). */
async function runFail(args: string[]): Promise<string> {
  let captured = "";
  try {
    await runCli(args, root);
  } catch (err) {
    captured = err instanceof Error ? err.message : String(err);
  }
  return captured;
}

describe("cli: add", () => {
  it("creates a task, records an event with actor ai", async () => {
    const lines = await run(["add", "書類の棚卸し", "--tags", "work,docs"]);
    expect(lines.some((l) => l.includes("Created"))).toBe(true);
    const events = await readEvents(root);
    expect(events).toHaveLength(1);
    expect(events[0]?.actor).toBe(ACTOR_AI);
  });

  it("throws a usage error without a title", async () => {
    const msg = await runFail(["add"]);
    expect(msg).toContain("Usage: kanban add");
  });
});

describe("cli: list", () => {
  it("lists tasks grouped by column", async () => {
    await run(["add", "A"]);
    await run(["add", "B", "--status", "doing"]);
    const lines = await run(["list"]);
    expect(lines.some((l) => l === "TODO:")).toBe(true);
    expect(lines.some((l) => l === "DOING:")).toBe(true);
    expect(lines.some((l) => l.includes("B"))).toBe(true);
  });

  it("filters by --status", async () => {
    await run(["add", "A", "--status", "todo"]);
    await run(["add", "B", "--status", "doing"]);
    const lines = await run(["list", "--status", "doing"]);
    expect(lines.some((l) => l.includes("B"))).toBe(true);
    expect(lines.some((l) => l.includes("TODO"))).toBe(false);
  });

  it("outputs JSON with --json", async () => {
    await run(["add", "A", "--tags", "work"]);
    const lines = await run(["list", "--json"]);
    const json = lines.join("").trim();
    const parsed = JSON.parse(json) as Array<{ title: string; tags: string[] }>;
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed[0]?.title).toBe("A");
    expect(parsed[0]?.tags).toEqual(["work"]);
  });
});

describe("cli: show", () => {
  it("prints a task with its body", async () => {
    const lines = await run(["add", "Show me", "--body", "## 詳細"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["show", id]);
    expect(out.some((l) => l.includes("Show me"))).toBe(true);
    expect(out.some((l) => l.includes("## 詳細"))).toBe(true);
  });

  it("outputs JSON with --json", async () => {
    const lines = await run(["add", "JSON task"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["show", id, "--json"]);
    const parsed = JSON.parse(out.join("").trim()) as { title: string };
    expect(parsed.title).toBe("JSON task");
  });

  it("throws for a missing task", async () => {
    const msg = await runFail(["show", "0...missing"]);
    expect(msg).toContain("Task not found");
  });
});

describe("cli: note", () => {
  it("appends a Markdown note to the body", async () => {
    const lines = await run(["add", "Note target"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["note", id, "- 進捗メモ", "を追加"]);
    expect(out.some((l) => l.includes("Note added"))).toBe(true);
    const show = await run(["show", id, "--json"]);
    const parsed = JSON.parse(show.join("").trim()) as { body: string };
    expect(parsed.body).toContain("進捗メモ を追加");
  });

  it("throws without args", async () => {
    const msg = await runFail(["note"]);
    expect(msg).toContain("Usage: kanban note");
  });

  it("throws for a missing task", async () => {
    const msg = await runFail(["note", "0...missing", "x"]);
    expect(msg).toContain("Task not found");
  });
});

describe("cli: move", () => {
  it("moves a task and records the transition", async () => {
    const lines = await run(["add", "C"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["move", id, "waiting"]);
    expect(out.some((l) => l.includes("Moved"))).toBe(true);
    const events = await readEvents(root);
    expect(
      events.find((e) => e.task === id && e.from === "todo" && e.to === "waiting"),
    ).toBeDefined();
  });

  it("throws a usage error without args", async () => {
    const msg = await runFail(["move"]);
    expect(msg).toContain("Usage: kanban move");
  });

  it("reports when already in the target status", async () => {
    const lines = await run(["add", "D", "--status", "doing"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["move", id, "doing"]);
    expect(out.some((l) => l.includes("Already doing"))).toBe(true);
  });
});

describe("cli: help + serve", () => {
  it("prints usage for the help command", async () => {
    const lines = await run(["help"]);
    expect(lines.some((l) => l.includes("list"))).toBe(true);
  });

  it("prints per-command help for `add --help`", async () => {
    const lines = await run(["add", "--help"]);
    expect(lines.some((l) => l.includes("kanban add"))).toBe(true);
  });

  it("prints per-command help for `note --help`", async () => {
    const lines = await run(["note", "--help"]);
    expect(lines.some((l) => l.includes("kanban note"))).toBe(true);
  });

  it("starts the server for the serve command", async () => {
    const serveMock = spyOn(Bun, "serve").mockImplementation(() => ({ port: 0 }) as never);
    const out = await run(["serve"]);
    expect(serveMock).toHaveBeenCalled();
    expect(out.some((l) => l.includes("running"))).toBe(true);
    serveMock.mockRestore();
  });
});

describe("cli: edit", () => {
  it("edits a title and rank", async () => {
    const lines = await run(["add", "old", "--rank", "5"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["edit", id, "--title", "new", "--rank", "7"]);
    expect(out.some((l) => l.includes("new"))).toBe(true);
    const tasks = await listTasks(root);
    expect(tasks[0]?.title).toBe("new");
    expect(tasks[0]?.rank).toBe(7);
  });

  it("moves status via --status", async () => {
    const lines = await run(["add", "x", "--status", "todo"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    await run(["edit", id, "--status", "waiting"]);
    const tasks = await listTasks(root);
    expect(tasks[0]?.status).toBe("waiting");
  });

  it("throws when the task does not exist", async () => {
    const msg = await runFail(["edit", "0...missing", "--title", "x"]);
    expect(msg).toContain("Task not found");
  });

  it("throws when given no id", async () => {
    const msg = await runFail(["edit"]);
    expect(msg).toContain("Usage: kanban edit");
  });
});

describe("cli: search, archive, delete", () => {
  it("searches for a task by title", async () => {
    await run(["add", "週次レビュー"]);
    const out = await run(["search", "レビュー"]);
    expect(out.some((l) => l.includes("週次レビュー"))).toBe(true);
  });

  it("reports no matches", async () => {
    const out = await run(["search", "不存在的"]);
    expect(out.some((l) => l.includes("No matches"))).toBe(true);
  });

  it("throws a usage error when search has no query", async () => {
    const msg = await runFail(["search"]);
    expect(msg).toContain("Usage: kanban search");
  });

  it("archives a task", async () => {
    const lines = await run(["add", "to archive"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["archive", id]);
    expect(out.some((l) => l.includes("Archived"))).toBe(true);
    expect(await listTasks(root)).toHaveLength(0);
  });

  it("throws when archiving a missing task", async () => {
    const msg = await runFail(["archive", "0...missing"]);
    expect(msg).toContain("Task not found");
  });

  it("throws a usage error with no id", async () => {
    const msg = await runFail(["archive"]);
    expect(msg).toContain("Usage: kanban archive");
  });

  it("deletes a task", async () => {
    const lines = await run(["add", "to delete"]);
    const id = lines.join(" ").match(/[0-9a-f-]{36}/)?.[0];
    if (id === undefined) throw new Error("could not read created id");
    const out = await run(["delete", id]);
    expect(out.some((l) => l.includes("Deleted"))).toBe(true);
  });

  it("throws when deleting a missing task", async () => {
    const msg = await runFail(["delete", "0...missing"]);
    expect(msg).toContain("Task not found");
  });

  it("throws a usage error with no id", async () => {
    const msg = await runFail(["delete"]);
    expect(msg).toContain("Usage: kanban delete");
  });

  it("throws on unknown command", async () => {
    const msg = await runFail(["bogus"]);
    expect(msg).toContain("Unknown command");
  });
});

describe("cli: cliMain", () => {
  it("maps a CliError to exit code 1", async () => {
    const exit = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });
    const err = spyOn(console, "error").mockImplementation(() => {});
    const prev = process.env.KANBAN_ROOT;
    process.env.KANBAN_ROOT = root;
    try {
      await cliMain(["bogus"]).catch(() => {});
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      exit.mockRestore();
      err.mockRestore();
      if (prev === undefined) delete process.env.KANBAN_ROOT;
      else process.env.KANBAN_ROOT = prev;
    }
  });
});
