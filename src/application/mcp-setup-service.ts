import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  type McpEntry,
  type McpHost,
  type McpInstance,
  type McpWriteOpts,
  type McpWriteResult,
  buildMcpEntry,
} from "../domain/mcp-entry.js";
import type { EnvPort } from "../ports/env.js";
import { McpWriterError, writeMcpEntry } from "./mcp-host-writer.js";

export interface McpSetupInput {
  hosts: McpHost[];
  instances: McpInstance[];
  scope: "workspace" | "global";
  workspace?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface McpSetupResult {
  scope: "workspace" | "global";
  scope_dir: string;
  dry_run: boolean;
  applied: McpWriteResult[];
  skipped: McpWriteResult[];
  errors: { host: McpHost; instance: McpInstance; target: string; message: string }[];
}

export interface McpSetupRefusal {
  ok: false;
  error: string;
  hint: string;
  exitCode: 2;
}

export function runMcpSetup(env: EnvPort, input: McpSetupInput): McpSetupResult | McpSetupRefusal {
  if (input.scope === "global" && !input.force && !input.dryRun) {
    return {
      ok: false,
      error: "global_requires_force",
      hint: "Tocar '~/.claude/settings.json' o '~/.codex/config.toml' afecta TODOS los proyectos. Reintentá con --force o usá --dry-run para previsualizar.",
      exitCode: 2,
    };
  }

  const scopeDir = resolveScopeDir(env, input);
  const opts: McpWriteOpts = {
    dryRun: input.dryRun ?? false,
    force: input.force ?? false,
  };

  const applied: McpWriteResult[] = [];
  const skipped: McpWriteResult[] = [];
  const errors: McpSetupResult["errors"] = [];

  for (const host of input.hosts) {
    for (const instance of input.instances) {
      applyOne(host, instance, scopeDir, opts, applied, skipped, errors);
    }
  }

  return {
    scope: input.scope,
    scope_dir: scopeDir,
    dry_run: Boolean(input.dryRun),
    applied,
    skipped,
    errors,
  };
}

function applyOne(
  host: McpHost,
  instance: McpInstance,
  scopeDir: string,
  opts: McpWriteOpts,
  applied: McpWriteResult[],
  skipped: McpWriteResult[],
  errors: McpSetupResult["errors"],
): void {
  const entry: McpEntry = buildMcpEntry(instance);
  try {
    const result = writeMcpEntry(host, entry, { scopeDir }, opts);
    if (result.action === "skipped-idempotent") {
      skipped.push(result);
    } else {
      applied.push(result);
    }
  } catch (err) {
    errors.push(toErrorRecord(host, instance, scopeDir, err));
  }
}

function toErrorRecord(
  host: McpHost,
  instance: McpInstance,
  scopeDir: string,
  err: unknown,
): McpSetupResult["errors"][number] {
  if (err instanceof McpWriterError) {
    return {
      host,
      instance,
      target: err.target,
      message: `${err.message}${err.cause ? ` (${err.cause})` : ""}`,
    };
  }
  return { host, instance, target: scopeDir, message: (err as Error).message };
}

function resolveScopeDir(env: EnvPort, input: McpSetupInput): string {
  if (input.scope === "global") return homedir();
  if (input.workspace) return resolve(input.workspace);
  return resolve(env.cwd());
}
