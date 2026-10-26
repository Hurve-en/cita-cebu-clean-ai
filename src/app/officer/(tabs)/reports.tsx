import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { REPORT_STATUSES } from "@/features/officer/officer-service";
import { useOfficer } from "@/features/officer/officer-state";
import {
  Chips,
  OfficerPage,
  Status,
  formatDate,
  o,
} from "@/features/officer/officer-ui";
import {
  Button,
  Card,
  Copy,
  EmptyState,
  Field,
  Heading,
} from "@/features/resident/resident-ui";
const FILTERS = ["All", ...REPORT_STATUSES] as const;
export default function OfficerReports() {
  const { data } = useOfficer();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const filter = FILTERS.find((value) => value === status) ?? "All";
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const reports = data.reports
    .filter(
      (item) =>
        (filter === "All" || item.status === filter) &&
        `${item.title} ${item.location} ${item.category} ${item.reporter}`
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <OfficerPage
      title="Resident reports"
      description="Review a concern, record the action, and close the loop."
    >
      <Field
        label="Search reports"
        placeholder="Title, landmark, or category"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />
      <Chips
        options={FILTERS}
        selected={filter}
        label="Report filter"
        onChange={(value) => router.setParams({ status: value })}
      />
      <Text style={o.hint}>
        {reports.length} matching reports · Assigned demo barangay only
      </Text>
      {!reports.length && (
        <Card>
          <EmptyState
            icon="report"
            title="No matching reports"
            description="Try another status or clear your search."
          />
          <Button
            secondary
            label="Clear filters"
            onPress={() => {
              setSearch("");
              router.setParams({ status: "All" });
            }}
          />
        </Card>
      )}
      {reports.map((report) => (
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
          <Text style={o.hint}>
            {report.category} · {formatDate(report.createdAt)}
          </Text>
          <Text style={o.hint}>Review report →</Text>
        </Card>
      ))}
      <Copy>
        These are fictional sample reports, not submissions from real residents.
      </Copy>
    </OfficerPage>
  );
}
