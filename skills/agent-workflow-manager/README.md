# agent-workflow-manager

Universal Claude Code / Codex skill for the [`@tacuchi/agent-workflow`](https://www.npmjs.com/package/@tacuchi/agent-workflow) CLI.

This repo packages a single SKILL — `SKILL.md` plus a `references/` folder — that teaches an AI agent how to drive the agent-workflow session-lifecycle CLI: create / resume / close sessions, read & write artifacts (`OBJETIVO.md`, `TASKS.md`, `DECISIONES.md`, `HISTORY.md`, `CHECKPOINT.md`), inspect sources, run hooks, and manage the binary itself.

## Quick start

```bash
# 1. Install the CLI globally (one time)
npm install -g @tacuchi/agent-workflow

# 2. Install this skill into ~/.claude/skills/agent-workflow-manager/
agent-workflow self install-skill
```

That second command clones this repo and copies its contents to `~/.claude/skills/agent-workflow-manager/`. Claude Code auto-discovers the skill on the next session start.

To preview without writing:

```bash
agent-workflow self install-skill --dry-run
```

To install from a local clone (useful for skill development):

```bash
agent-workflow self install-skill --from /path/to/agent-workflow-manager --force
```

## Repo layout

```
agent-workflow-manager/
├── SKILL.md              # Skill entry point with frontmatter
├── README.md             # This file
├── LICENSE               # MIT
└── references/           # Per-family command documentation
    ├── session-mgmt.md   # sessions, session-create, session-resume, session-close, session-artifacts
    ├── objetivo-tasks.md # objetivo-data, tasks-data, decisiones-list, dependencias-list
    ├── history.md        # history-data, history-update
    ├── checkpoint.md     # checkpoint-read, checkpoint-write, compress-checkpoint, resume-summary, auto-compact-on-close
    ├── sources.md        # sources, check-branch, workspace-mode, project-md-upsert, upgrade-hub-mode, attach/detach-multiroot
    ├── orchestration.md  # auto-plan-decide, topic-change-check, specialty-choose, phase-detect, phase-next, stack, workflows, skill-index
    ├── doctor.md         # plugin-doctor, code-scan, release-data, graduate
    ├── hooks.md          # hook branch-check, hook sql-mutation-guard
    ├── mcp.md            # mcp dbhub, bootstrap-dsn
    ├── dev-only.md       # harness, profiles, logs, next-number
    └── self.md           # self namespace, self doctor, self update, self install-skill
```

## Updating the skill

```bash
agent-workflow self install-skill --force        # re-install latest
```

## Uninstall

```bash
rm -rf ~/.claude/skills/agent-workflow-manager
```

## Project links

- CLI source: <https://github.com/Tacuchi/agent-workflow>
- npm: <https://www.npmjs.com/package/@tacuchi/agent-workflow>
- This skill: <https://github.com/Tacuchi/agent-workflow-manager>

## License

MIT — see [LICENSE](./LICENSE).
