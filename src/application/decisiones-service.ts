import { join } from "node:path";
import type { EnvPort } from "../ports/env.js";
import type { FileSystemPort } from "../ports/file-system.js";
import { type ParsedDecision, parseDecisiones } from "./parsers/decisiones.js";
import { relpath } from "./paths.js";
import { resolveSession } from "./session-resolver.js";

export interface DecisionesCommandInput {
  code?: string;
  full?: boolean;
}

export interface DecisionesCommandOutput {
  session: string;
  path: string;
  exists: boolean;
  count: number;
  items: ParsedDecision[];
}

export interface DecisionesCommandError {
  error: string;
  code: string | null;
}

export type DecisionesCommandResult = DecisionesCommandOutput | DecisionesCommandError;

export async function runDecisionesCommand(
  fs: FileSystemPort,
  env: EnvPort,
  input: DecisionesCommandInput,
): Promise<DecisionesCommandResult> {
  const session = await resolveSession(fs, env, input.code, true);
  if (!session) {
    return { error: "session_not_found", code: input.code ?? null };
  }
  const decPath = join(session.path, "DECISIONES.md");
  const pathPosix = relpath(decPath, env.cwd());

  if (!(await fs.exists(decPath))) {
    return {
      session: session.folder,
      path: pathPosix,
      exists: false,
      count: 0,
      items: [],
    };
  }
  const text = await fs.readText(decPath);
  const items = parseDecisiones(text, input.full === true);
  return {
    session: session.folder,
    path: pathPosix,
    exists: true,
    count: items.length,
    items,
  };
}
