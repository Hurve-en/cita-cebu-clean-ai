import { StyleSheet, View, type ViewProps } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type AppCardProps = ViewProps & {
  variant?: "default" | "soft";
};

export function AppCard({
  children,
  style,
  variant = "default",
  ...props
}: AppCardProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor:
            variant === "soft"
              ? theme.backgroundSelected
              : theme.backgroundElement,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderRadius: 24,
  },
});
