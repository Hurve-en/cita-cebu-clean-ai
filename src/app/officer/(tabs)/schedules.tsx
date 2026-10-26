import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { useOfficer } from "@/features/officer/officer-state";
import { Chips, OfficerPage, Status, o } from "@/features/officer/officer-ui";
import {
  Button,
  Card,
  Copy,
  EmptyState,
  Heading,
} from "@/features/resident/resident-ui";
const FILTERS = ["All active", "Published", "Draft", "Archived"] as const;
export default function OfficerSchedules() {
  const { data } = useOfficer();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const filter = FILTERS.find((value) => value === status) ?? "All active";
  const schedules = data.schedules.filter((item) =>
    filter === "All active"
      ? item.status !== "Archived"
      : item.status === filter,
  );
  return (
    <OfficerPage
      title="Collection schedules"
      description="Keep the weekly plan easy to understand."
    >
      <Button
        label="Create schedule"
        onPress={() => router.push("/officer/schedule")}
      />
      <Chips
        options={FILTERS}
        selected={filter}
        label="Schedule filter"
        onChange={(value) => router.setParams({ status: value })}
      />
      <Text style={o.hint}>
        {schedules.length} sample schedules · Times use the local collection
        clock
      </Text>
      {!schedules.length && (
        <Card>
          <EmptyState
            icon="calendar"
            title="Nothing in this view"
            description="Choose another filter or create a collection schedule."
          />
        </Card>
      )}
      {schedules.map((schedule) => (
        <Card
          key={schedule.id}
          onPress={() =>
            router.push({
              pathname: "/officer/schedule",
              params: { id: schedule.id },
            })
          }
        >
          <Status value={schedule.status} />
          <Heading>{schedule.title}</Heading>
          <Copy>
            {schedule.stream} ·{" "}
            {schedule.days.map((day) => day.slice(0, 3)).join(" / ")}
          </Copy>
          <Copy>
            {schedule.startTime}–{schedule.endTime}
          </Copy>
          <Copy>{schedule.location}</Copy>
          <Text style={o.hint}>
            {schedule.status === "Archived"
              ? "View and restore to draft →"
              : "View and edit →"}
          </Text>
        </Card>
      ))}
      <Copy>
        Publishing here only changes demo data. It does not publish to the
        resident app or notify anyone.
      </Copy>
    </OfficerPage>
  );
}
