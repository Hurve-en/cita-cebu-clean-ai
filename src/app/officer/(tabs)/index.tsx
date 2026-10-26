import { Text, View } from "react-native";
import { router } from "expo-router";
import { useOfficer } from "@/features/officer/officer-state";
import {
  Metric,
  OfficerPage,
  o,
  Status,
  formatDate,
} from "@/features/officer/officer-ui";
import {
  Button,
  Card,
  Copy,
  Heading,
  MenuItem,
  Section,
  ui,
} from "@/features/resident/resident-ui";
export default function OfficerDashboard() {
  const { session, data } = useOfficer();
  const pending = data.reports.filter(
    (item) => item.status === "Pending review",
  );
  const progressing = data.reports.filter(
    (item) => item.status === "In progress",
  );
  const resolved = data.reports.filter((item) => item.status === "Resolved");
  const published = data.schedules.filter(
    (item) => item.status === "Published",
  );
  return (
    <OfficerPage
      title="Your community, at a glance."
      description={`Welcome, ${session?.name ?? "officer"}. Here is the sample work queue.`}
    >
      <View style={ui.hero}>
        <Text style={ui.eyebrow}>COMMUNITY OPERATIONS</Text>
        <Text style={ui.heroTitle}>Keep the next step clear.</Text>
        <Text style={ui.heroCopy}>
          Review reported concerns and keep collection information easy to
          follow.
        </Text>
      </View>
      <View style={o.metrics}>
        <Metric
          label="Awaiting review"
          count={pending.length}
          onPress={() =>
            router.push({
              pathname: "/officer/reports",
              params: { status: "Pending review" },
            })
          }
        />
        <Metric
          label="In progress"
          count={progressing.length}
          onPress={() =>
            router.push({
              pathname: "/officer/reports",
              params: { status: "In progress" },
            })
          }
        />
        <Metric
          label="Resolved"
          count={resolved.length}
          onPress={() =>
            router.push({
              pathname: "/officer/reports",
              params: { status: "Resolved" },
            })
          }
        />
        <Metric
          label="Published schedules"
          count={published.length}
          onPress={() =>
            router.push({
              pathname: "/officer/schedules",
              params: { status: "Published" },
            })
          }
        />
      </View>
      <Section
        title="Needs your attention"
        action="All reports"
        onPress={() =>
          router.push({
            pathname: "/officer/reports",
            params: { status: "All" },
          })
        }
      />
      {pending.length ? (
        pending.slice(0, 3).map((report) => (
          <Card
            key={report.id}
            onPress={() =>
              router.push({
                pathname: "/officer/report",
                params: { id: report.id },
              })
            }
          >
            <Status value={report.status} />
            <Heading>{report.title}</Heading>
            <Copy>{report.location}</Copy>
            <Text style={o.hint}>{formatDate(report.createdAt)}</Text>
          </Card>
        ))
      ) : (
        <Card>
          <Heading>Queue reviewed</Heading>
          <Copy>No sample reports are waiting for an initial review.</Copy>
        </Card>
      )}
      <Section title="Quick actions" />
      <MenuItem
        icon="calendar"
        title="Collection schedules"
        detail="Review published plans and drafts"
        onPress={() => router.push("/officer/schedules")}
      />
      <Button
        label="Create a collection schedule"
        onPress={() => router.push("/officer/schedule")}
      />
      <Copy>
        This workspace uses separate fictional fixtures. Resident reports and
        schedules are not synchronized with it yet.
      </Copy>
    </OfficerPage>
  );
}
