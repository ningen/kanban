/**
 * kanban CLI — the primary interface for the AI agent (and usable by humans).
 *
 * Commands:
 *   list [--status doing] [--json]   list active tasks (grouped)
 *   show <uuid> [--json]             show a task detail (with body)
 *   add "<title>" [--status todo] [--rank 1] [--tags a,b] [--due 2026-09-04]
 *   edit <uuid> [--title ...] [--status ...] [--rank ...] [--tags ...] [--due ...]
 *   move <uuid> <status>             transition and record event
 *   note <uuid> <text>               append a Markdown note to the body
 *   search <query> [--json]          search across titles/body/tags
 *   archive <uuid>                   move to archive/
 *   delete <uuid>                    permanently remove
 *   serve                            start the local web server
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import {
  appendNote,
  archive,
  type CreateInput,
  createTask,
  type EditInput,
  editTask,
  getTask,
  listTasks,
  moveTask,
  readEvents,
  remove,
} from "../core/operations";
import { type StatsReport, summarize } from "../core/stats";
import { ACTOR_AI, BOARD_COLUMNS, isStatus, STATUSES, type Status, type Task } from "../core/task";

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
  "Usage: kanban <command> [args]\nCommands: list, show, add, edit, move, note, search, stats, archive, delete, serve";

/** Per-command help, keyed by command name. */
export const COMMAND_HELP: Record<string, string> = {
  list: "list [--status a,b] [--json]\n  List active tasks, grouped by column.",
  show: "show <uuid> [--json]\n  Show a task's detail (including its body).",
  add: 'add "<title>" [--status s] [--rank n] [--tags a,b] [--due 2026-09-04] [--body "…"]\n  Create a new task.',
  edit: "edit <uuid> [--title …] [--status s] [--rank n] [--tags a,b] [--due d|null] [--body …]\n  Edit task fields. --status records a transition.",
  move: "move <uuid> <status> [--rank n]\n  Move a task to a status and record the transition.",
  note: "note <uuid> <text>\n  Append a Markdown note to the task's body.",
  search: 'search "<query>" [--json]\n  Search titles, tags, and body text.',
  stats: "stats [--period 30] [--json]\n  Show board/throughput/dwell/transition statistics.",
  archive: "archive <uuid>\n  Move a task to archive/.",
  delete: "delete <uuid>\n  Permanently remove a task.",
  serve: "serve\n  Start the local web server (serves the built UI if present).",
};

/** Pretty-print a task list as JSON (for programmatic/AI use). */
function printTaskListJson(tasks: Task[]): void {
  console.log(JSON.stringify(tasks, null, 2));
}

