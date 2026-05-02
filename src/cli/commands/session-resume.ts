import { runSessionResume } from "../../application/session-resume-service.js";
import type { CommandResult } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

export const sessionResumeCommand: QtcCommand = {
  name: "session-resume",
  describe: "Load resume payload for a session (objetivo + phase from QTC-PROJECT).",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    const code = args.values.get("code");
    const data = await runSessionResume(ctx.fs, ctx.env, code !== undefined ? { code } : {});
    return { ok: true, data, exitCode: 0 };
  },
};
