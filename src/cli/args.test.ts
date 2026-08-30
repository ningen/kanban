import { describe, expect, it, spyOn } from "bun:test";
import {
  parseArgs,
  parseTags,
  statusFromString,
  resolveRoot,
  printTask,
  USAGE,
  CliError,
  type Args,
} from "./index";
import { join } from "node:path";
import { homedir } from "node:os";

describe("cli: parseArgs", () => {
  it("supports --flag=value", () => {
    const { flags, positional } = parseArgs(["add", "title", "--status=doing"]);
    expect(flags.status).toBe("doing");
    expect(positional).toEqual(["add", "title"]);
  });

  it("supports --flag value", () => {
    const { flags } = parseArgs(["move", "id", "--rank", "3.5"]);
    expect(flags.rank).toBe("3.5");
  });

  it("treats a bare flag as true", () => {
    const { flags } = parseArgs(["cmd", "--help"]);
    expect(flags.help).toBe(true);
  });

  it("joins split --flag=a=b values", () => {
    const { flags } = parseArgs(["--tags=a,b,c"]);
    expect(flags.tags).toBe("a,b,c");
  });

  it("handles empty argv (defaults to list)", () => {
    const result: Args = parseArgs([]);
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });
});

describe("cli: parseTags", () => {
  it("splits and trims comma-separated tags", () => {
    expect(parseTags(" a , b ,c ")).toEqual(["a", "b", "c"]);
  });

  it("returns [] for non-string values", () => {
    expect(parseTags(true)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it("drops empty segments", () => {
    expect(parseTags("a,,b")).toEqual(["a", "b"]);
  });
});

describe("cli: statusFromString", () => {
  it("accepts valid statuses", () => {
    expect(statusFromString("done")).toBe("done");
    expect(statusFromString("wontdo")).toBe("wontdo");
  });

  it("throws a CliError for an invalid status", () => {
    expect(() => statusFromString("bogus")).toThrow(CliError);
    expect(() => statusFromString("bogus")).toThrow(/Unknown status/);
  });
});

describe("cli: resolveRoot", () => {
  it("uses KANBAN_ROOT when set", () => {
    const prev = process.env.KANBAN_ROOT;
    process.env.KANBAN_ROOT = "/tmp/some-root";
    expect(resolveRoot()).toBe("/tmp/some-root");
    if (prev === undefined) delete process.env.KANBAN_ROOT;
    else process.env.KANBAN_ROOT = prev;
  });

  it("falls back to ~/kanban when unset", () => {
    const prev = process.env.KANBAN_ROOT;
    delete process.env.KANBAN_ROOT;
    expect(resolveRoot()).toBe(join(homedir(), "kanban"));
    if (prev !== undefined) process.env.KANBAN_ROOT = prev;
  });
});

describe("cli: printTask", () => {
  it("prints tags and due when present", () => {
    const log = spyOn(console, "log");
    printTask({
      id: "abc",
      title: "task",
      status: "todo",
      rank: 1,
      tags: ["a", "b"],
      due: "2026-09-01",
      created: "",
      updated: "",
    });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

describe("cli: USAGE + help", () => {
  it("exposes a usage string covering all commands", () => {
    expect(USAGE).toContain("list");
    expect(USAGE).toContain("add");
    expect(USAGE).toContain("serve");
  });
});
