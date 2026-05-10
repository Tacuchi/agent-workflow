import { Box, Text } from "ink";
import { colors, icons } from "../theme.js";

export interface HeaderProps {
  version: string;
  cwd?: string;
  homeDir?: string;
}

export function Header({ version, cwd, homeDir }: HeaderProps) {
  const path = cwd ? prettyPath(cwd, homeDir) : undefined;
  return (
    <Box justifyContent="space-between" marginBottom={1}>
      <Box>
        <Text color={colors.primary} bold>
          {icons.brand} agent-workflow
        </Text>
        <Text color={colors.fgMoreSubtle}> · </Text>
        <Text color={colors.fgSubtle}>v{version}</Text>
      </Box>
      {path ? (
        <Box>
          <Text color={colors.fgMoreSubtle}>{path}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function prettyPath(cwd: string, homeDir?: string): string {
  if (homeDir && cwd.startsWith(homeDir)) {
    const rest = cwd.slice(homeDir.length);
    return `~${rest}`;
  }
  return cwd;
}