export async function cmdList(root: string, flags: Record<string, string | true>): Promise<void> {
  const tasks = await listTasks(root);
  const statusFilter = typeof flags.status === "string" ? flags.status.split(",") : null;

  if (flags.json === true) {
    const filtered =
      statusFilter === null ? tasks : tasks.filter((t) => statusFilter.includes(t.status));
    printTaskListJson(filtered);
    return;
  }

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

/** Show a single task in detail (with body). */
export async function cmdShow(
  root: string,
  flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  if (id === undefined) {
    throw new CliError("Usage: kanban show <uuid>");
  }
  const task = await getTask(root, id);
  if (task === undefined) {
    throw new CliError(`Task not found: ${id}`);
  }
  if (flags.json === true) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  printTask(task);
  if (task.body !== undefined && task.body.length > 0) {
    console.log("");
    console.log(task.body);
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
    throw new CliError(
      'Usage: kanban add "<title>" [--status todo] [--rank 1] [--tags a,b] [--due 2026-09-04]',
    );
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
    throw new CliError(
      "Usage: kanban edit <uuid> [--title ...] [--status ...] [--rank ...] [--tags ...] [--due ...]",
    );
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
  flags: Record<string, string | true>,
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
  if (flags.json === true) {
    printTaskListJson(matches);
    return;
  }
  if (matches.length === 0) {
    console.log(`No matches for "${query}"`);
    return;
  }
  for (const t of matches) printTask(t);
}

function hoursToDays(h: number): string {
  return `${(h / 24).toFixed(1)}d`;
}

function fmtHours(h: number): string {
  return `${h.toFixed(1)}h`;
}

/** Render a stats report as human-readable text. */
export function printStats(report: StatsReport): void {
  const b = report.board;
  console.log(
    `Board: ${b.total} total · ${b.active} active · ${b.doing} doing · ${b.done} done · ${b.overdue} overdue`,
  );
  const byStatus = STATUSES.map((s) => `${s} ${b.byStatus[s]}`).join(" · ");
  console.log(`  ${byStatus}\n`);

  console.log(`Throughput (last ${report.periodDays}d)`);
  const weekly = report.throughput.weekly;
  if (weekly.length === 0) {
    console.log("  (no activity)");
  } else {
    console.log("  week         created  done");
    for (const w of weekly) {
      console.log(
        `  ${w.weekStart}  ${String(w.created).padStart(7)}  ${String(w.done).padStart(4)}`,
      );
    }
  }

  const lt = report.throughput.leadTime;
  console.log(`\nLead time (${lt.sample} completed)`);
  if (lt.sample > 0) {
    console.log(
      `  avg ${hoursToDays(lt.avgHours)}   median ${hoursToDays(lt.medianHours)}   p90 ${hoursToDays(lt.p90Hours)}   min ${hoursToDays(lt.minHours)}   max ${hoursToDays(lt.maxHours)}`,
    );
  } else {
    console.log("  (no completed tasks yet)");
  }

  console.log("\nDwell time (all time)");
  console.log("  status     visits  total   avg");
  for (const d of report.dwell) {
    console.log(
      `  ${d.status.padEnd(8)} ${String(d.visits).padStart(6)}  ${fmtHours(d.totalHours).padStart(7)}  ${fmtHours(d.avgHours).padStart(6)}`,
    );
  }

  const { byMove, byActor } = report.transitions;
  console.log("\nTransitions");
  if (byMove.length === 0) {
    console.log("  (no status moves yet)");
  } else {
    for (const m of byMove) {
      console.log(`  ${m.from} -> ${m.to}    ${m.count}`);
    }
  }
  console.log(`  actor split: ui ${byActor.ui} · ai ${byActor.ai}`);
}

export async function cmdStats(root: string, flags: Record<string, string | true>): Promise<void> {
  const events = await readEvents(root);
  const tasks = await listTasks(root);
  const periodDays = flagNumber(flags, "period");
  const report = summarize(events, tasks, periodDays === undefined ? {} : { periodDays });
  if (flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printStats(report);
}

/** Append a Markdown note to a task body. */
export async function cmdNote(
  root: string,
  flags: Record<string, string | true>,
  positional: string[],
): Promise<void> {
  const id = positional[0];
  if (id === undefined) {
    throw new CliError("Usage: kanban note <uuid> <text>");
  }
  const note = positional.slice(1).join(" ").trim();
  if (note.length === 0) {
    throw new CliError("Usage: kanban note <uuid> <text>");
  }
  const task = await appendNote(root, id, note);
  if (task === undefined) {
    throw new CliError(`Task not found: ${id}`);
  }
  if (flags.json === true) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  console.log(`Note added to ${id}`);
  printTask(task);
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
  // Serve the built frontend from the project's src/ui/dist if it exists.
  const uiDist = join(import.meta.dir, "..", "ui", "dist");
  if (existsSync(uiDist)) {
    await startServer({ root, staticDir: uiDist });
  } else {
    await startServer({ root });
  }
}

/** Run the CLI with the given args; returns a zero exit code or a CliError. */
export async function runCli(args: string[], root?: string): Promise<void> {
  const { flags, positional } = parseArgs(args);
  const command = positional[0] ?? "list";
  const resolvedRoot = root ?? resolveRoot();
  // ensure the data directories exist up front
  mkdirSync(join(resolvedRoot, "tasks"), { recursive: true });
  mkdirSync(join(resolvedRoot, "archive"), { recursive: true });

  // Per-command help: `kanban <cmd> --help` / `-h`.
  if (flags.help === true || flags.h === true) {
    const help = COMMAND_HELP[command];
    if (help !== undefined) {
      console.log(`kanban ${help}`);
    } else {
      console.log(USAGE);
    }
    return;
  }

  switch (command) {
    case "list":
    case "ls":
      await cmdList(resolvedRoot, flags);
      break;
    case "show":
      await cmdShow(resolvedRoot, flags, positional.slice(1));
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
    case "note":
      await cmdNote(resolvedRoot, flags, positional.slice(1));
      break;
    case "search":
      await cmdSearch(resolvedRoot, flags, positional.slice(1));
      break;
    case "stats":
      await cmdStats(resolvedRoot, flags);
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
