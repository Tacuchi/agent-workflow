import { join } from "node:path";
import type { EnvPort } from "../ports/env.js";
import type { FileSystemPort } from "../ports/file-system.js";
import { type ParsedTasks, type TaskItem, parseTasks } from "./parsers/tasks.js";
import { relpath } from "./paths.js";
import { resolveSession } from "./session-resolver.js";

export interface TasksCommandInput {
  code?: string;
  onlyOpen?: boolean;
  verbose?: boolean;
}

export interface TasksCommandOutput {
  session: string;
  path: string;
  exists: boolean;
  total: number;
  open: number;
  closed: number;
  progress_pct: number;
  items: TaskItem[];
  next_open: TaskItem | null;
}

export interface TasksCommandError {
  error: string;
  code: string | null;
}

export type TasksCommandResult = TasksCommandOutput | TasksCommandError;

export async function runTasksCommand(
  fs: FileSystemPort,
  env: EnvPort,
  input: TasksCommandInput,
): Promise<TasksCommandResult> {
  const session = await resolveSession(fs, env, input.code, true);
  if (!session) {
    return { error: "session_not_found", code: input.code ?? null };
  }
  const tasksPath = join(session.path, "TASKS.md");
  const cwd = env.cwd();
  const verbose = input.verbose === true;
  const pathOut = verbose ? tasksPath : relpath(tasksPath, cwd);

  if (!(await fs.exists(tasksPath))) {
    return {
      session: session.folder,
      path: pathOut,
      exists: false,
      total: 0,
      open: 0,
      closed: 0,
      progress_pct: 0,
      items: [],
      next_open: null,
    };
  }

  const text = await fs.readText(tasksPath);
  const parsed: ParsedTasks = parseTasks(text, !verbose);
  let items = parsed.items;
  if (input.onlyOpen === true) {
    items = items.filter((t) => t.status === "open");
  }

  return {
    session: session.folder,
    path: pathOut,
    exists: true,
    total: parsed.total,
    open: parsed.open,
    closed: parsed.closed,
    progress_pct: parsed.progress_pct,
    items,
    next_open: parsed.next_open,
  };
}
