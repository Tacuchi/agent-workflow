import { runDependenciasCommand } from "../../application/dependencias-service.js";
import type { CommandResult } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

export const dependenciasListCommand: QtcCommand = {
  name: "dependencias-list",
  describe: "List DEPENDENCIAS.md table rows as JSON.",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    const code = args.values.get("code");
    const data = await runDependenciasCommand(ctx.fs, ctx.env, code !== undefined ? { code } : {});
    return { ok: true, data, exitCode: 0 };
  },
};
