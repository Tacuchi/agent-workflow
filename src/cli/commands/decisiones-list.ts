import { runDecisionesCommand } from "../../application/decisiones-service.js";
import type { CommandResult } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

export const decisionesListCommand: QtcCommand = {
  name: "decisiones-list",
  describe: "List DECISIONES.md entries (DEC-NNN headers + previews).",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    const code = args.values.get("code");
    const full = args.flags.has("--full");
    const input: { code?: string; full?: boolean } = {};
    if (code !== undefined) input.code = code;
    if (full) input.full = true;
    const data = await runDecisionesCommand(ctx.fs, ctx.env, input);
    return { ok: true, data, exitCode: 0 };
  },
};
