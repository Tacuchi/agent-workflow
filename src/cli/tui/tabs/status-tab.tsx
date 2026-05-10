import { Box, Text } from "ink";
import { useEffect, useRef, useState } from "react";
import { readMcpConnections } from "../../../application/mcp-connections-service.js";
import { selfDoctor } from "../../../application/self/doctor-self.js";
import type { CliContext } from "../../types.js";
import { colors, icons } from "../theme.js";

interface StatusItem {
  label: string;
  ok: boolean | null;
  detail?: string;
}

export interface StatusTabProps {
  ctx: CliContext;
  isActive: boolean;
}

const TARGET_LABEL: Record<string, string> = {
  claude: "Skill en Claude Code",
  codex: "Skill en Codex",
  agents: "AGENTS.md lock",
};

export function StatusTab({ ctx }: StatusTabProps) {
  const [items, setItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();

    async function load() {
      const next = [...(await loadDoctorItems(ctx)), ...loadConnectionItems(ctx)];
      setItems(next);
      setLoading(false);
    }
  }, [ctx]);

  return (
    <Box flexDirection="column">
      <Text color={colors.fg} bold>
        Estado del runtime
      </Text>
      <Box marginTop={1} flexDirection="column">
        {loading ? <Text color={colors.fgSubtle}>{icons.spinner} cargando...</Text> : null}
        {items.map((item) => (
          <Box key={item.label}>
            <Text color={iconColor(item.ok)} bold>
              {iconFor(item.ok)}{" "}
            </Text>
            <Text color={colors.fg}>{item.label}</Text>
            {item.detail ? (
              <>
                <Text color={colors.fgMoreSubtle}> · </Text>
                <Text color={colors.fgSubtle}>{item.detail}</Text>
              </>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

async function loadDoctorItems(ctx: CliContext): Promise<StatusItem[]> {
  try {
    const result = await selfDoctor(ctx);
    if (!result.ok || !result.data) return [];
    const items: StatusItem[] = [{ label: "CLI", ok: true, detail: `v${result.data.cli_version}` }];
    for (const target of result.data.skill.targets) {
      items.push({
        label: TARGET_LABEL[target.target] ?? `Skill (${target.target})`,
        ok: target.installed,
        detail: target.installed ? prettyTargetPath(target.path, ctx) : "no instalada",
      });
    }
    return items;
  } catch (err) {
    return [{ label: "Doctor", ok: false, detail: (err as Error).message }];
  }
}

function loadConnectionItems(ctx: CliContext): StatusItem[] {
  try {
    const conns = readMcpConnections(ctx.paths, ctx.env);
    return [
      {
        label: "Conexiones MCP",
        ok: null,
        detail: `${conns.length} registrada${conns.length === 1 ? "" : "s"}`,
      },
    ];
  } catch {
    return [];
  }
}

function prettyTargetPath(path: string, ctx: CliContext): string {
  const home = ctx.env.homeDir();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
}

function iconFor(ok: boolean | null): string {
  if (ok === true) return icons.check;
  if (ok === false) return icons.cross;
  return icons.bullet;
}

function iconColor(ok: boolean | null): string {
  if (ok === true) return colors.success;
  if (ok === false) return colors.error;
  return colors.info;
}
