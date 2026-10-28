import { HistoryReports } from './history-ui';
import { ReportPhotoPanel, SavedScan } from './media-ui';
import { BarangayPicker } from "./barangay-picker";
import { ReportSubmission } from "./report-submission-ui";
import { SortingGuide } from "./sorting-guide";
import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/features/auth/auth-state";
import { createResidentReadService } from "./live-service";
import { CATEGORY_GUIDANCE } from "./resident-data";
import { useLiveResident } from "./live-state";
import {
  dateLabel,
  statusLabel,
  timeLabel,
  weekdayLabel,
  type Profile,
  type Schedule,
} from "./live-model";
import type { Paged, Resource } from "./live-store";
import {
  Button,
  Card,
  Copy,
  EmptyState,
  Field,
  Heading,
  Icon,
  MenuItem,
  Message,
  openDetail,
  Page,
  Section,
  ui,
} from "./resident-ui";
const BADGE = "Resident account";
function Feedback({
  data,
  retry,
  empty,
}: {
  data: Resource<unknown>;
  retry: () => void;
  empty?: string;
}) {
  if (data.loading) return <Copy>Loading…</Copy>;
  if (data.error)
    return (
      <>
        <Message error text={data.error} />
        <Button secondary label="Try again" onPress={retry} />
      </>
    );
  if (empty)
    return (
      <EmptyState title={empty} description="Refresh to check for updates." />
    );
  return null;
}
function More<T>({ data, load }: { data: Paged<T>; load: () => void }) {
  return data.more ? (
    <Button
      secondary
      disabled={data.loading}
      label={data.loading ? "Loading…" : "Load more"}
      onPress={load}
    />
  ) : null;
}
function ProfileSummary() {
  const { state, actions } = useLiveResident();
  return (
    <>
      <Feedback
        data={state.profile}
        retry={() => void actions.reloadProfile()}
      />
      {state.profile.value && (
        <MenuItem
          icon="pin"
          title={
            state.profile.value.barangay_name ??
            state.barangays.value.find(
              (b) => b.id === state.profile.value?.resident_barangay_id,
            )?.name ??
            (state.profile.value.resident_barangay_id
              ? "Selected barangay"
              : "Choose your barangay")
          }
          detail="Your collection community"
          onPress={() => openDetail("barangay")}
        />
      )}
    </>
  );
}
function ScheduleCard({ row }: { row: Schedule }) {
  return (
    <Card onPress={() => openDetail("schedule", row.id)}>
      <View style={ui.row}>
        <Text style={ui.badge}>{weekdayLabel(row.weekdays)}</Text>
        <Copy>Published</Copy>
      </View>
      <Heading>{row.title}</Heading>
      <Copy>{timeLabel(row)}</Copy>
      <Copy>{row.area}</Copy>
      <Text style={ui.link}>Collection instructions →</Text>
    </Card>
  );
}
export function LiveHome() {
  const { state, actions } = useLiveResident();
  const name = state.profile.value?.display_name.split(" ")[0] || "neighbor";
  return (
    <Page
      title={`Hello, ${name}.`}
      subtitle="A little care. A cleaner community."
      badge={BADGE}
    >
      <ProfileSummary />
      <View style={ui.hero}>
        <Text style={ui.eyebrow}>SORT WITH CARE</Text>
        <Text style={ui.heroTitle}>
          Small actions.{"\n"}Cleaner surroundings.
        </Text>
        <Text style={ui.heroCopy}>
          Use a photo for sorting guidance. Results are suggestions. Completed scans save their photo and result to your account; check the save status after analysis.
        </Text>
        <Button
          label="Scan an item"
          onPress={() => router.push("/(tabs)/scan")}
        />
      </View>
      <Section
        title="Collection information"
        action="Schedules"
        onPress={() => router.push("/(tabs)/schedules")}
      />
      {!state.profile.value ? (
        <Copy>Load your account details to view collection information.</Copy>
      ) : !state.profile.value.resident_barangay_id ? (
        <Card>
          <Heading>Choose your barangay</Heading>
          <Copy>
            Select a community to see its published weekly collection
            information.
          </Copy>
          <Button
            secondary
            label="Choose community"
            onPress={() => openDetail("barangay")}
          />
        </Card>
      ) : (
        <>
          <Feedback
            data={state.schedules}
            retry={() => void actions.loadSchedules()}
            empty={
              state.schedules.loaded && !state.schedules.value.length
                ? "No published schedule yet"
                : undefined
            }
          />
          {state.schedules.value[0] && (
            <ScheduleCard row={state.schedules.value[0]} />
          )}
        </>
      )}
      <Section
        title="Your reports"
        action="View all"
        onPress={() => openDetail("reports")}
      />
      <Feedback
        data={state.reports}
        retry={() => void actions.loadReports()}
        empty={
          state.reports.loaded && !state.reports.value.length
            ? "No reports yet"
            : undefined
        }
      />
      {state.reports.value.slice(0, 3).map((row) => (
        <Card key={row.id} onPress={() => openDetail("report", row.id)}>
          <Text style={ui.badge}>{statusLabel(row.status)}</Text>
          <Heading>{row.title}</Heading>
          <Copy>{dateLabel(row.created_at)}</Copy>
        </Card>
      ))}
      <MenuItem
        icon="report"
        title="Report a waste concern"
        detail="Send a report to your selected barangay"
        onPress={() => openDetail("new-report")}
      />
      <Section title="Sorting guide" />
      <SortingGuide />
      <Copy>
        Collection information is provided by your barangay. Contact them for urgent concerns or schedule changes.
      </Copy>
    </Page>
  );
}
export function LiveSchedules() {
  const { state, actions } = useLiveResident();
  return (
    <Page
      title="Collection days"
      subtitle="Published weekly collection information."
      badge={BADGE}
    >
      <ProfileSummary />
      {!state.profile.value ? (
        <Copy>
          Collection information will appear after your account details load.
        </Copy>
      ) : !state.profile.value.resident_barangay_id ? (
        <Card>
          <Heading>Select your community first</Heading>
          <Button
            label="Choose barangay"
            onPress={() => openDetail("barangay")}
          />
        </Card>
      ) : (
        <>
          <Copy>
            All collection windows use Philippine time. These are recurring
            schedules, not live vehicle tracking or confirmed arrival times.
          </Copy>
          <Feedback
            data={state.schedules}
            retry={() => void actions.loadSchedules()}
            empty={
              state.schedules.loaded && !state.schedules.value.length
                ? "No published schedule yet"
                : undefined
            }
          />
          {state.schedules.value.map((row) => (
            <ScheduleCard row={row} key={row.id} />
          ))}
          <More
            data={state.schedules}
            load={() => void actions.loadSchedules(true)}
          />
          <Button
            secondary
            disabled={state.schedules.loading}
            label="Refresh schedules"
            onPress={() => void actions.loadSchedules()}
          />
        </>
      )}
    </Page>
  );
}
export { ResidentRewards as LiveRewards } from '../rewards/rewards-ui';

