import type { CliContext } from "../../cli/types.js";
import type { CommandResult } from "../../domain/types.js";

export interface SelfNamespaceData {
  namespace: string;
  source: string;
}

export async function selfNamespace(ctx: CliContext): Promise<CommandResult<SelfNamespaceData>> {
  return {
    ok: true,
    data: {
      namespace: ctx.namespace.namespace,
      source: ctx.namespace.source,
    },
    exitCode: 0,
  };
}
