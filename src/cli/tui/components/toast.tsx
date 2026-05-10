import { Box, Text } from "ink";
import { colors, icons } from "../theme.js";

export type ToastTone = "success" | "error" | "info";

export interface ToastProps {
  tone: ToastTone;
  message: string;
}

const TONE_TO_COLOR: Record<ToastTone, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.info,
};

const TONE_TO_ICON: Record<ToastTone, string> = {
  success: icons.check,
  error: icons.cross,
  info: icons.bullet,
};

export function Toast({ tone, message }: ToastProps) {
  return (
    <Box marginTop={1}>
      <Text color={TONE_TO_COLOR[tone]} bold>
        {TONE_TO_ICON[tone]}{" "}
      </Text>
      <Text color={colors.fg}>{message}</Text>
    </Box>
  );
}