export function LiveProfile() {
  const auth = useAuth();
  const { state, actions } = useLiveResident();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  return (
    <Page
      title="Your space"
      subtitle="Manage your account and community."
      badge={BADGE}
    >
      <Feedback
        data={state.profile}
        retry={() => void actions.reloadProfile()}
      />
      <Card>
        <Icon name="person" size={30} />
        <Heading>
          {state.profile.value?.display_name || "Your resident account"}
        </Heading>
        <Copy>{auth.state.user?.email}</Copy>
        <Text style={ui.badge}>Resident</Text>
      </Card>
      <MenuItem
        icon="person"
        title="Account details"
        detail="Name and barangay"
        onPress={() => openDetail("edit-profile")}
      />
      <MenuItem icon="history" title="History Reports" detail="Saved photos, submissions and points earned" onPress={() => openDetail("history")} />
      <MenuItem
        icon="help"
        title="Help and privacy"
        onPress={() => openDetail("help")}
      />
      <Button secondary disabled={busy} label="Check account access again" onPress={() => { void auth.refresh(); }} />
      <Message error text={error} />
      <Button
        secondary
        disabled={busy}
        label={busy ? "Signing out…" : "Sign out of this device"}
        onPress={() => {
          if (running.current) return;
          running.current = true;
          setBusy(true);
          setError("");
          void auth
            .signOut()
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : "Sign-out failed. Retry.",
              ),
            )
            .finally(() => {
              running.current = false;
              setBusy(false);
            });
        }}
      />
    </Page>
  );
}
function ReportDetail({ id }: { id: string }) {
  const { enabled, state, actions } = useLiveResident();
  useEffect(() => {
    if (!enabled || !state.owner) return;
    void actions.openReport(id);
    return () => actions.closeReport();
  }, [actions, id, enabled, state.owner]);
  const detail = state.detail.id === id ? state.detail : null;
  const row = detail?.report.value;
  return (
    <Page title={row?.title || "Report details"} badge={BADGE} back>
      {detail && (
        <Feedback
          data={detail.report}
          retry={() => void actions.openReport(id)}
        />
      )}
      {!detail && <Copy>Loading report…</Copy>}
      {detail?.report.loaded &&
        !detail.report.loading &&
        !detail.report.error &&
        !row && (
          <EmptyState
            title="Report unavailable"
            description="This report may not exist or may not be accessible to your account."
          />
        )}
      {row && (
        <>
          <Card>
            <Text style={ui.badge}>{statusLabel(row.status)}</Text>
            <Heading>{row.title}</Heading>
            <Copy>{row.location_text}</Copy>
            <Copy>{row.description}</Copy>
            <Copy>Submitted {dateLabel(row.created_at)}</Copy>
            <Copy>Updated {dateLabel(row.updated_at)}</Copy>
          </Card>
        </>
      )}
      <ReportPhotoPanel key={id} reportId={id} available={Boolean(row)} />
      {row && (
        <>
          <Section title="Report activity" />
          <Feedback
            data={detail!.events}
            retry={() => void actions.loadEvents()}
            empty={
              detail!.events.loaded && !detail!.events.value.length
                ? "No public activity yet"
                : undefined
            }
          />
          {detail!.events.value.map((event) => (
            <Card key={event.id}>
              <Heading>
                {event.event_type === "created"
                  ? "Report submitted"
                  : `Status: ${statusLabel(event.next_status)}`}
              </Heading>
              {event.note && <Copy>{event.note}</Copy>}
              <Copy>{dateLabel(event.created_at)}</Copy>
            </Card>
          ))}
          <More
            data={detail!.events}
            load={() => void actions.loadEvents(true)}
          />
          <Button
            secondary
            label="Refresh report"
            onPress={() => void actions.openReport(id)}
          />
        </>
      )}
    </Page>
  );
}
function EditProfile() {
  const { state, actions } = useLiveResident();
  return (
    <Page title="Your account details" badge={BADGE} back>
      <Feedback
        data={state.profile}
        retry={() => void actions.reloadProfile()}
      />
      {state.profile.value && (
        <ProfileForm
          key={`${state.owner}:${state.profile.value.version}`}
          profile={state.profile.value}
        />
      )}
    </Page>
  );
}
function ProfileForm({ profile }: { profile: Profile }) {
  const { state, actions } = useLiveResident();
  const [name, setName] = useState(profile.display_name),
    [barangay, setBarangay] = useState(profile.resident_barangay_id);
  return (
    <>
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoComplete="name"
        editable={!state.saving}
      />
      <BarangayPicker
        value={barangay}
        selectedName={barangay === profile.resident_barangay_id ? profile.barangay_name : null}
        disabled={state.saving}
        onChange={setBarangay}
      />
      <Message error text={state.saveError} />
      <Message text={state.notice} />
      <Button
        disabled={state.saving}
        label={state.saving ? "Saving…" : "Save account details"}
        onPress={() => {
          void actions.saveProfile(name, barangay);
        }}
      />
      <Button
        secondary
        disabled={state.saving}
        label="Reload account details"
        onPress={() => void actions.reloadProfile()}
      />
    </>
  );
}
function ScheduleDetail({ id }: { id: string }) {
  const { state } = useLiveResident();
  const { client } = useAuth();
  const service = useMemo(
    () => (client ? createResidentReadService(client) : null),
    [client],
  );
  const barangay = state.profile.value?.resident_barangay_id;
  const [data, setData] = useState<Resource<Schedule | null>>({
    value: null,
    loading: true,
    error: "",
    loaded: false,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!service || !barangay) {
        if (active)
          setData({ value: null, loading: false, loaded: true, error: "" });
        return;
      }
      try {
        const value = await service.schedule(barangay, id);
        if (active) setData({ value, loading: false, error: "", loaded: true });
      } catch (e) {
        if (active)
          setData({
            value: null,
            loading: false,
            loaded: true,
            error: e instanceof Error ? e.message : "Could not load schedule.",
          });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [service, barangay, id, attempt]);
  const row = data.value;
  return (
    <Page title={row?.title || "Collection schedule"} badge={BADGE} back>
      <Feedback
        data={data}
        retry={() => {
          setData({ value: null, loading: true, error: "", loaded: false });
          setAttempt((v) => v + 1);
        }}
      />
      {row ? (
        <Card>
          <Heading>{weekdayLabel(row.weekdays)}</Heading>
          <Copy>{timeLabel(row)}</Copy>
          <Copy>{row.area}</Copy>
          <Copy>Waste stream: {row.stream}</Copy>
          <Copy>
            {row.instructions || "No additional instructions provided."}
          </Copy>
          <Copy>
            Weekly recurring collection. Check with your barangay for
            cancellations or exceptions.
          </Copy>
        </Card>
      ) : (
        data.loaded &&
        !data.loading &&
        !data.error && (
          <>
            <Copy>
              This schedule may no longer be published or accessible in your
              selected community.
            </Copy>
            <Button
              secondary
              label="View published schedules"
              onPress={() => router.replace("/(tabs)/schedules")}
            />
          </>
        )
      )}
    </Page>
  );
}
export function LiveDetail({ view, id }: { view: string; id: string }) {
  const { state: auth } = useAuth();
  const { enabled } = useLiveResident();
  if (!auth.user || (!enabled && auth.phase !== "loading")) return <Redirect href="/workspace" />;
  return <View style={{ flex: 1, display: enabled ? "flex" : "none" }}>
    <LiveDetailContent key={auth.user.id} view={view} id={id} />
  </View>;
}
function LiveDetailContent({ view, id }: { view: string; id: string }) {
  const { state: auth } = useAuth();
  const { state } = useLiveResident();

  if (view === "history" || view === "reports") return <HistoryReports />;
  if (view === "scan-record") return <SavedScan key={id} id={id} />;
  if (view === "new-report") return <ReportSubmission key={auth.user!.id} />;

  if (view === "report")
    return <ReportDetail key={`${auth.user?.id}:${id}`} id={id} />;
  if (view === "schedule")
    return (
      <ScheduleDetail
        key={`${state.profile.value?.resident_barangay_id}:${id}`}
        id={id}
      />
    );
  if (view === "edit-profile" || view === "barangay") return <EditProfile />;
  if (view === "category")
    return (
      <Page title={id || "Sorting guide"} badge={BADGE} back>
        <Card>
          <Heading>Before you dispose</Heading>
          <Copy>
            {CATEGORY_GUIDANCE[id] ||
              "Guidance for this category is not available."}
          </Copy>
          <Copy>
            General sorting guidance only. Follow your barangay&apos;s current
            disposal rules.
          </Copy>
        </Card>
      </Page>
    );
  if (view === "help")
    return (
      <Page title="Help and privacy" badge={BADGE} back>
        <Card>
          <Heading>Your connected account</Heading>
          <Copy>
            Profiles, published schedules and your reports are retrieved from
            Supabase using your authenticated session. Report activity shown
            here is resident-visible activity. You can submit text reports to your selected barangay.
          </Copy>
          <Copy>
            Classification runs on this device. Completed scans upload a resized photo and model suggestion to your private account history. You can remove saved scans and report photos. Interrupted uploads keep a retry copy on the original device until confirmed or removed.
          </Copy>
          <Copy>
            For collection changes or urgent waste concerns, contact your
            barangay through its official channels.
          </Copy>
        </Card>
      </Page>
    );
  return (
    <Page
      title={
        view === "new-report"
          ? "Report a waste concern"
          : view === "history"
            ? "History Reports"
            : "Feature unavailable"
      }
      badge={BADGE}
      back
    >
      <EmptyState
        title={
          view === "new-report"
            ? "Report submission is being connected"
            : view === "history"
              ? "Account scan history is not available yet"
              : "This feature is not connected yet"
        }
        description="This feature is coming soon. You can still view your existing reports and collection information."
      />
      <Button
        secondary
        label="Back to home"
        onPress={() => router.replace("/(tabs)/home")}
      />
    </Page>
  );
}
