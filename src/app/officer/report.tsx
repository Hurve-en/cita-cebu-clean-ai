import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import {
  REPORT_STATUSES,
  type ReportStatus,
} from "@/features/officer/officer-service";
import { useOfficer } from "@/features/officer/officer-state";
import {
  Chips,
  errorText,
  formatDate,
  OfficerPage,
  o,
  Status,
} from "@/features/officer/officer-ui";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Message,
} from "@/features/resident/resident-ui";
export default function ReportRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return <ReportReview key={id} id={id} />;
}
function ReportReview({ id }: { id: string }) {
  const { data, updateReport } = useOfficer();
  const report = data.reports.find((item) => item.id === id);
  const [status, setStatus] = useState<ReportStatus>(
    report?.status ?? "Pending review",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function save() {
    if (lock.current || !report) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateReport(report.id, status, note);
      setNote("");
      setMessage(
        "Report updated in the demo workspace. No resident notification was sent.",
      );
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!report)
    return (
      <OfficerPage title="Report unavailable" back>
        <Card>
          <Copy>This report is not available in your assigned community.</Copy>
        </Card>
        <Button
          label="View reports"
          onPress={() => router.replace("/officer/reports")}
        />
      </OfficerPage>
    );
  return (
    <OfficerPage title={report.title} description={report.location} back>
      <Status value={report.status} />
      <Card>
        <Heading>Reported concern</Heading>
        <Copy>{report.description}</Copy>
        <Copy>{report.category}</Copy>
        <Text style={o.hint}>
          {report.reporter} · {formatDate(report.createdAt)}
        </Text>
      </Card>
      <Card>
        <Heading>Photo evidence</Heading>
        <Copy>
          No photo is attached to this fictional report. Resident attachment
          storage is not connected to the officer demo.
        </Copy>
      </Card>
      <Heading>Update status</Heading>
      <Chips
        options={REPORT_STATUSES}
        selected={status}
        label="Report status"
        onChange={(value) => {
          if (!lock.current) {
            setStatus(value);
            setMessage("");
          }
        }}
      />
      <Field
        label={
          status === "Resolved"
            ? "Resolution note · Required"
            : "Internal note · Optional"
        }
        placeholder={
          status === "Resolved"
            ? "Explain what was done to resolve the concern."
            : "Record the next step or an update."
        }
        value={note}
        onChangeText={(value) => {
          setNote(value);
          setMessage("");
        }}
        multiline
        maxLength={1000}
        editable={!busy}
      />
      <Copy>
        {status === "Resolved"
          ? "Use at least 8 characters to describe the resolution."
          : "Notes remain internal in this preview. Changing status creates a timeline entry."}
      </Copy>
      <Message error text={error} />
      <Message text={message} />
      <Button
        label={busy ? "Saving update…" : "Save report update"}
        onPress={save}
        disabled={busy || (status === report.status && !note.trim())}
      />
      <Heading>Activity timeline</Heading>
      <Card>
        {report.events.map((event) => (
          <View key={event.id} style={o.timeline}>
            <Status value={event.status} />
            <Copy>{event.note}</Copy>
            <Text style={o.hint}>
              {event.actor} · {formatDate(event.createdAt)}
            </Text>
          </View>
        ))}
      </Card>
    </OfficerPage>
  );
}
