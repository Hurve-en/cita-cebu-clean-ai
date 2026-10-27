import { useAuth } from "@/features/auth/auth-state";
import { LiveHome } from "@/features/resident/live-ui";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useResident } from "@/features/resident/resident-state";
import {
  Card,
  Copy,
  Heading,
  Icon,
  MenuItem,
  openDetail,
  Page,
  Section,
  ui,
} from "@/features/resident/resident-ui";
const categories = [
  { name: "Glass", hint: "Bottles & jars", mark: "01" },
  { name: "Metal", hint: "Cans & containers", mark: "02" },
  { name: "Organic", hint: "Food & garden scraps", mark: "03" },
  { name: "Paper", hint: "Paper & cardboard", mark: "04" },
  { name: "Plastic", hint: "Check local acceptance", mark: "05" },
  { name: "Non-recyclable", hint: "Residual materials", mark: "06" },
];
function DemoHomeScreen() {
  const { state } = useResident();
  return (
    <Page
      title={`Hello, ${state.profile?.name.split(" ")[0] || "neighbor"}.`}
      subtitle="A little care. A cleaner community."
      accessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View notifications"
          style={ui.iconButton}
          onPress={() => openDetail("notifications")}
        >
          <Icon name="bell" />
        </Pressable>
      }
    >
      <MenuItem
        icon="pin"
        title={state.profile?.barangay || "Choose your barangay"}
        detail="Your community"
        onPress={() => openDetail("barangay")}
      />
      <View style={ui.hero}>
        <Text style={ui.eyebrow}>SORT WITH CONFIDENCE</Text>
        <Text accessibilityRole="header" style={ui.heroTitle}>
          Small actions.{"\n"}Cleaner surroundings.
        </Text>
        <Text style={ui.heroCopy}>
          Not sure where an item belongs? Start with a photo and check the
          sorting guide.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/scan")}
          style={({ pressed }) => [ui.heroButton, pressed && ui.pressed]}
        >
          <Icon name="scan" />
          <Text style={ui.heroButtonText}>Scan an item</Text>
        </Pressable>
      </View>
      <Section
        title="Your next collection"
        action="Schedules"
        onPress={() => router.push("/(tabs)/schedules")}
      />
      <Card>
        <View style={ui.row}>
          <View style={ui.iconTile}>
            <Icon name="calendar" />
          </View>
          <View style={ui.flex}>
            <Heading>No live schedule yet</Heading>
            <Copy>Official collection times are not connected.</Copy>
          </View>
        </View>
      </Card>
      <Section title="Sorting guide" />
      <View style={ui.grid}>
        {categories.map((category) => (
          <Pressable
            key={category.name}
            accessibilityRole="button"
            accessibilityLabel={`${category.name}: sorting guidance`}
            onPress={() => openDetail("category", category.name)}
            style={({ pressed }) => [ui.category, pressed && ui.pressed]}
          >
            <Text style={ui.badge}>{category.mark}</Text>
            <Text style={ui.categoryText}>{category.name}</Text>
            <Text style={ui.small}>{category.hint}</Text>
          </Pressable>
        ))}
      </View>
      <Section title="Around your community" />
      <MenuItem
        icon="report"
        title="Report a waste concern"
        detail="Dumping, overflowing bins, and more"
        onPress={() => openDetail("new-report")}
      />
      <MenuItem
        icon="history"
        title="My reports"
        detail={`${state.reports.length} demo reports in this session`}
        onPress={() => openDetail("reports")}
      />
      <MenuItem
        icon="gift"
        title="Explore your rewards"
        detail={`${state.points} demo points available`}
        onPress={() => router.push("/(tabs)/rewards")}
      />
    </Page>
  );
}

export default function HomeScreen() {
  const { state } = useAuth();
  return state.user ? <LiveHome /> : <DemoHomeScreen />;
}
