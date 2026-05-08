import { basename, join } from "node:path";
import type { EnvPort } from "../ports/env.js";
import type { FileSystemPort } from "../ports/file-system.js";
import { PathsService, resolveWorkspaceRoot } from "./paths-service.js";
import { resolveSession } from "./session-resolver.js";

// Kinds graduable per DEC-003 (session006). The `release` kind is only
// invocable through the `release` command — it is rejected here with a hint.
// `script` is also typically driven by `release`; if invoked directly we still
// support it but we keep the bundle layout consistent with the release output.
const ALLOWED_KINDS = [
  "decision",
  "manual",
  "script",
  "especificacion",
  "conclusion",
  "release",
] as const;
export type GraduateKind = (typeof ALLOWED_KINDS)[number];

export interface GraduateInput {
  kind?: string;
  session?: string;
  decId?: string;
  slug?: string;
  source?: string;
}

export interface GraduateDecisionOutput {
  kind: "decision";
  session: string;
  source: string;
  target: string;
  next_number: string;
  dec_id: string;
  slug: string;
}

export interface GraduateManualOutput {
  kind: "manual";
  session: string;
  source: string;
  target: string;
  next_number: string;
  slug: string;
}

export interface GraduateScriptOutput {
  kind: "script";
  session: string;
  source: string;
  target: string;
  next_number: string;
  slug: string;
  files_copied: number;
}

export interface GraduateEspecificacionOutput {
  kind: "especificacion";
  session: string;
  source: string;
  target: string;
  next_number: string;
  slug: string;
}

export interface GraduateConclusionOutput {
  kind: "conclusion";
  session: string;
  source: string;
  target: string;
  next_number: string;
  slug: string;
}

export interface GraduateError {
  error: string;
}

export type GraduateOutput =
  | GraduateDecisionOutput
  | GraduateManualOutput
  | GraduateScriptOutput
  | GraduateEspecificacionOutput
  | GraduateConclusionOutput;
export type GraduateResult = GraduateOutput | GraduateError;

export async function runGraduate(
  fs: FileSystemPort,
  env: EnvPort,
  paths: PathsService,
  input: GraduateInput,
): Promise<GraduateResult> {
  const validation = validateInput(input);
  if ("error" in validation) return validation;

  // DEC-002: walk up from cwd to find the workspace root, then re-anchor session
  // resolution and graduation destination there. Lets the user invoke `graduate`
  // from inside a fuente subdirectory of a hub workspace and still land in the
  // hub's docs/.
  const workspaceRoot = await resolveWorkspaceRoot(fs, env, paths);
  const wsPaths =
    workspaceRoot === env.cwd()
      ? paths
      : new PathsService(paths.namespace, env.homeDir(), workspaceRoot);

  const session = await resolveSession(fs, env, wsPaths, input.session, true);
  if (!session) return { error: `Sesión no encontrada: ${input.session}` };
  const ctx: GraduateContext = {
    fs,
    workspaceRoot,
    sessionPath: session.path,
    folder: session.folder,
    slug: validation.slug,
  };

  switch (validation.kind) {
    case "decision":
      return graduateDecision(ctx, validation.decId);
    case "manual":
      return graduateManual(ctx, input.source);
    case "script":
      return graduateScript(ctx);
    case "especificacion":
      return graduateEspecificacion(ctx, input.source);
    case "conclusion":
      return graduateConclusion(ctx);
    case "release":
      return {
        error:
          "El kind 'release' no se gradúa con `graduate`; usá el comando `release` (consolida sesiones en un paquete de paso a producción).",
      };
  }
}

interface GraduateContext {
  fs: FileSystemPort;
  workspaceRoot: string;
  sessionPath: string;
  folder: string;
  slug: string;
}

interface ValidatedInput {
  kind: GraduateKind;
  slug: string;
  decId?: string;
}

function validateInput(input: GraduateInput): ValidatedInput | GraduateError {
  if (input.kind === undefined || !isAllowedKind(input.kind)) {
    return {
      error: `--kind debe ser uno de: ${ALLOWED_KINDS.join(", ")}`,
    };
  }
  if (!input.session || !input.slug) {
    return { error: "--session y --slug son obligatorios" };
  }
  if (input.kind === "decision" && !input.decId) {
    return { error: "--id (DEC-NNN) obligatorio para --kind decision" };
  }
  if (input.kind === "release") {
    return {
      error:
        "El kind 'release' no se gradúa con `graduate`; usá el comando `release` (consolida sesiones en un paquete de paso a producción).",
    };
  }
  const validated: ValidatedInput = {
    kind: input.kind,
    slug: input.slug,
  };
  if (input.decId !== undefined) validated.decId = input.decId;
  return validated;
}

