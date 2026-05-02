import { runProjectMdRead } from "../../application/project-md-service.js";
import type { CommandResult } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

export const projectMdUpsertCommand: QtcCommand = {
  name: "project-md-upsert",
  describe: "Read or update the QTC-PROJECT block in CLAUDE.md/AGENTS.md.",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    if (args.flags.has("--read")) {
      const verbose = args.flags.has("--verbose");
      const data = await runProjectMdRead(ctx.fs, ctx.env, { verbose });
      return { ok: true, data, exitCode: 0 };
    }
    return {
      ok: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message:
          "Write operations (--init, --add-session, --remove-session, --update-phase) ship in Wave 1B (write commands).",
      },
      exitCode: 1,
    };
  },
};
