import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Text, View } from "react-native";
import { uuid } from "expo";
import { router } from "expo-router";
import { useAuth } from "@/features/auth/auth-state";
import { authStorage } from "@/lib/auth-storage";
import { useLiveResident } from "./live-state";
import { statusLabel } from "./live-model";
import { createReportSubmission } from "./report-submission";
import { createReportSubmissionService, type ReportCategory } from "./report-submission-service";
import { Button, Card, Copy, Field, Heading, Message, Page, Section, ui } from "./resident-ui";

export function ReportSubmission() {
  const { client, state: auth } = useAuth();
  const { state: live, actions } = useLiveResident();
  const owner = auth.user!.id;
  const service = useMemo(() => createReportSubmissionService(client!), [client]);
  const controller = useMemo(() => createReportSubmission({
    owner, storage: authStorage, newKey: () => uuid.v4(), send: service.send,
    onSaved: () => { if (actions.getSnapshot().owner === owner) void actions.loadReports(); },
  }), [owner, service, actions]);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [initial] = useState(() => controller.getSnapshot().pending?.draft);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true), [more, setMore] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [attempt, setAttempt] = useState(0), [cursor, setCursor] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    void service.categories(cursor).then(page => {
      if (!active) return;
      setCategories(old => cursor ? [...old, ...page.rows.filter(row => !old.some(c => c.code === row.code))] : page.rows);
      setMore(page.more);
    }).catch(e => { if (active) setCategoryError(e instanceof Error ? e.message : "Could not load categories."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [service, cursor, attempt]);
  const locked = state.phase !== "editing";
  const pending = state.pending?.draft;
  const barangay = pending?.barangay ?? live.profile.value?.resident_barangay_id;
  const community = live.barangays.value.find(b => b.id === barangay)?.name
    ?? (live.profile.value?.resident_barangay_id === barangay ? live.profile.value?.barangay_name : null)
    ?? "Previously selected community";
  const newReady = Boolean(barangay && live.profile.value && categories.some(c => c.code === category));
  function goReport() {
    const id = state.result?.report.id;
    if (id && controller.acknowledge()) router.replace({ pathname: "/detail", params: { view: "report", id } });
  }
  return (
    <Page title={state.phase === "saved" ? "Report submitted" : "Report a waste concern"}
      subtitle="Help your community understand what needs attention." badge="Resident account" back>
      {state.phase === "saved" ? (
        <>
          <Card>
            <Text style={ui.badge}>{state.result ? statusLabel(state.result.report.status) : "Saved"}</Text>
            <Heading>{state.result?.report.title}</Heading>
            <Copy>Your report is saved to your account. You can follow its status in My reports.</Copy>
            <Copy>Submission does not confirm a collection visit or response time. Contact your barangay for urgent concerns.</Copy>
          </Card>
          <Message error text={state.error} />
          <Button label="View submitted report" onPress={goReport} />
        </>
      ) : (
        <>
          <Card>
            <Heading>{barangay ? community : "Choose your community first"}</Heading>
            <Copy>This report goes to the barangay selected in your account. Reports keep their original community if you change it later.</Copy>
            {!locked && <Button secondary label={barangay ? "Change community" : "Choose barangay"}
              onPress={() => router.push({ pathname: "/detail", params: { view: "barangay" } })} />}
          </Card>
          {live.profile.error && <Message error text={live.profile.error} />}
          {!live.profile.value && <Button secondary label="Reload account details" onPress={() => { void actions.reloadProfile(); }} />}
          {locked && <Message text="These details are saved on this device for a safe retry. Confirm this submission before starting another report." />}
          <Section title="What happened?" />
          <Field label="Report title" placeholder="For example: Waste beside the footbridge"
            value={pending?.title ?? title} onChangeText={setTitle} editable={!locked} maxLength={120} />
          <Heading>Category</Heading>
          {locked ? <Copy>{categories.find(c => c.code === pending?.category)?.label ?? pending?.category ?? "Unavailable"}</Copy> : (
            <>
              {loading && <Copy>Loading categories…</Copy>}
              <Message error text={categoryError} />
              {categories.map(c => <Button key={c.code} secondary
                label={`${category === c.code ? "Selected: " : ""}${c.label}`} onPress={() => setCategory(c.code)} />)}
              {!loading && !categoryError && !categories.length && <Copy>No report categories are configured yet. Contact the project administrator.</Copy>}
              {more && <Button secondary disabled={loading} label="More categories" onPress={() => { setLoading(true); setCategoryError(""); setCursor(categories.at(-1)?.code); }} />}
              <Button secondary disabled={loading} label="Refresh categories" onPress={() => { setLoading(true); setCategoryError(""); setCursor(undefined); setAttempt(a => a + 1); }} />
            </>
          )}
          <Field label="Location or landmark" placeholder="Street, nearby landmark and specific area"
            value={pending?.location ?? location} onChangeText={setLocation} editable={!locked} maxLength={200} />
          <Field label="Description" placeholder="Describe the waste concern and what you observed."
            value={pending?.description ?? description} onChangeText={setDescription} editable={!locked}
            multiline maxLength={2000} style={{ minHeight: 140, textAlignVertical: "top" }} />
          <Copy>{(pending?.description ?? description).length.toLocaleString()} / 2,000 characters · At least 10 characters</Copy>
          <View><Copy>Photo attachments are not available yet. Avoid including private information about other people.</Copy></View>
          <Message error text={state.error} />
          <Button disabled={state.phase === "sending" || state.phase === "blocked" || (!locked && !newReady)}
            label={state.phase === "sending" ? "Confirming submission…" : state.phase === "uncertain" ? "Retry / confirm saved submission" : "Submit report"}
            onPress={() => { void controller.submit(locked ? undefined : { barangay: barangay!, title, category, location, description }); }} />
          <Button secondary disabled={state.phase === "sending"} label="My reports"
            onPress={() => router.push({ pathname: "/detail", params: { view: "reports" } })} />
          <Copy>After you submit, a retry copy of the report text stays on this device until you confirm success. An interrupted submission can be resumed from this form.</Copy>
        </>
      )}
    </Page>
  );
}