function isAllowedKind(value: string): value is GraduateKind {
  return (ALLOWED_KINDS as ReadonlyArray<string>).includes(value);
}

// ─── decision ───────────────────────────────────────────────────────────────

async function graduateDecision(
  ctx: GraduateContext,
  decId: string | undefined,
): Promise<GraduateResult> {
  if (!decId) return { error: "--id (DEC-NNN) obligatorio para --kind decision" };
  const decFile = join(ctx.sessionPath, "DECISIONES.md");
  if (!(await ctx.fs.exists(decFile))) {
    return { error: "DECISIONES.md no existe en la sesión" };
  }
  const text = await ctx.fs.readText(decFile);
  const block = extractDecisionBlock(text, decId);
  if (!block) {
    return { error: `Bloque ${decId} no encontrado en DECISIONES.md` };
  }

  const destDir = join(ctx.workspaceRoot, "docs", "decisiones");
  await ctx.fs.mkdirp(destDir);
  const nnn = await nextNumberInDir(ctx.fs, destDir);
  const destFile = join(destDir, `${nnn}-${ctx.slug}.md`);
  await ctx.fs.writeText(destFile, `${block.header}\n\n${block.body}\n`);

  const pointer = `${block.header}\n→ docs/decisiones/${nnn}-${ctx.slug}.md\n\n`;
  const newText = text.slice(0, block.startIndex) + pointer + text.slice(block.endIndex);
  await ctx.fs.writeText(decFile, newText);

  return {
    kind: "decision",
    session: ctx.folder,
    source: decFile,
    target: destFile,
    next_number: nnn,
    dec_id: decId,
    slug: ctx.slug,
  };
}

// ─── manual ─────────────────────────────────────────────────────────────────

async function graduateManual(
  ctx: GraduateContext,
  sourceArg: string | undefined,
): Promise<GraduateResult> {
  const sourceRel = sourceArg && sourceArg.length > 0 ? sourceArg : "MANUAL.md";
  const sourceFile = join(ctx.sessionPath, sourceRel);
  if (!(await ctx.fs.exists(sourceFile))) {
    return { error: `Fuente no existe: ${sourceRel} en la sesión` };
  }
  const content = await ctx.fs.readText(sourceFile);
  const destDir = join(ctx.workspaceRoot, "docs", "manuales");
  await ctx.fs.mkdirp(destDir);
  const nnn = await nextNumberInDir(ctx.fs, destDir);
  const destFile = join(destDir, `${nnn}-${ctx.slug}.md`);
  await ctx.fs.writeText(destFile, content);

  return {
    kind: "manual",
    session: ctx.folder,
    source: sourceFile,
    target: destFile,
    next_number: nnn,
    slug: ctx.slug,
  };
}

// ─── script ─────────────────────────────────────────────────────────────────

async function graduateScript(ctx: GraduateContext): Promise<GraduateResult> {
  const sessionCode = parseSessionCode(ctx.folder);
  if (!sessionCode) {
    return { error: `No se pudo extraer el código de sesión de '${ctx.folder}'` };
  }
  const scriptsDir = join(ctx.sessionPath, "scripts");
  const queriesDir = join(ctx.sessionPath, "queries");
  const hasScripts = await ctx.fs.exists(scriptsDir);
  const hasQueries = await ctx.fs.exists(queriesDir);
  if (!hasScripts && !hasQueries) {
    return {
      error: "La sesión no contiene 'scripts/' ni 'queries/' — nada para graduar.",
    };
  }

  const destRoot = join(ctx.workspaceRoot, "docs", "scripts");
  await ctx.fs.mkdirp(destRoot);
  const nnn = await nextNumberInDirsByPrefix(ctx.fs, destRoot);
  const bundleName = `${nnn}-session${sessionCode}-${ctx.slug}`;
  const destDir = join(destRoot, bundleName);
  await ctx.fs.mkdirp(destDir);

  let copied = 0;
  if (hasScripts) {
    copied += await copyTree(ctx.fs, scriptsDir, join(destDir, "scripts"));
  }
  if (hasQueries) {
    copied += await copyTree(ctx.fs, queriesDir, join(destDir, "queries"));
  }

  return {
    kind: "script",
    session: ctx.folder,
    source: hasScripts ? scriptsDir : queriesDir,
    target: destDir,
    next_number: nnn,
    slug: ctx.slug,
    files_copied: copied,
  };
}

// ─── especificacion ─────────────────────────────────────────────────────────

