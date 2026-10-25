import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type AppButtonProps = {
  label: string;
  onPress: NonNullable<PressableProps["onPress"]>;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: AppButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const unavailable = disabled || loading;
  const primary = variant === "primary";

  const backgroundColor = primary ? theme.accent : theme.backgroundElement;

  const color = primary ? theme.onAccent : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: focused
            ? theme.info
            : primary
              ? theme.accent
              : theme.border,
          opacity: unavailable ? 0.5 : pressed ? 0.75 : hovered ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={color} />}

      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
});
