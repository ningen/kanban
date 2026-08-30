/**
 * kanban CLI — the primary interface for the AI agent (and usable by humans).
 *
 * Commands:
 *   list                          list active tasks (grouped)
 *   list --status doing           filter by status
 *   add "<title>" [--status todo] [--rank 1] [--tags a,b] [--due 2026-09-04]
 *   edit <uuid> [--title ...] [--status ...] [--rank ...] [--tags ...] [--due ...]
 *   move <uuid> <status>          transition and record event
 *   search <query>                search across titles/body/tags
 *   archive <uuid>                move to archive/
 *   delete <uuid>                 permanently remove
 *   serve                         start the local web server
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  createTask,
  editTask,
  moveTask,
  archive,
  remove,
  listTasks,
  getTask,
  type CreateInput,
  type EditInput,
} from "../core/operations";
import {
  isStatus,
  BOARD_COLUMNS,
  ACTOR_AI,
  type Status,
  type Task,
} from "../core/task";

/** Errors that should surface as a usage/exit-1 message, not a stack trace. */
export class CliError extends Error {}

/** Determine the repo root: KANBAN_ROOT env, or ~/kanban. */
export function resolveRoot(): string {
  const env = process.env.KANBAN_ROOT;
  if (env !== undefined) return env;
  return join(homedir(), "kanban");
}

export interface Args {
  flags: Record<string, string | true>;
  positional: string[];
}

