import type {
  HistoryCursor,
  HistoryFilter,
  HistoryPage,
} from "./history-model";
export function createHistoryStore(
  load: (filter: HistoryFilter, cursor?: HistoryCursor) => Promise<HistoryPage>,
) {
  let state = {
      items: [] as HistoryPage["items"],
      filter: "all" as HistoryFilter,
      loading: false,
      error: "",
      page: 1,
      more: false,
    },
    cursor: HistoryCursor | undefined,
    next: HistoryCursor | null = null;
  let previous: (HistoryCursor | undefined)[] = [],
    generation = 0,
    disposed = false;
  const listeners = new Set<() => void>();
  function update(p: Partial<typeof state>) {
    state = { ...state, ...p };
    listeners.forEach((f) => f());
  }
  async function read(
    filter: HistoryFilter,
    c: HistoryCursor | undefined,
    stack: (HistoryCursor | undefined)[],
  ) {
    const n = ++generation;
    update({ loading: true, error: "" });
    try {
      const p = await load(filter, c);
      if (disposed || n !== generation) return;
      cursor = c;
      previous = stack;
      next = p.next_cursor;
      update({ items: p.items, filter, more: p.more, page: stack.length + 1 });
    } catch (e) {
      if (!disposed && n === generation)
        update({
          error:
            e instanceof Error ? e.message : "History could not be loaded.",
        });
    } finally {
      if (!disposed && n === generation) update({ loading: false });
    }
  }
  return {
    subscribe(f: () => void) {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    getSnapshot: () => state,
    activate() {
      disposed = false;
      void read("all", undefined, []);
    },
    dispose() {
      disposed = true;
      ++generation;
      listeners.clear();
    },
    refresh: () => read(state.filter, cursor, previous),
    filter: (f: HistoryFilter) => read(f, undefined, []),
    older: () =>
      state.loading || !next
        ? Promise.resolve()
        : read(state.filter, next, [...previous, cursor]),
    newer: () =>
      state.loading || !previous.length
        ? Promise.resolve()
        : read(state.filter, previous.at(-1), previous.slice(0, -1)),
  };
}
