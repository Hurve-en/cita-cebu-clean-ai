import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppCard } from "@/components/ui/app-card";
import { AppScreen } from "@/components/ui/app-screen";

const sampleSchedules = [
  {
    category: "Recyclables",
    days: "MONDAY / THURSDAY",
    time: "6:00–8:00 AM",
    instruction: "Keep accepted materials clean and dry.",
  },
  {
    category: "Residual waste",
    days: "TUESDAY / FRIDAY",
    time: "7:00–9:00 PM",
    instruction: "Keep bags sealed and follow local collection rules.",
  },
  {
    category: "Biodegradables",
    days: "WEDNESDAY / SATURDAY",
    time: "6:00–8:00 AM",
    instruction: "Separate food scraps from packaging.",
  },
];

export default function SchedulesScreen() {
  return (
    <AppScreen
      title="Collection days"
      description="A little planning. A cleaner neighborhood."
    >
      <AppCard variant="soft">
        <ThemedText type="smallBold" themeColor="warning">
          SAMPLE DATA — NOT A LIVE SCHEDULE
        </ThemedText>

        <ThemedText>
          No barangay is selected. The times below demonstrate the interface and
          must not be used for actual disposal.
        </ThemedText>
      </AppCard>

      {sampleSchedules.map((schedule) => (
        <AppCard key={schedule.category}>
          <ThemedText type="smallBold" themeColor="primary">
            {schedule.days}
          </ThemedText>

          <ThemedText style={styles.heading} accessibilityRole="header">
            {schedule.category}
          </ThemedText>

          <ThemedText>{schedule.time}</ThemedText>

          <ThemedText themeColor="textSecondary">
            {schedule.instruction}
          </ThemedText>
        </AppCard>
      ))}

      <ThemedText type="small" themeColor="textSecondary">
        Confirm collection information with your barangay before setting waste
        out. Barangay selection and published schedules will be connected later.
      </ThemedText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "700",
  },
});
