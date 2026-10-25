import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.screen, { backgroundColor: theme.background }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.brand} themeColor="primary">
            CebuCleanAI
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Resident app · Design preview
          </ThemedText>
        </View>

        <View style={styles.introduction}>
          <ThemedText type="title" accessibilityRole="header">
            Small actions.{"\n"}Cleaner Cebu.
          </ThemedText>

          <ThemedText themeColor="textSecondary">
            Start with what’s in your hand.
          </ThemedText>
        </View>

        <AppCard style={styles.hero}>
          <ThemedText type="smallBold" style={styles.heroEyebrow}>
            SORT SMARTER
          </ThemedText>

          <ThemedText
            type="subtitle"
            style={styles.heroText}
            accessibilityRole="header"
          >
            Not sure where it goes?
          </ThemedText>

          <ThemedText style={styles.heroText}>
            Scan an item for sorting guidance.
          </ThemedText>

          <AppButton
            label="Scan waste"
            onPress={() => undefined}
            disabled
            accessibilityHint="Scanning is not available in this preview."
          />

          <ThemedText type="small" style={styles.heroText}>
            Scanning is not connected yet.
          </ThemedText>
        </AppCard>

        <AppCard>
          <ThemedText type="smallBold" themeColor="primary">
            COLLECTION PREVIEW · SAMPLE DATA
          </ThemedText>

          <ThemedText style={styles.cardHeading} accessibilityRole="header">
            Recyclables
          </ThemedText>

          <ThemedText themeColor="textSecondary">
            Example window: Monday, 6:00–8:00 AM.
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            No barangay is selected. Confirm collection times with your barangay
            before setting waste out.
          </ThemedText>
        </AppCard>

        <AppCard variant="soft">
          <ThemedText style={styles.cardHeading} accessibilityRole="header">
            A small tip for today
          </ThemedText>

          <ThemedText themeColor="textSecondary">
            Empty containers and rinse them when needed. Check which materials
            your local collection accepts.
          </ThemedText>
        </AppCard>

        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.footer}
        >
          Development preview. Account services, scanning, schedules, and
          reporting are not connected.
        </ThemedText>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === "web" ? 96 : Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  brand: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "800",
  },
  introduction: {
    gap: Spacing.two,
  },
  hero: {
    backgroundColor: "#16634A",
  },
  heroEyebrow: {
    color: "#D6F58A",
    letterSpacing: 1,
  },
  heroText: {
    color: "#FFFFFF",
  },
  cardHeading: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
  },
});
