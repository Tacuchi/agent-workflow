# agent-workflow-cli

Runtime CLI de la familia qtc-* (`@tacuchi/agent-workflow-cli`). Gestiona ciclo de vida de sesiones, hooks PreToolUse y comandos read-only para flows dev/design/analyze.

## Reglas transversales qtc-*

Reglas universales del runtime qtc-* que aplican aunque no haya sesión activa. Cada anchor cita su archivo canónico para deep-dive.

- **`qtc:commits-policy`** (`qtc-workflow-plugin/skills/session/references/commits-policy.md`) — el AI nunca commitea por iniciativa propia. Cuando el usuario pide commit: 1 línea ≤72 chars descriptiva, con tag `session<NNN>` si hay sesión activa, sin `Co-Authored-By`, sin firmas de modelo, sin `--no-verify`.
- **`qtc:sandbox-readonly`** (`qtc-workflow-plugin/skills/session/references/sandbox-readonly-rules.md`) — en plan mode del host (Claude Code / Codex / Copilot / Warp): no ejecutar mutaciones; describir en plan file qué se haría.
- **`qtc:mcp-readonly`** (`qtc-workflow-plugin/docs/shared-contract/plugins.md` §30) — MCP `qtc-cert` / `qtc-prod` son `SELECT` / `EXPLAIN` / `\d` only. Mutación (`INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `DDL`) se materializa como script SQL en `docs/scripts/`; el usuario lo aplica.
- **`qtc:redaccion-simple`** (`qtc-workflow-plugin/skills/redaccion-simple/SKILL.md`) — toda prosa qtc-* (artefactos, commit messages, descripciones de PR, READMEs ad-hoc): frases cortas, listas sobre prosa, "qué + por qué" en una línea, sin jerga inventada, sin relleno.
- **`qtc:coding-standards`** (`qtc-workflow-plugin/skills/coding-standards/SKILL.md`) — estándares por stack (Java/Spring, Angular/TypeScript, Node) + FE-BE R1-R6 (Sparse DTO, PATCH, sin fallbacks ocultos, Bean Validation); seguridad (sin secrets en código, SQL parametrizado, logging por nivel).
- **`qtc:graduacion-routing`** (`qtc-workflow-plugin/skills/session/references/graduacion-routing.md`) — sólo 6 kinds graduan al cerrar sesión (`decision` / `manual` / `script` / `especificacion` / `conclusion` / `release`); routing automático por `workspace_mode` (hub vs project), sin prompt por sesión.
- **`qtc:branch-verification`** (`qtc-workflow-plugin/skills/session/references/branch-verification.md`) — gate de rama por fuente al crear / retomar / entrar a execution (Casos A `match=false dirty=false` / B `match=false dirty=true` / C `analyze editando código`) + hard gate cross-fuente en hub mode.

Para cargar todas las reglas completas on-demand: `Skill(qtc:rules)`.
