import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Switch, Text, View } from "react-native";
import {
  DAYS,
  STREAMS,
  type Day,
  type ScheduleDraft,
  type Stream,
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
  ui,
} from "@/features/resident/resident-ui";
export default function ScheduleRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  return <ScheduleEditor key={id ?? "new"} id={id} />;
}
function ScheduleEditor({ id }: { id?: string }) {
  const { session, data, saveSchedule, archiveSchedule, restoreSchedule } =
    useOfficer();
  const existing = data.schedules.find((item) => item.id === id);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [stream, setStream] = useState<Stream>(
    existing?.stream ?? "Recyclables",
  );
  const [days, setDays] = useState<Day[]>(existing?.days ?? []);
  const [start, setStart] = useState(existing?.startTime ?? "08:00");
  const [end, setEnd] = useState(existing?.endTime ?? "11:00");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [instructions, setInstructions] = useState(
    existing?.instructions ?? "",
  );
  const [published, setPublished] = useState(existing?.status === "Published");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const lock = useRef(false);
  async function perform(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
      router.replace("/officer/schedules");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function save() {
    const draft: ScheduleDraft = {
      title,
      stream,
      days,
      startTime: start.trim(),
      endTime: end.trim(),
      location,
      instructions,
      status: published ? "Published" : "Draft",
    };
    void perform(() => saveSchedule(id, draft));
  }
  if (id && !existing)
    return (
      <OfficerPage title="Schedule unavailable" back>
        <Card>
          <Copy>
            This schedule is not available in your assigned demo barangay.
          </Copy>
        </Card>
        <Button
          label="View schedules"
          onPress={() => router.replace("/officer/schedules")}
        />
      </OfficerPage>
    );
  if (existing?.status === "Archived")
    return (
      <OfficerPage title={existing.title} back>
        <Status value="Archived" />
        <Card>
          <Heading>Archived schedule</Heading>
          <Copy>
            {existing.days.join(", ")} · {existing.startTime}–{existing.endTime}
          </Copy>
          <Copy>{existing.location}</Copy>
          <Copy>
            Restore this schedule to a draft before editing or publishing it
            again.
          </Copy>
        </Card>
        <Message error text={error} />
        <Button
          label={busy ? "Restoring…" : "Restore to draft"}
          disabled={busy}
          onPress={() => {
            void perform(() => restoreSchedule(existing.id));
          }}
        />
      </OfficerPage>
    );
  return (
    <OfficerPage
      title={
        existing ? "Edit collection schedule" : "Create collection schedule"
      }
      description={session?.barangayName}
      back
    >
      {existing && (
        <>
          <Status value={existing.status} />
          <Text style={o.hint}>
            Last updated {formatDate(existing.updatedAt)}
          </Text>
        </>
      )}
      <Field
        label="Schedule title"
        placeholder="For example: Dry recyclables collection"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        editable={!busy}
      />
      <Heading>Waste stream</Heading>
      <Chips
        options={STREAMS}
        selected={stream}
        label="Waste stream"
        onChange={(value) => {
          if (!lock.current) setStream(value);
        }}
      />
      <Heading>Collection days</Heading>
      <View style={o.chips}>
        {DAYS.map((day) => (
          <Pressable
            key={day}
            accessibilityRole="checkbox"
            accessibilityLabel={day}
            accessibilityState={{ checked: days.includes(day), disabled: busy }}
            disabled={busy}
            onPress={() =>
              setDays((current) =>
                current.includes(day)
                  ? current.filter((item) => item !== day)
                  : [...current, day],
              )
            }
            style={({ pressed }) => [
              o.chip,
              days.includes(day) && o.selectedChip,
              pressed && ui.pressed,
            ]}
          >
            <Text style={[o.chipText, days.includes(day) && o.selectedText]}>
              {day.slice(0, 3)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Start time · 24-hour format"
        placeholder="08:00"
        value={start}
        onChangeText={setStart}
        maxLength={5}
        autoCapitalize="none"
        editable={!busy}
      />
      <Field
        label="End time · 24-hour format"
        placeholder="11:00"
        value={end}
        onChangeText={setEnd}
        maxLength={5}
        autoCapitalize="none"
        editable={!busy}
      />
      <Copy>
        Use HH:MM. The end time must be later on the same day. This schedule
        repeats weekly on the selected days.
      </Copy>
      <Field
        label="Collection area"
        placeholder="Zones, streets, or collection points"
        value={location}
        onChangeText={setLocation}
        maxLength={150}
        editable={!busy}
      />
      <Field
        label="Preparation instructions · Optional"
        value={instructions}
        onChangeText={setInstructions}
        multiline
        maxLength={1000}
        editable={!busy}
      />
      <Card>
        <View style={ui.row}>
          <View style={ui.flex}>
            <Heading>Publish in demo</Heading>
            <Copy>
              {published
                ? "Marked as published in this workspace."
                : "Keep this plan as a draft."}
            </Copy>
          </View>
          <Switch
            accessibilityLabel="Publish this demo schedule"
            value={published}
            disabled={busy}
            onValueChange={setPublished}
          />
        </View>
        <Copy>No live schedule is published and no notification is sent.</Copy>
      </Card>
      <Message error text={error} />
      <Button
        label={
          busy
            ? "Saving…"
            : existing
              ? "Save schedule changes"
              : "Save collection schedule"
        }
        disabled={busy}
        onPress={save}
      />
      {existing && !confirmArchive && (
        <Button
          secondary
          label="Archive schedule"
          disabled={busy}
          onPress={() => setConfirmArchive(true)}
        />
      )}
      {existing && confirmArchive && (
        <Card>
          <Heading>Archive this schedule?</Heading>
          <Copy>
            It will leave the active list. You can restore it to draft from
            Archived.
          </Copy>
          <Button
            label="Confirm archive"
            disabled={busy}
            onPress={() => {
              void perform(() => archiveSchedule(existing.id));
            }}
          />
          <Button
            secondary
            label="Keep schedule"
            disabled={busy}
            onPress={() => setConfirmArchive(false)}
          />
        </Card>
      )}
    </OfficerPage>
  );
}
