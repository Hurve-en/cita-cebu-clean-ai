import { SymbolView } from "expo-symbols";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppScreen } from "@/components/ui/app-screen";
import { useTheme } from "@/hooks/use-theme";

export default function ScanScreen() {
  const theme = useTheme();

  return (
    <AppScreen
      title="Waste scanner"
      description="One item. A little more clarity."
    >
      <AppCard variant="soft" style={styles.preview}>
        <SymbolView
          name={{
            ios: "camera",
            android: "photo_camera",
            web: "photo_camera",
          }}
          size={64}
          tintColor={theme.primary}
        />

        <ThemedText style={styles.center}>
          Your camera preview will appear here.
        </ThemedText>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.center}
        >
          This screen does not access your camera yet.
        </ThemedText>
      </AppCard>

      <ThemedText type="smallBold">Good light makes a difference.</ThemedText>

      <ThemedText themeColor="textSecondary">
        Show one item against a plain background. Identification will provide
        guidance, not a guarantee of correct disposal.
      </ThemedText>

      <AppButton
        label="Capture & identify"
        disabled
        onPress={() => undefined}
        accessibilityHint="Camera scanning is not implemented yet."
      />

      <AppButton
        label="Choose a photo"
        variant="secondary"
        disabled
        onPress={() => undefined}
        accessibilityHint="Photo selection is not implemented yet."
      />

      <ThemedText type="small" themeColor="textSecondary">
        Navigation preview only. No classification, disposal verification, or
        reward points are generated.
      </ThemedText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    textAlign: "center",
  },
});
