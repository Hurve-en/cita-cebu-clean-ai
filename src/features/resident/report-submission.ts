import { reportRow, uuid, type Report } from "./live-model";

export type ReportDraft = {
  barangay: string;
  category: string;
  title: string;
  location: string;
  description: string;
};
export type PendingReport = {
  version: 1;
  owner: string;
  requestId: string;
  draft: ReportDraft;
};
export type SubmissionResult = { requestId: string; replayed: boolean; report: Report };
export type SubmissionStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
export class SubmissionError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const code = /^[a-z][a-z0-9_]{1,49}$/;
export function categoryCode(value: unknown): string {
  if (typeof value !== "string" || !code.test(value)) throw Error("Choose a report category.");
  return value;
}
export function cleanDraft(draft: ReportDraft): ReportDraft {
  const single = (s: string) => s.replace(/[ \t\r\n\f\v]+/g, " ").trim();
  const result = {
    barangay: uuid(draft.barangay), category: categoryCode(draft.category),
    title: single(draft.title), location: single(draft.location),
    description: draft.description.replace(/\r\n?/g, "\n").replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, ""),
  };
  if (result.title.length < 3 || result.title.length > 120) throw Error("Use a title between 3 and 120 characters.");
  if (result.location.length < 3 || result.location.length > 200) throw Error("Describe the location in 3 to 200 characters.");
  if (result.description.length < 10 || result.description.length > 2000 || !/\S/.test(result.description)) throw Error("Describe the concern in 10 to 2,000 characters.");
  return result;
}
function pendingRow(value: unknown, owner: string): PendingReport {
  const p = value as PendingReport;
  if (!p || p.version !== 1 || p.owner !== owner || !p.draft) throw Error("Invalid pending submission.");
  const requestId = uuid(p.requestId);
  if (requestId === "00000000-0000-0000-0000-000000000000") throw Error("Invalid submission key.");
  return { version: 1, owner, requestId, draft: cleanDraft(p.draft) };
}
export function submissionResult(value: unknown, pending: PendingReport): SubmissionResult {
  const data = value as { request_id: unknown; replayed: unknown; report: unknown };
  if (!data || data.request_id !== pending.requestId || typeof data.replayed !== "boolean") throw Error("Submission confirmation could not be verified.");
  const report = reportRow(data.report, pending.owner);
  const d = pending.draft;
  if (report.original_barangay_id !== d.barangay || report.title !== d.title || report.category_code !== d.category || report.location_text !== d.location || report.description !== d.description) throw Error("Submission confirmation did not match your details.");
  return { requestId: pending.requestId, replayed: data.replayed, report };
}
export const pendingKey = (owner: string) => `cebuclean:report-submission:v1:${uuid(owner)}`;
export type SubmissionState = {
  phase: "editing" | "sending" | "uncertain" | "saved" | "blocked";
  pending: PendingReport | null;
  result: SubmissionResult | null;
  error: string;
};
export function createReportSubmission(options: {
  owner: string;
  storage: SubmissionStorage;
  newKey: () => string;
  send: (pending: PendingReport) => Promise<SubmissionResult>;
  onSaved: (report: Report) => void;
}) {
  const { owner, storage } = options, key = pendingKey(owner);
  let state: SubmissionState = { phase: "editing", pending: null, result: null, error: "" };
  let active = true, running = false;
  const listeners = new Set<() => void>();
  const publish = (next: SubmissionState) => { if (active) { state = next; listeners.forEach(l => l()); } };
  try {
    const raw = storage.getItem(key);
    if (raw !== null) state = { ...state, phase: "uncertain", pending: pendingRow(JSON.parse(raw), owner), error: "A previous submission needs confirmation. Retry with the saved details." };
  } catch {
    state = { ...state, phase: "blocked", error: "The saved submission could not be read. It has been preserved. Contact support before submitting again." };
  }
  function clear() {
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw Error("Could not clear saved submission.");
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    activate() { active = true; },
    dispose() { active = false; listeners.clear(); },
    acknowledge(): boolean {
      if (!active || state.phase !== "saved") return false;
      try { clear(); publish({ phase: "editing", pending: null, result: null, error: "" }); return true; }
      catch { publish({ ...state, error: "Your report is saved, but this device could not clear its retry copy. Try again." }); return false; }
    },
    async submit(draft?: ReportDraft) {
      if (!active || running || state.phase === "saved" || state.phase === "blocked") return;
      running = true;
      let pending = state.pending;
      try {
        if (!pending) {
          if (!draft) throw Error("Add your report details first.");
          pending = pendingRow({ version: 1, owner, requestId: options.newKey(), draft: cleanDraft(draft) }, owner);
          // Persist and read back BEFORE a request can reach the server.
          const raw = JSON.stringify(pending);
          if (storage.getItem(key) !== null) throw Error("Another saved submission exists. Reopen this form to confirm it first.");
          storage.setItem(key, raw);
          if (storage.getItem(key) !== raw) throw Error("This device could not save the retry copy. No report was sent.");
        }
      } catch (e) {
        publish({ ...state, error: e instanceof Error ? e.message : "Could not prepare submission. No report was sent." });
        running = false;
        return;
      }
      publish({ phase: "sending", pending, result: null, error: "" });
      try {
        // Pass a copy: neither a caller nor a service can mutate the retry snapshot.
        const result = await options.send(JSON.parse(JSON.stringify(pending)) as PendingReport);
        if (active) {
          publish({ phase: "saved", pending, result, error: "" });
          // A list refresh failure must not turn a confirmed write into an uncertain one.
          try { options.onSaved(result.report); } catch { /* report is already committed */ }
        }
      } catch (e) {
        if (active) {
          if (e instanceof SubmissionError && e.code === "22023") {
            try {
              clear();
              publish({ phase: "editing", pending: null, result: null, error: "No report was saved. Check your current community, category and details, then submit again." });
            } catch {
              publish({ phase: "uncertain", pending, result: null, error: "The server rejected this submission, but its retry copy could not be cleared. Retry after device storage is available." });
            }
          } else {
            publish({ phase: "uncertain", pending, result: null, error:
              e instanceof SubmissionError && e.code === "23505"
                ? "This submission key has different saved details. Check My reports and contact support before trying again."
                : e instanceof SubmissionError && e.code === "42501"
                  ? "Your account could not submit. Check account access, then return to confirm this saved submission."
                  : "We could not confirm whether your report was saved. Retry these same details to check safely." });
          }
        }
      } finally { running = false; }
    },
  };
}