export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const parts = arg.slice(2).split("=");
      const name = parts[0];
      if (name === undefined) continue;
      // Support --flag=value and --flag value.
      if (parts.length > 1) {
        flags[name] = parts.slice(1).join("=");
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[name] = next;
          i++; // consume the value
        } else {
          flags[name] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

export function parseTags(value: string | true | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function statusFromString(value: string): Status {
  if (!isStatus(value)) {
    throw new CliError(
      `Unknown status '${value}'. Allowed: ${["todo", "doing", "waiting", "done", "wontdo"].join(", ")}`,
    );
  }
  return value;
}

export function printTask(t: Task): void {
  const tagStr = t.tags.length > 0 ? ` [${t.tags.join(", ")}]` : "";
  const dueStr = t.due !== undefined ? ` (due ${t.due})` : "";
  console.log(`  ${t.id}  ${t.title}${tagStr}${dueStr}  rank=${t.rank}`);
}

export const USAGE =
  "Usage: kanban <command> [args]\nCommands: list, add, edit, move, search, archive, delete, serve";

export async function cmdList(
  root: string,
  flags: Record<string, string | true>,
): Promise<void> {
  const tasks = await listTasks(root);
  const statusFilter =
    typeof flags.status === "string" ? flags.status.split(",") : null;
  const grouped = new Map<string, Task[]>();
  for (const t of tasks) {
    if (statusFilter !== null && !statusFilter.includes(t.status)) continue;
    const bucket = grouped.get(t.status) ?? [];
    bucket.push(t);
    grouped.set(t.status, bucket);
  }
  for (const col of BOARD_COLUMNS) {
    const bucket = grouped.get(col.status);
    if (bucket === undefined || bucket.length === 0) continue;
    console.log(`${col.label}:`);
    for (const t of bucket) printTask(t);
    console.log("");
  }
}

function flagString(flags: Record<string, string | true>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function flagNumber(flags: Record<string, string | true>, name: string): number | undefined {
  const value = flagString(flags, name);
  return value === undefined ? undefined : Number.parseFloat(value);
}

export async function cmdAdd(
  root: string,
  flags: Record<string, string | true>,
  titleArg: string | undefined,
): Promise<void> {
  if (titleArg === undefined || titleArg.length === 0) {
    throw new CliError('Usage: kanban add "<title>" [--status todo] [--rank 1] [--tags a,b] [--due 2026-09-04]');
  }
  const status = flagString(flags, "status");
  const rank = flagNumber(flags, "rank");
  const due = flagString(flags, "due");
  const body = flagString(flags, "body");
  const tags = parseTags(flags.tags);

  const input: CreateInput = { title: titleArg };
  if (status !== undefined) input.status = statusFromString(status);
  if (rank !== undefined) input.rank = rank;
  if (due !== undefined) input.due = due;
  if (body !== undefined) input.body = body;
  if (tags.length > 0) input.tags = tags;

  const task = await createTask(root, input, ACTOR_AI);
  console.log(`Created ${task.id}`);
  printTask(task);
}

export async function cmdEdit(
  root: string,
  flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  if (id === undefined) {
    throw new CliError('Usage: kanban edit <uuid> [--title ...] [--status ...] [--rank ...] [--tags ...] [--due ...]');
  }
  // Support status change via edit as well.
  const status = flagString(flags, "status");
  if (status !== undefined) {
    await moveTask(root, id, statusFromString(status), ACTOR_AI);
  }

  const title = flagString(flags, "title");
  const rank = flagNumber(flags, "rank");
  const due = flags.due;
  const body = flagString(flags, "body");
  const tags = parseTags(flags.tags);

  const input: EditInput = {};
  if (title !== undefined) input.title = title;
  if (rank !== undefined) input.rank = rank;
  // `due` distinguishes "not provided" (undefined) from "clear" (null).
  if (typeof due === "string") input.due = due === "null" ? null : due;
  if (body !== undefined) input.body = body;
  if (tags.length > 0) input.tags = tags;

  const task = await editTask(root, id, input);
  if (task === undefined) {
    throw new CliError(`Task not found: ${id}`);
  }
  console.log(`Updated ${task.id}`);
  printTask(task);
}

export async function cmdMove(
  root: string,
  flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  const status = positional[1];
  if (id === undefined || status === undefined) {
    throw new CliError("Usage: kanban move <uuid> <status>");
  }
  const rank = flagNumber(flags, "rank");
  const result = await moveTask(
    root,
    id,
    statusFromString(status),
    ACTOR_AI,
    rank === undefined ? undefined : { rank },
  );
  if (!result.changed) {
    console.log(`Already ${status}`);
    return;
  }
  const task = await getTask(root, id);
  console.log(`Moved ${id} -> ${status}`);
  if (task !== undefined) printTask(task);
}

export async function cmdSearch(
  root: string,
  _flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const query = positional.join(" ").toLowerCase();
  if (query.length === 0) {
    throw new CliError("Usage: kanban search <query>");
  }
  const tasks = await listTasks(root);
  const matches = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(query) ||
      t.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      (t.body ?? "").toLowerCase().includes(query),
  );
  if (matches.length === 0) {
    console.log(`No matches for "${query}"`);
    return;
  }
  for (const t of matches) printTask(t);
}

export async function cmdArchive(
  root: string,
  _flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  if (id === undefined) {
    throw new CliError("Usage: kanban archive <uuid>");
  }
  const ok = await archive(root, id);
  if (!ok) {
    throw new CliError(`Task not found: ${id}`);
  }
  console.log(`Archived ${id}`);
}

export async function cmdDelete(
  root: string,
  _flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  if (id === undefined) {
    throw new CliError("Usage: kanban delete <uuid>");
  }
  const ok = await remove(root, id);
  if (!ok) {
    throw new CliError(`Task not found: ${id}`);
  }
  console.log(`Deleted ${id}`);
}

async function cmdServe(root: string): Promise<void> {
  const { startServer } = await import("../server/index");
  await startServer({ root });
}

/** Run the CLI with the given args; returns a zero exit code or a CliError. */
export async function runCli(args: string[], root?: string): Promise<void> {
  const { flags, positional } = parseArgs(args);
  const command = positional[0] ?? "list";
  const resolvedRoot = root ?? resolveRoot();
  // ensure the data directories exist up front
  mkdirSync(join(resolvedRoot, "tasks"), { recursive: true });
  mkdirSync(join(resolvedRoot, "archive"), { recursive: true });

  switch (command) {
    case "list":
    case "ls":
      await cmdList(resolvedRoot, flags);
      break;
    case "add": {
      const title = positional.slice(1).join(" ").trim();
      await cmdAdd(resolvedRoot, flags, title.length > 0 ? title : undefined);
      break;
    }
    case "edit":
      await cmdEdit(resolvedRoot, flags, positional.slice(1));
      break;
    case "move":
    case "mv":
      await cmdMove(resolvedRoot, flags, positional.slice(1));
      break;
    case "search":
      await cmdSearch(resolvedRoot, flags, positional.slice(1));
      break;
    case "archive":
      await cmdArchive(resolvedRoot, flags, positional.slice(1));
      break;
    case "delete":
    case "rm":
      await cmdDelete(resolvedRoot, flags, positional.slice(1));
      break;
    case "serve":
      await cmdServe(resolvedRoot);
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    default:
      throw new CliError(`Unknown command: ${command}\n${USAGE}`);
  }
}

if (import.meta.main) {
  cliMain(process.argv.slice(2));
}

/** Bootstrap entry point — runs the CLI and maps errors to exit codes. Exported for testing. */
export function cliMain(argv: string[]): Promise<void> {
  return runCli(argv).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exit(err instanceof CliError ? 1 : 2);
    // process.exit never returns; TS needs a value here for the void return.
    return Promise.resolve();
  });
}
