import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type AppScreenProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function AppScreen({ title, description, children }: AppScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="smallBold" themeColor="primary">
          CebuCleanAI
        </ThemedText>

        <ThemedText type="title" accessibilityRole="header">
          {title}
        </ThemedText>

        <ThemedText themeColor="textSecondary">{description}</ThemedText>

        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
});
