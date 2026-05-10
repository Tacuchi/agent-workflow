import { Box, Text, useInput } from "ink";
import type { CliContext } from "../../types.js";
import { colors, icons } from "../theme.js";

export interface UpdateTabProps {
  ctx: CliContext;
  version: string;
  isActive: boolean;
  onRequestUpdate: () => void;
}

export function UpdateTab({ ctx, version, isActive, onRequestUpdate }: UpdateTabProps) {
  useInput(
    (input) => {
      if (input === "u" || input === "U") onRequestUpdate();
    },
    { isActive },
  );

  return (
    <Box flexDirection="column">
      <Text color={colors.fg} bold>
        Actualizar CLI
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={colors.fg}>versión actual:</Text>
          <Text> </Text>
          <Text color={colors.accent} bold>
            v{version}
          </Text>
        </Box>
        <Box>
          <Text color={colors.fgSubtle}>paquete: </Text>
          <Text color={colors.fgSubtle}>{ctx.runtime.packageName}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.fg}>
          Presiona{" "}
          <Text color={colors.accent} bold>
            u
          </Text>{" "}
          para correr:
        </Text>
        <Box marginLeft={2}>
          <Text color={colors.fgMoreSubtle}>{icons.arrow} </Text>
          <Text color={colors.fgSubtle}>npm install -g {ctx.runtime.packageName}@latest</Text>
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.fgMoreSubtle}>
            (cierra el TUI y delega al CLI; vuelve a iniciar agent-workflow al terminar)
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
