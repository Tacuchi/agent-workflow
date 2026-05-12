import { spawn } from "node:child_process";
import { appendFile, lstat, readFile, readdir, rm, stat } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedArgs } from "../../cli/parser.js";
import type { CliContext } from "../../cli/types.js";
import type { CommandResult } from "../../domain/types.js";
import type { SelfInstallPluginSkillsData } from "./install-plugin-skills.js";
import { selfInstallPluginSkills } from "./install-plugin-skills.js";
import type { InstallTarget } from "./install-skill.js";

const DEBUG_LOG = join(tmpdir(), "aw-debug.log");
async function dbg(msg: string): Promise<void> {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await appendFile(DEBUG_LOG, line, "utf8").catch(() => {});
}

const VALID_TARGETS: readonly InstallTarget[] = ["claude", "codex", "agents", "warp", "oz"];

export async function installPluginSkillsFromGit(
  args: ParsedArgs,
  ctx: CliContext,
): Promise<CommandResult<SelfInstallPluginSkillsData>> {
  const rawUrl = args.values.get("url");
  const targetArg = (args.values.get("target") ?? "warp") as InstallTarget;
  const namespace = args.values.get("namespace") ?? "";
  const force = args.flags.has("--force");

  if (!rawUrl) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "--url <git-url> es obligatorio." },
      exitCode: 1,
    };
  }

  if (!VALID_TARGETS.includes(targetArg)) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: `--target debe ser uno de: ${VALID_TARGETS.join(", ")}. Recibido: '${targetArg}'`,
      },
      exitCode: 1,
    };
  }

  // Split URL#ref (e.g. "https://...git#feature/last")
  const hashIdx = rawUrl.indexOf("#");
  const url = hashIdx >= 0 ? rawUrl.slice(0, hashIdx) : rawUrl;
  const ref = args.values.get("ref") ?? (hashIdx >= 0 ? rawUrl.slice(hashIdx + 1) : undefined);

  const tempDir = await mkdtemp(join(tmpdir(), "aw-git-install-"));
  await dbg(
    `installPluginSkillsFromGit url=${url} ref=${ref} target=${targetArg} ns=${namespace} tempDir=${tempDir}`,
  );
  try {
    try {
      await gitClone(url, tempDir, ref);
      await dbg(`gitClone OK → ${tempDir}`);
    } catch (err) {
      await dbg(`gitClone FAILED: ${(err as Error).message}`);
      return {
        ok: false,
        error: { code: "GIT_CLONE_FAILED", message: (err as Error).message },
        exitCode: 1,
      };
    }

    await dumpTree(tempDir, "after-clone");
    const resolvedDir = await resolvePluginDir(tempDir, namespace);
    await dbg(`resolvePluginDir → ${resolvedDir}`);
    if (resolvedDir) await dumpTree(resolvedDir, "after-resolve");
    if (!resolvedDir) {
      return {
        ok: false,
        error: {
          code: "SOURCE_NOT_FOUND",
          message: `No se encontró directorio de skills válido en '${url}'.`,
        },
        exitCode: 1,
      };
    }

    const innerValues = new Map<string, string>(args.values);
    innerValues.set("from", resolvedDir);
    innerValues.set("target", targetArg);
    if (namespace) innerValues.set("namespace", namespace);
    const innerArgs: ParsedArgs = {
      ...args,
      flags: new Set(force ? ["--force"] : []),
      values: innerValues,
    };
    return selfInstallPluginSkills(innerArgs, ctx);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function gitClone(url: string, dest: string, ref?: string): Promise<void> {
  const gitArgs = ["clone", "--depth=1"];
  if (ref) gitArgs.push("--branch", ref);
  gitArgs.push(url, dest);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("git", gitArgs, { stdio: "pipe" });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git clone falló (exit ${code}): ${stderr.trim()}`));
    });
    proc.on("error", reject);
  });
}

async function resolvePluginDir(cloneDir: string, namespace: string): Promise<string | null> {
  // Case 1: marketplace manifest — clone the actual plugin repo
  const manifestPath = join(cloneDir, "marketplace-codex.json");
  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as MarketplaceManifest;
    const plugin = namespace
      ? manifest.plugins?.find((p) => p.name === namespace)
      : manifest.plugins?.[0];
    if (plugin?.source?.url) {
      const pluginTempDir = await mkdtemp(join(tmpdir(), "aw-git-plugin-"));
      try {
        const pluginRef = plugin.source.ref;
        await gitClone(plugin.source.url, pluginTempDir, pluginRef);
        return await findSkillsRoot(pluginTempDir);
      } catch {
        await rm(pluginTempDir, { recursive: true, force: true }).catch(() => {});
        return null;
      }
    }
  } catch {
    // Not a marketplace — continue
  }

  // Case 2: direct plugin repo
  return findSkillsRoot(cloneDir);
}

async function findSkillsRoot(dir: string): Promise<string | null> {
  // Prefer explicit skills/ subdir
  const skillsSubdir = join(dir, "skills");
  if (await hasValidSkillDirs(skillsSubdir)) return skillsSubdir;
  // Fallback: root has skill dirs directly
  if (await hasValidSkillDirs(dir)) return dir;
  return null;
}

async function hasValidSkillDirs(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        const s = await stat(full);
        if (!s.isDirectory()) continue;
        const skillMdContent = await readFile(join(full, "SKILL.md"), "utf8");
        if (/^---[ \t]*\r?\n[\s\S]*?name:\s*\S/m.test(skillMdContent)) return true;
      } catch {
        // not a skill dir
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function dumpTree(root: string, label: string): Promise<void> {
  await dbg(`--- DUMP ${label} root=${root} ---`);
  try {
    await walkAndLog(root, "", 0);
  } catch (e) {
    await dbg(`dumpTree FAIL: ${(e as Error).message}`);
  }
  await dbg(`--- END DUMP ${label} ---`);
}

async function walkAndLog(base: string, rel: string, depth: number): Promise<void> {
  if (depth > 3) return;
  const here = rel ? join(base, rel) : base;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(here, { withFileTypes: true });
  } catch (e) {
    await dbg(`  ${rel || "."}: readdir ERR ${(e as Error).message}`);
    return;
  }
  for (const e of entries) {
    if (e.name === ".git") continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const isDir = await inspectEntry(base, childRel, e.name);
    if (isDir) {
      await walkAndLog(base, childRel, depth + 1);
    }
  }
}

async function inspectEntry(base: string, childRel: string, name: string): Promise<boolean> {
  const childAbs = join(base, childRel);
  const nameBytes = Buffer.from(name, "utf8").toString("hex");
  const ls = await safeLstat(childAbs);
  const st = await safeStat(childAbs);
  await dbg(`  ${childRel} lstat=${ls.type} stat=${st.type} size=${ls.size} nameHex=${nameBytes}`);
  return ls.type === "DIR";
}

async function safeLstat(p: string): Promise<{ type: string; size: number | string }> {
  try {
    const ls = await lstat(p);
    const type = ls.isSymbolicLink()
      ? "SYM"
      : ls.isDirectory()
        ? "DIR"
        : ls.isFile()
          ? "FIL"
          : "OTH";
    return { type, size: ls.size };
  } catch (err) {
    return { type: `lstat-ERR(${errCode(err)})`, size: "?" };
  }
}

async function safeStat(p: string): Promise<{ type: string }> {
  try {
    const st = await stat(p);
    const type = st.isDirectory() ? "DIR" : st.isFile() ? "FIL" : "OTH";
    return { type };
  } catch (err) {
    return { type: `stat-ERR(${errCode(err)})` };
  }
}

function errCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "?";
}

interface MarketplaceManifest {
  plugins?: Array<{
    name: string;
    source?: { url: string; ref?: string };
  }>;
}