async function graduateEspecificacion(
  ctx: GraduateContext,
  sourceArg: string | undefined,
): Promise<GraduateResult> {
  const sourceRel = sourceArg && sourceArg.length > 0 ? sourceArg : "ENTREGA.md";
  const sourceFile = join(ctx.sessionPath, sourceRel);
  if (!(await ctx.fs.exists(sourceFile))) {
    return { error: `Fuente no existe: ${sourceRel} en la sesión` };
  }
  const content = await ctx.fs.readText(sourceFile);
  const destRoot = join(ctx.workspaceRoot, "docs", "especificaciones");
  await ctx.fs.mkdirp(destRoot);
  const nnn = await nextNumberInDirsByPrefix(ctx.fs, destRoot);
  const destDir = join(destRoot, `${nnn}-${ctx.slug}`);
  await ctx.fs.mkdirp(destDir);
  const filename = basename(sourceRel);
  const destFile = join(destDir, filename);
  await ctx.fs.writeText(destFile, content);

  return {
    kind: "especificacion",
    session: ctx.folder,
    source: sourceFile,
    target: destFile,
    next_number: nnn,
    slug: ctx.slug,
  };
}

// ─── conclusion ─────────────────────────────────────────────────────────────

async function graduateConclusion(ctx: GraduateContext): Promise<GraduateResult> {
  const sourceFile = join(ctx.sessionPath, "CONCLUSIONES.md");
  if (!(await ctx.fs.exists(sourceFile))) {
    return { error: "CONCLUSIONES.md no existe en la sesión" };
  }
  const content = await ctx.fs.readText(sourceFile);
  const destDir = join(ctx.workspaceRoot, "docs", "conclusiones");
  await ctx.fs.mkdirp(destDir);
  const nnn = await nextNumberInDir(ctx.fs, destDir);
  const destFile = join(destDir, `${nnn}-${ctx.slug}.md`);
  await ctx.fs.writeText(destFile, content);

  return {
    kind: "conclusion",
    session: ctx.folder,
    source: sourceFile,
    target: destFile,
    next_number: nnn,
    slug: ctx.slug,
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface DecisionBlock {
  header: string;
  body: string;
  startIndex: number;
  endIndex: number;
}

function extractDecisionBlock(text: string, decId: string): DecisionBlock | null {
  const headerRe = new RegExp(`^##\\s+${escapeRegex(decId)}[^\\n]*$`, "m");
  const m = text.match(headerRe);
  if (!m || m.index === undefined) return null;

  const headerStart = m.index;
  const headerLine = m[0];
  const headerEnd = headerStart + headerLine.length;
  const afterHeader = text.indexOf("\n", headerEnd);
  const bodyStart = afterHeader === -1 ? text.length : afterHeader + 1;
  let bodyEnd = text.length;
  const nextHeaderRe = /^##\s+/m;
  const slice = text.slice(bodyStart);
  const next = slice.match(nextHeaderRe);
  if (next?.index !== undefined) {
    bodyEnd = bodyStart + next.index;
  }
  return {
    header: headerLine.replace(/\s+$/, ""),
    body: text.slice(bodyStart, bodyEnd).replace(/\s+$/, ""),
    startIndex: headerStart,
    endIndex: bodyEnd,
  };
}

async function nextNumberInDir(fs: FileSystemPort, dir: string): Promise<string> {
  if (!(await fs.exists(dir))) return "001";
  const entries = await fs.list(dir);
  const numbers: number[] = [];
  for (const entry of entries) {
    if (entry.type !== "file") continue;
    const m = entry.name.match(/^(\d{3})-.*\.md$/);
    if (m?.[1]) numbers.push(Number.parseInt(m[1], 10));
  }
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(3, "0");
}

async function nextNumberInDirsByPrefix(fs: FileSystemPort, dir: string): Promise<string> {
  if (!(await fs.exists(dir))) return "001";
  const entries = await fs.list(dir);
  const numbers: number[] = [];
  for (const entry of entries) {
    if (entry.type !== "dir") continue;
    const m = entry.name.match(/^(\d{3})-/);
    if (m?.[1]) numbers.push(Number.parseInt(m[1], 10));
  }
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(3, "0");
}

async function copyTree(fs: FileSystemPort, srcDir: string, destDir: string): Promise<number> {
  if (!(await fs.exists(srcDir))) return 0;
  await fs.mkdirp(destDir);
  let count = 0;
  const entries = await fs.list(srcDir);
  for (const entry of entries) {
    const target = join(destDir, entry.name);
    if (entry.type === "dir") {
      count += await copyTree(fs, entry.path, target);
    } else if (entry.type === "file") {
      const content = await fs.readText(entry.path);
      await fs.writeText(target, content);
      count += 1;
    }
  }
  return count;
}

function parseSessionCode(folder: string): string | null {
  const m = folder.match(/^session(\d{3})-/);
  return m?.[1] ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
