import type { ResidentReadService } from "./live-service";
import {
  mergeRows,
  type Barangay,
  type Profile,
  type Report,
  type ReportEvent,
  type Schedule,
} from "./live-model";
export type Resource<T> = {
  value: T;
  loading: boolean;
  error: string;
  loaded: boolean;
};
export type Paged<T> = Resource<T[]> & { more: boolean };
const resource = <T>(value: T): Resource<T> => ({
  value,
  loading: false,
  error: "",
  loaded: false,
});
const paged = <T>(): Paged<T> => ({ ...resource<T[]>([]), more: false });
export const emptyLiveState = () => ({
  owner: null as string | null,
  profile: resource<Profile | null>(null),
  barangays: paged<Barangay>(),
  schedules: paged<Schedule>(),
  reports: paged<Report>(),
  detail: {
    id: null as string | null,
    report: resource<Report | null>(null),
    events: paged<ReportEvent>(),
  },
  saving: false,
  saveError: "",
  notice: "",
});
export type LiveState = ReturnType<typeof emptyLiveState>;
export function createResidentReadStore(service: ResidentReadService | null) {
  let state = emptyLiveState(),
    epoch = 0,
    scheduleEpoch = 0,
    profileEpoch = 0,
    detailEpoch = 0,
    saveBusy = false;
  const listeners = new Set<() => void>();
  const publish = (next: LiveState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const patch = (part: Partial<LiveState>) => publish({ ...state, ...part });
  const fail = (e: unknown) =>
    e instanceof Error ? e.message : "Could not load account data. Retry.";
  function clear() {
    ++epoch;
    ++scheduleEpoch;
    ++profileEpoch;
    ++detailEpoch;
    saveBusy = false;
    publish(emptyLiveState());
  }
  async function loadProfile() {
    if (!state.owner || !service || state.profile.loading || state.saving)
      return;
    const expected = epoch,
      user = state.owner,
      request = ++profileEpoch;
    ++scheduleEpoch;
    patch({
      profile: { ...state.profile, loading: true, error: "" },
      schedules: paged<Schedule>(),
    });
    try {
      const value = await service.profile(user);
      if (expected !== epoch || request !== profileEpoch) return;
      const changed =
        state.profile.value?.resident_barangay_id !==
        value.resident_barangay_id;
      if (changed) ++scheduleEpoch;
      patch({
        profile: { value, loading: false, error: "", loaded: true },
        ...(changed ? { schedules: paged<Schedule>() } : {}),
      });
      if (changed || !state.schedules.loaded) void loadSchedules();
    } catch (e) {
      if (expected === epoch && request === profileEpoch) {
        ++scheduleEpoch;
        patch({
          profile: {
            ...resource<Profile | null>(null),
            loaded: true,
            error: fail(e),
          },
          schedules: paged<Schedule>(),
        });
      }
    }
  }
  async function loadList<K extends "barangays" | "reports" | "schedules">(
    key: K,
    more = false,
  ) {
    if (!state.owner || !service || state[key].loading) return;
    const user = state.owner,
      expected = epoch,
      community = scheduleEpoch;
    const previous = state[key];
    if (more && !previous.more) return;
    const barangay = state.profile.value?.resident_barangay_id;
    if (key === "schedules" && state.profile.loading) return;
    if (key === "schedules" && !barangay) {
      patch({ schedules: { ...paged<Schedule>(), loaded: true } });
      return;
    }
    if (!more && key === "schedules") ++scheduleEpoch;
    const expectedCommunity = key === "schedules" ? scheduleEpoch : community;
    patch({
      [key]: {
        ...previous,
        ...(!more ? { value: [], more: false } : {}),
        loading: true,
        error: "",
      },
    });
    try {
      const last = more ? previous.value.at(-1) : undefined;
      const result =
        key === "barangays"
          ? await service.barangays(last?.id)
          : key === "reports"
            ? await service.reports(user, last as Report | undefined)
            : await service.schedules(barangay!, last as Schedule | undefined);
      if (
        expected !== epoch ||
        (key === "schedules" && expectedCommunity !== scheduleEpoch)
      )
        return;
      const rows = more
        ? mergeRows(previous.value as { id: string }[], result.rows)
        : result.rows;
      patch({
        [key]: {
          value: rows,
          more: result.more,
          loaded: true,
          loading: false,
          error: "",
        },
      });
    } catch (e) {
      if (
        expected === epoch &&
        (key !== "schedules" || expectedCommunity === scheduleEpoch)
      )
        patch({
          [key]: {
            ...state[key],
            loading: false,
            loaded: true,
            error: fail(e),
          },
        });
    }
  }
  const loadSchedules = (more = false) => loadList("schedules", more);
  async function openReport(id: string) {
    if (!state.owner || !service) return;
    const user = state.owner,
      expected = epoch,
      current = ++detailEpoch;
    patch({
      detail: {
        id,
        report: { ...resource<Report | null>(null), loading: true },
        events: paged<ReportEvent>(),
      },
    });
    try {
      const value = await service.report(user, id);
      if (expected !== epoch || current !== detailEpoch) return;
      patch({
        detail: {
          ...state.detail,
          report: { value, loading: false, loaded: true, error: "" },
        },
      });
      if (value) void loadEvents();
    } catch (e) {
      if (expected === epoch && current === detailEpoch)
        patch({
          detail: {
            ...state.detail,
            report: {
              ...resource<Report | null>(null),
              loaded: true,
              error: fail(e),
            },
          },
        });
    }
  }
  async function loadEvents(more = false) {
    if (
      !state.owner ||
      !service ||
      !state.detail.report.value ||
      state.detail.events.loading
    )
      return;
    const expected = epoch,
      current = detailEpoch,
      id = state.detail.id!,
      previous = state.detail.events;
    if (more && !previous.more) return;
    patch({
      detail: {
        ...state.detail,
        events: {
          ...previous,
          ...(!more ? { value: [], more: false } : {}),
          loading: true,
          error: "",
        },
      },
    });
    try {
      const result = await service.events(
        id,
        more ? previous.value.at(-1) : undefined,
      );
      if (expected !== epoch || current !== detailEpoch) return;
      patch({
        detail: {
          ...state.detail,
          events: {
            value: more ? mergeRows(previous.value, result.rows) : result.rows,
            more: result.more,
            loaded: true,
            loading: false,
            error: "",
          },
        },
      });
    } catch (e) {
      if (expected === epoch && current === detailEpoch)
        patch({
          detail: {
            ...state.detail,
            events: {
              ...state.detail.events,
              loading: false,
              loaded: true,
              error: fail(e),
            },
          },
        });
    }
  }
  async function saveProfile(name: string, barangay: string | null) {
    if (saveBusy) return;
    if (!service || !state.owner || !state.profile.value)
      throw Error("Reload your account details before saving.");
    const expected = epoch,
      user = state.owner,
      current = state.profile.value;
    saveBusy = true;
    ++profileEpoch;
    patch({
      saving: true,
      profile: { ...state.profile, loading: false },
      saveError: "",
      notice: "",
    });
    try {
      const value = await service.updateProfile(user, current, name, barangay);
      if (expected !== epoch) return;
      const changed =
        current.resident_barangay_id !== value.resident_barangay_id;
      if (changed) ++scheduleEpoch;
      patch({
        profile: {
          value: {
            ...value,
            barangay_name:
              state.barangays.value.find(
                (b) => b.id === value.resident_barangay_id,
              )?.name ?? (changed ? null : current.barangay_name),
          },
          loaded: true,
          loading: false,
          error: "",
        },
        notice: "Account details saved.",
        ...(changed ? { schedules: paged<Schedule>() } : {}),
      });
      if (changed || !state.schedules.loaded) void loadSchedules();
    } catch (e) {
      if (expected === epoch) patch({ saveError: fail(e) });
    } finally {
      if (expected === epoch) {
        saveBusy = false;
        patch({ saving: false });
      }
    }
  }
  function activate(user: string | null) {
    clear();
    if (!user || !service) return;
    patch({ owner: user });
    void loadProfile();
    void loadList("barangays");
    void loadList("reports");
  }
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    activate,
    clear,
    reloadProfile: loadProfile,
    loadBarangays: (more = false) => loadList("barangays", more),
    loadSchedules,
    loadReports: (more = false) => loadList("reports", more),
    openReport,
    closeReport: () => {
      ++detailEpoch;
      patch({ detail: emptyLiveState().detail });
    },
    loadEvents,
    saveProfile,
  };
}
