import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const features = [
  {
    title: "Scan waste",
    detail: "Identify waste and learn how to dispose of it.",
  },
  {
    title: "Collection schedules",
    detail: "Check collection days for your barangay.",
  },
  { title: "Report waste", detail: "Report dumping or overflowing bins." },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>CebuCleanAI</Text>
        <Text style={styles.title}>Cleaner habits. Cleaner Cebu.</Text>
        <Text style={styles.subtitle}>
          Your guide to responsible waste disposal.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Development preview • Services are not connected yet.
          </Text>
        </View>

        {features.map(({ title, detail }) => (
          <View key={title} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.subtitle}>{detail}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F8F5" },
  content: {
    padding: 24,
    gap: 20,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  brand: { fontSize: 18, fontWeight: "700", color: "#166534" },
  title: { fontSize: 32, fontWeight: "800", color: "#14281D" },
  subtitle: { fontSize: 16, lineHeight: 24, color: "#526158" },
  notice: { padding: 14, borderRadius: 12, backgroundColor: "#E4EEE5" },
  noticeText: { fontSize: 14, lineHeight: 20, color: "#275536" },
  card: { padding: 20, gap: 8, borderRadius: 16, backgroundColor: "#FFFFFF" },
  cardTitle: { fontSize: 19, fontWeight: "700", color: "#14281D" },
});
