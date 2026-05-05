import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedArgs } from "../../cli/parser.js";
import type { CliContext } from "../../cli/types.js";
import type { CommandResult } from "../../domain/types.js";

export const DEFAULT_SOURCE = "https://github.com/Tacuchi/agent-workflow-manager.git";
export const SKILL_DIR_NAME = "agent-workflow-manager";

export interface SelfInstallSkillData {
  status: "installed" | "dry-run";
  source: string;
  source_kind: "url" | "path";
  dest: string;
  files_copied?: number;
  overwrote_existing?: boolean;
}

export async function selfInstallSkill(
  args: ParsedArgs,
  ctx: CliContext,
): Promise<CommandResult<SelfInstallSkillData>> {
  const force = args.flags.has("--force");
  const dryRun = args.flags.has("--dry-run");
  const sourceArg = args.values.get("from") ?? DEFAULT_SOURCE;
  const sourceKind: "url" | "path" = isRemoteUrl(sourceArg) ? "url" : "path";
  const dest = join(ctx.env.homeDir(), ".claude", "skills", SKILL_DIR_NAME);

  const destExists = await ctx.fs.exists(dest);
  if (destExists && !force && !dryRun) {
    return {
      ok: false,
      error: {
        code: "DEST_EXISTS",
        message: `Destination ${dest} already exists. Use --force to overwrite or --dry-run to preview.`,
      },
      exitCode: 1,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      data: {
        status: "dry-run",
        source: sourceArg,
        source_kind: sourceKind,
        dest,
        overwrote_existing: destExists,
      },
      exitCode: 0,
    };
  }

  let stagingDir: string;
  let cleanup: (() => Promise<void>) | undefined;

  if (sourceKind === "path") {
    const sourceExists = await ctx.fs.exists(sourceArg);
    if (!sourceExists) {
      return {
        ok: false,
        error: {
          code: "SOURCE_NOT_FOUND",
          message: `Source path '${sourceArg}' does not exist.`,
        },
        exitCode: 1,
      };
    }
    stagingDir = sourceArg;
  } else {
    const tempRoot = await mkdtemp(join(tmpdir(), "aw-skill-"));
    stagingDir = join(tempRoot, "repo");
    cleanup = async () => {
      await rm(tempRoot, { recursive: true, force: true });
    };
    const cloneResult = await ctx.process.run(
      "git",
      ["clone", "--depth", "1", sourceArg, stagingDir],
      {},
    );
    if (cloneResult.code !== 0) {
      await cleanup();
      return {
        ok: false,
        error: {
          code: "CLONE_FAILED",
          message: `git clone exited ${cloneResult.code}: ${cloneResult.stderr.trim()}`,
        },
        exitCode: 1,
      };
    }
  }

  try {
    const skillPath = join(stagingDir, "SKILL.md");
    if (!(await ctx.fs.exists(skillPath))) {
      return {
        ok: false,
        error: {
          code: "INVALID_SKILL_REPO",
          message: `Source missing SKILL.md at ${skillPath}.`,
        },
        exitCode: 1,
      };
    }
    const skillContent = await readFile(skillPath, "utf8");
    if (!hasValidFrontmatter(skillContent)) {
      return {
        ok: false,
        error: {
          code: "INVALID_SKILL_FRONTMATTER",
          message: "SKILL.md frontmatter must include 'name' and 'description'.",
        },
        exitCode: 1,
      };
    }

    if (destExists && force) {
      await rm(dest, { recursive: true, force: true });
    }

    const filesCopied = await copyTree(stagingDir, dest);

    return {
      ok: true,
      data: {
        status: "installed",
        source: sourceArg,
        source_kind: sourceKind,
        dest,
        files_copied: filesCopied,
        overwrote_existing: destExists,
      },
      exitCode: 0,
    };
  } finally {
    if (cleanup) await cleanup();
  }
}

function isRemoteUrl(value: string): boolean {
  return /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/.test(value);
}

function hasValidFrontmatter(content: string): boolean {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return false;
  const block = match[1] ?? "";
  return /^name:\s*\S/m.test(block) && /^description:\s*\S/m.test(block);
}

async function copyTree(src: string, dest: string): Promise<number> {
  let count = 0;
  await cp(src, dest, {
    recursive: true,
    filter: (source: string) => {
      const rel = source.slice(src.length);
      if (rel.startsWith("/.git") || rel === "/.git") return false;
      count += 1;
      return true;
    },
  });
  return count;
}
