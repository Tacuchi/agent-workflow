import { runTasksCommand } from "../../application/tasks-service.js";
import type { CommandResult } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

export const tasksDataCommand: QtcCommand = {
  name: "tasks-data",
  describe: "Parse TASKS.md of a session with counts and items.",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    const code = args.values.get("code");
    const onlyOpen = args.flags.has("--only-open");
    const verbose = args.flags.has("--verbose");
    const input: { code?: string; onlyOpen?: boolean; verbose?: boolean } = {};
    if (code !== undefined) input.code = code;
    if (onlyOpen) input.onlyOpen = true;
    if (verbose) input.verbose = true;
    const data = await runTasksCommand(ctx.fs, ctx.env, ctx.paths, input);
    return { ok: true, data, exitCode: 0 };
  },
};
