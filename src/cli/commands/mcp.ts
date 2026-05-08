import { runHarness } from "../../application/dev-only-services.js";
import { DbhubLauncherError, runDbhubLauncher } from "../../application/mcp-dbhub-launcher.js";
import { runMcpDoctor } from "../../application/mcp-doctor-service.js";
import { runMcpSetup } from "../../application/mcp-setup-service.js";
import type { McpHost, McpInstance } from "../../domain/mcp-entry.js";
import type { CommandResult, ExitCode } from "../../domain/types.js";
import type { ParsedArgs } from "../parser.js";
import type { QtcCommand } from "../registry.js";
import type { CliContext } from "../types.js";

const HOST_VALUES: ReadonlySet<string> = new Set(["claude", "codex", "both"]);
const INSTANCE_VALUES: ReadonlySet<string> = new Set(["cert", "prod", "both"]);

export const mcpCommand: QtcCommand = {
  name: "mcp",
  describe:
    "MCP server tooling. Subcomandos: dbhub <instance> | setup [--host h] [--instance i] [--workspace dir] [--global] [--dry-run] [--force] | doctor [--host h] [--instance i] [--workspace dir] [--global] [--json].",
  async execute(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
    const subcommand = args.rest[0];
    if (subcommand === "dbhub") return runDbhubSub(args, ctx);
    if (subcommand === "setup") return runSetupSub(args, ctx);
    if (subcommand === "doctor") return runDoctorSub(args, ctx);
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "mcp requiere subcomando: dbhub <instance> | setup | doctor",
      },
      exitCode: 1,
    };
  },
};

async function runDbhubSub(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
  const instance = args.rest[1];
  if (!instance) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "mcp dbhub requiere instance: cert | prod",
      },
      exitCode: 1,
    };
  }
  try {
    const result = await runDbhubLauncher({
      instance,
      deps: {
        env: { ...process.env },
        paths: ctx.paths,
        platform: process.platform,
      },
    });
    return { ok: true, data: undefined, exitCode: clampExit(result.exitCode) };
  } catch (err) {
    if (err instanceof DbhubLauncherError) {
      return {
        ok: false,
        error: { code: "DBHUB_LAUNCHER_FAILED", message: err.message },
        exitCode: 1,
      };
    }
    throw err;
  }
}

async function runSetupSub(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
  const hosts = resolveHosts(args, ctx);
  if (!("value" in hosts)) return hosts;
  const instances = resolveInstances(args);
  if (!("value" in instances)) return instances;

  const workspace = args.values.get("workspace");
  const result = runMcpSetup(ctx.env, {
    hosts: hosts.value,
    instances: instances.value,
    scope: args.flags.has("--global") ? "global" : "workspace",
    ...(workspace !== undefined ? { workspace } : {}),
    dryRun: args.flags.has("--dry-run"),
    force: args.flags.has("--force"),
  });

  if ("ok" in result) {
    return {
      ok: false,
      error: {
        code: "GLOBAL_REQUIRES_FORCE",
        message: result.hint,
      },
      data: result,
      exitCode: result.exitCode,
    };
  }

  const hasErrors = result.errors.length > 0;
  return {
    ok: !hasErrors,
    data: result,
    ...(hasErrors
      ? {
          error: {
            code: "MCP_SETUP_PARTIAL",
            message: `${result.errors.length} error(es) durante setup; ver data.errors`,
          },
        }
      : {}),
    exitCode: hasErrors ? 1 : 0,
  };
}

async function runDoctorSub(args: ParsedArgs, ctx: CliContext): Promise<CommandResult> {
  const hosts = resolveHosts(args, ctx);
  if (!("value" in hosts)) return hosts;
  const instances = resolveInstances(args);
  if (!("value" in instances)) return instances;

  const workspace = args.values.get("workspace");
  const data = runMcpDoctor(ctx.env, ctx.paths, {
    hosts: hosts.value,
    instances: instances.value,
    scope: args.flags.has("--global") ? "global" : "workspace",
    ...(workspace !== undefined ? { workspace } : {}),
  });

  const okCount = data.summary.ok;
  const total = data.reports.length;
  const allOk = okCount === total;
  return {
    ok: allOk,
    data,
    ...(allOk
      ? {}
      : {
          error: {
            code: "MCP_DOCTOR_DRIFT",
            message: `${total - okCount}/${total} entradas con drift (ver data.reports)`,
          },
        }),
    exitCode: allOk ? 0 : 1,
  };
}

function resolveHosts(args: ParsedArgs, ctx: CliContext): { value: McpHost[] } | CommandResult {
  const flag = args.values.get("host");
  if (flag === undefined) {
    const harness = runHarness((k) => ctx.env.get(k));
    if (harness.harness === "claude-code") return { value: ["claude"] };
    if (harness.harness === "codex") return { value: ["codex"] };
    return { value: ["claude", "codex"] };
  }
  if (!HOST_VALUES.has(flag)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: `--host inválido: '${flag}'. Valores válidos: claude | codex | both`,
      },
      exitCode: 1,
    };
  }
  return { value: flag === "both" ? ["claude", "codex"] : [flag as McpHost] };
}

function resolveInstances(args: ParsedArgs): { value: McpInstance[] } | CommandResult {
  const flag = args.values.get("instance");
  if (flag === undefined) return { value: ["cert", "prod"] };
  if (!INSTANCE_VALUES.has(flag)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: `--instance inválido: '${flag}'. Valores válidos: cert | prod | both`,
      },
      exitCode: 1,
    };
  }
  return { value: flag === "both" ? ["cert", "prod"] : [flag as McpInstance] };
}

function clampExit(code: number): ExitCode {
  if (code === 0) return 0;
  if (code === 2) return 2;
  return 1;
}
