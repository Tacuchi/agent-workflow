import { join } from "node:path";
import type { EnvPort } from "../ports/env.js";
import type { FileSystemPort } from "../ports/file-system.js";
import { parseProjectBlock } from "./parsers/project-block.js";
import type { PathsService } from "./paths-service.js";

const REFERENCE_DOC = "skills/session/references/commits-policy.md";
const GIT_COMMIT_RE = /\bgit\s+commit\b/;
const COMMIT_MSG_RE = /\s-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/;
const SESSION_TAG_RE = /session\d{3}/i;
const SESSION_CODE_FROM_FOLDER_RE = /^session(\d{3})/;

export interface GitCommitAdvisorResult {
  exitCode: 0;
  stderr?: string;
}

export interface GitCommitAdvisorInput {
  stdin: string;
  fs: FileSystemPort;
  env: EnvPort;
  paths: PathsService;
  /** Display name used as message prefix (e.g., "acme-core", "agent-workflow"). */
  displayName?: string;
}

export async function runGitCommitAdvisor(
  input: GitCommitAdvisorInput,
): Promise<GitCommitAdvisorResult> {
  if ((input.env.get("AW_COMMIT_ADVISOR") ?? "").toLowerCase() === "off") {
    return { exitCode: 0 };
  }

  const payload = parsePayload(input.stdin);
  if (!payload) return { exitCode: 0 };

  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : "";
  if (toolName !== "Bash") return { exitCode: 0 };

  const command = extractCommand(payload.tool_input);
  if (!command || !GIT_COMMIT_RE.test(command)) return { exitCode: 0 };

  const message = extractCommitMessage(command);
  if (message === null) return { exitCode: 0 };

  const block = await readProjectBlock(input.fs, input.env.cwd(), input.paths);
  if (!block) return { exitCode: 0 };

  const activeSession = block.sessions[0];
  if (!activeSession) return { exitCode: 0 };

  const sessionCode = extractSessionCode(activeSession.folder);
  if (!sessionCode) return { exitCode: 0 };

  if (SESSION_TAG_RE.test(message)) return { exitCode: 0 };

  const display = input.displayName ?? "agent-workflow";
  return {
    exitCode: 0,
    stderr: formatAdvisorMessage({
      display,
      sessionCode,
      message,
      sessionFolder: activeSession.folder,
    }),
  };
}

function parsePayload(stdin: string): Record<string, unknown> | null {
  const raw = stdin.trim();
  if (raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractCommand(toolInput: unknown): string | null {
  if (typeof toolInput !== "object" || toolInput === null) return null;
  const obj = toolInput as Record<string, unknown>;
  const cmd = obj.command;
  return typeof cmd === "string" && cmd.length > 0 ? cmd : null;
}

function extractCommitMessage(command: string): string | null {
  const m = command.match(COMMIT_MSG_RE);
  if (!m) return null;
  const msg = m[1] ?? m[2];
  if (msg === undefined) return null;
  return msg.replace(/\\(.)/g, "$1");
}

async function readProjectBlock(fs: FileSystemPort, cwd: string, paths: PathsService) {
  for (const file of [join(cwd, "CLAUDE.md"), join(cwd, "AGENTS.md")]) {
    if (!(await fs.exists(file))) continue;
    const block = parseProjectBlock(await fs.readText(file), paths.blockMarkers());
    if (block) return block;
  }
  return null;
}

function extractSessionCode(folder: string): string | null {
  const m = folder.match(SESSION_CODE_FROM_FOLDER_RE);
  return m?.[1] ?? null;
}

interface AdvisorInfo {
  display: string;
  sessionCode: string;
  message: string;
  sessionFolder: string;
}

function formatAdvisorMessage(info: AdvisorInfo): string {
  const truncMsg = info.message.length > 60 ? `${info.message.slice(0, 60)}...` : info.message;
  return `${[
    `[${info.display} git-commit-advisor] Sesión activa sin tag en commit message.`,
    `  Sesión:   session${info.sessionCode} (${info.sessionFolder})`,
    `  Mensaje:  "${truncMsg}"`,
    `  Esperado: incluir tag \`session${info.sessionCode}\` (ej. al final: "(session${info.sessionCode})")`,
    "",
    "Este advisor NO bloquea — el commit procederá. Sugerencia: ajustar el mensaje",
    "para incluir el tag de sesión y mantener trazabilidad con qtc:commits-policy.",
    "",
    "Bypass: AW_COMMIT_ADVISOR=off",
    `Referencia: ${REFERENCE_DOC}`,
    "",
  ].join("\n")}\n`;
}
