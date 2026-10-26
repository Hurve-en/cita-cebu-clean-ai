import { Text, View } from "react-native";
import { useState } from "react";
import { SAMPLE_SCHEDULES } from "@/features/resident/resident-data";
import { useResident } from "@/features/resident/resident-state";
import {
  Button,
  Card,
  Copy,
  EmptyState,
  Heading,
  MenuItem,
  openDetail,
  Page,
  Section,
  ui,
} from "@/features/resident/resident-ui";
export default function SchedulesScreen() {
  const { state } = useResident();
  const [showSamples, setShowSamples] = useState(false);
  return (
    <Page title="Collection days" subtitle="Know when. Prepare ahead.">
      <MenuItem
        icon="pin"
        title={state.profile?.barangay || "Choose your barangay"}
        detail="Change community"
        onPress={() => openDetail("barangay")}
      />
      {!showSamples ? (
        <Card>
          <EmptyState
            icon="calendar"
            title="No published schedule"
            description="Your barangay's official collection schedule is not connected yet."
          />
          <Button
            label="Explore sample schedules"
            secondary
            onPress={() => setShowSamples(true)}
          />
        </Card>
      ) : (
        <>
          <Card>
            <Heading>Sample week</Heading>
            <Copy>
              These are fictional examples. Confirm actual collection days with
              your barangay.
            </Copy>
            <Button
              secondary
              label="Hide sample schedules"
              onPress={() => setShowSamples(false)}
            />
          </Card>
          <Section title="Weekly collection" />
          {SAMPLE_SCHEDULES.map((item) => (
            <Card key={item.id} onPress={() => openDetail("schedule", item.id)}>
              <View style={ui.row}>
                <Text style={ui.badge}>{item.day}</Text>
                <Text style={ui.small}>Sample only</Text>
              </View>
              <Heading>{item.title}</Heading>
              <Copy>{item.time}</Copy>
              <Text style={ui.link}>Preparation instructions →</Text>
            </Card>
          ))}
        </>
      )}
      <MenuItem
        icon="bell"
        title="Reminder preferences"
        detail="Preview notification settings"
        onPress={() => openDetail("settings")}
      />
    </Page>
  );
}
