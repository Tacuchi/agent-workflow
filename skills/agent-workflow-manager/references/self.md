# Self — manage the CLI itself

`agent-workflow self <subcommand>` covers tasks that target the CLI binary itself: namespace inspection, install diagnostics, in-place upgrade, and skill installation.

```bash
agent-workflow self <namespace|doctor|update|install-skill>
```

## self namespace

Print the resolved namespace and the source it came from (env / flag / config / default).

```bash
agent-workflow self namespace

# Result:
# { "namespace": "qtc", "source": "env", "expected_paths": { "user_dir": "~/.qtc", "workspace": ".qtc" } }
```

Use this when paths look wrong — it tells you exactly which override won the precedence chain.

## self doctor

Health check the CLI install: binary location, Node version, namespace config, expected paths, and whether the skill is installed under `~/.claude/skills/agent-workflow-manager/`.

```bash
agent-workflow self doctor
```

Returns a structured report. Non-zero exit when something is broken.

## self update

Wraps `npm install -g @tacuchi/agent-workflow@latest`. Confirms interactively when stdout is a TTY.

```bash
agent-workflow self update
```

Skips confirmation in non-TTY contexts. Failures from the underlying `npm` invocation propagate.

## self install-skill

Download this skill repo (`agent-workflow-manager`) and install its contents at `~/.claude/skills/agent-workflow-manager/`. After installation the skill is auto-discovered by Claude Code on next session start.

```bash
# Default — clone from the public GitHub repo
agent-workflow self install-skill

# Override the source (local clone, fork, branch)
agent-workflow self install-skill --from /Users/me/Git/agent-workflow-manager
agent-workflow self install-skill --from https://github.com/Tacuchi/agent-workflow-manager.git

# Overwrite an existing install
agent-workflow self install-skill --force

# Print the plan without executing
agent-workflow self install-skill --dry-run
```

Flags:

| Flag | Default | Notes |
|---|---|---|
| `--from <url\|path>` | `https://github.com/Tacuchi/agent-workflow-manager.git` | Accepts a git remote URL or a local filesystem path. |
| `--force` | off | Required to overwrite an existing `~/.claude/skills/agent-workflow-manager/` directory. |
| `--dry-run` | off | Print the resolved source/destination and exit without copying. |

The installer validates that the source contains a `SKILL.md` with a valid frontmatter (`name`, `description`) before copying.
