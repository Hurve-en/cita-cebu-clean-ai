import {
  decodeRecords,
  emptyState,
  MATERIAL_NAMES,
  newRecordId,
  REWARDS,
  type Action,
  type LocalRecordsAdapter,
  type ReportDraft,
  type ScanDraft,
  type State,
} from "./resident-model";
const keyFor = (email: string) =>
  `cebuclean:resident-records:v1:${encodeURIComponent(email.trim().toLowerCase())}`;
export function createResidentStore(storage: LocalRecordsAdapter) {
  let state = emptyState();
  let session = 0;
  const listeners = new Set<() => void>();
  const update = (next: State) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  function commit(next: State) {
    if (!state.profile || !next.profile)
      throw new Error("Sign in before saving records.");
    if (state.storageError) throw new Error(state.storageError);
    // Write first: failed disk writes never appear as a successful save in the UI.
    storage.write(
      keyFor(state.profile.email),
      JSON.stringify({ version: 1, reports: next.reports, scans: next.scans }),
    );
    update(next);
  }
  function clean(fileName?: string) {
    if (!fileName) return;
    try {
      storage.deletePhoto(fileName);
    } catch (error) {
      console.warn("Local photo cleanup failed:", error);
    }
  }
  function assertSession(expected: number) {
    if (!state.profile || session !== expected)
      throw new Error("The session changed. Sign in and try again.");
  }
  function dispatch(action: Action): void {
    switch (action.type) {
      case "enter": {
        session++;
        const profile = {
          ...action.profile,
          email: action.profile.email.trim().toLowerCase(),
        };
        try {
          const records = decodeRecords(storage.read(keyFor(profile.email)));
          update({
            ...emptyState(),
            profile,
            reports: records.reports,
            scans: records.scans,
          });
        } catch {
          update({
            ...emptyState(),
            profile,
            storageError:
              "Saved records could not be loaded. Saving is paused to protect existing data. Restart the app and sign in again.",
          });
        }
        return;
      }
      case "logout":
        session++;
        update(emptyState());
        return;
      case "profile":
        if (!state.profile || action.profile.email !== state.profile.email)
          return;
        update({ ...state, profile: action.profile });
        return;
      case "report":
        try {
          commit({ ...state, reports: [action.report, ...state.reports] });
          return;
        } catch {
          return;
        }
      case "reminders":
        update({ ...state, reminders: action.enabled });
        return;
      case "redeem": {
        const reward = REWARDS.find((item) => item.id === action.rewardId);
        if (!state.profile || !reward || state.points < reward.cost) return;
        update({
          ...state,
          points: state.points - reward.cost,
          redemptions: [
            { id: newRecordId(), reward: reward.name, cost: reward.cost },
            ...state.redemptions,
          ],
        });
        return;
      }
    }
  }
  async function saveScan(input: ScanDraft) {
    const expected = session;
    assertSession(expected);
    if (!Object.hasOwn(MATERIAL_NAMES, input.label))
      throw new Error("This material label is not supported.");
    const previous = state.scans.find((item) => item.id === input.id);
    if (!previous && state.scans.length >= 100)
      throw new Error(
        "History is full. Delete an old scan before saving another.",
      );
    let created: string | undefined;
    try {
      const photoFile =
        previous?.photoFile ??
        (created = await storage.savePhoto(input.photoUri));
      assertSession(expected);
      // Re-read state after async photo work to avoid overwriting concurrent changes.
      if (
        !state.scans.some((item) => item.id === input.id) &&
        state.scans.length >= 100
      )
        throw new Error("History is full. Delete an old scan first.");
      const latest = state.scans.find((item) => item.id === input.id);
      if (created && latest) {
        clean(created);
        created = undefined;
      }
      const record = {
        id: input.id,
        label: input.label,
        photoFile: latest?.photoFile ?? photoFile,
        createdAt:
          latest?.createdAt ?? previous?.createdAt ?? new Date().toISOString(),
      };
      commit({
        ...state,
        scans: [record, ...state.scans.filter((item) => item.id !== input.id)],
      });
    } catch (error) {
      clean(created);
      throw error;
    }
  }
  async function saveReport(input: ReportDraft) {
    const expected = session;
    assertSession(expected);
    if (
      !input.title.trim() ||
      !input.location.trim() ||
      input.description.trim().length < 10
    )
      throw new Error(
        "Add a title, location, and description of at least 10 characters.",
      );
    if (state.reports.length >= 100)
      throw new Error("Report storage is full. Delete an old report first.");
    let photoFile: string | undefined;
    try {
      if (input.photoUri) photoFile = await storage.savePhoto(input.photoUri);
      assertSession(expected);
      if (state.reports.length >= 100)
        throw new Error("Report storage is full. Delete an old report first.");
      const report = {
        id: newRecordId(),
        title: input.title.trim(),
        location: input.location.trim(),
        description: input.description.trim(),
        status: "Pending review" as const,
        createdAt: new Date().toISOString(),
        ...(photoFile ? { photoFile } : {}),
      };
      commit({ ...state, reports: [report, ...state.reports] });
    } catch (error) {
      clean(photoFile);
      throw error;
    }
  }
  function removeScan(id: string) {
    const record = state.scans.find((item) => item.id === id);
    commit({ ...state, scans: state.scans.filter((item) => item.id !== id) });
    clean(record?.photoFile);
  }
  function removeReport(id: string) {
    const record = state.reports.find((item) => item.id === id);
    commit({
      ...state,
      reports: state.reports.filter((item) => item.id !== id),
    });
    clean(record?.photoFile);
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch,
    saveScan,
    saveReport,
    removeScan,
    removeReport,
  };
}
