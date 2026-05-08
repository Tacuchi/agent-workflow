export type McpHost = "claude" | "codex";

export type McpInstance = "cert" | "prod";

export type McpEntryName = `qtc-${McpInstance}`;

export interface McpEntry {
  name: McpEntryName;
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface McpWriteOpts {
  dryRun?: boolean;
  force?: boolean;
}

export type McpWriteAction = "written" | "skipped-idempotent" | "dry-run";

export interface McpWriteResult {
  host: McpHost;
  target: string;
  name: string;
  action: McpWriteAction;
  backup: string | null;
  diff?: string[];
}

export type McpDriftStatus = "ok" | "missing-mcp" | "dsn-mismatch" | "extra-entry" | "missing-dsn";

export interface McpDriftReport {
  host: McpHost;
  instance: McpInstance;
  scope: "workspace" | "global";
  target: string;
  dsn: { path: string; exists: boolean; key: string; present: boolean };
  mcp: { name: string; present: boolean; matches: boolean };
  status: McpDriftStatus;
  detail?: string;
}

export function buildMcpEntry(instance: McpInstance): McpEntry {
  return {
    name: `qtc-${instance}` satisfies McpEntryName,
    command: "agent-workflow",
    args: ["mcp", "dbhub", instance],
    env: {
      MAX_ROWS: "1000",
      READONLY: "true",
      TRANSPORT: "stdio",
    },
  };
}
