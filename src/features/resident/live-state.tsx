import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/features/auth/auth-state";
import { createResidentReadService } from "./live-service";
import { createResidentReadStore, emptyLiveState } from "./live-store";
const Context = createContext<ReturnType<
  typeof createResidentReadStore
> | null>(null);
const EMPTY = emptyLiveState();
export function LiveResidentProvider({ children }: PropsWithChildren) {
  const { client, state } = useAuth();
  const store = useMemo(
    () =>
      createResidentReadStore(
        client ? createResidentReadService(client) : null,
      ),
    [client],
  );
  const id =
    state.phase === "ready" &&
    state.access?.eligible &&
    state.access.product_role === "resident"
      ? (state.user?.id ?? null)
      : null;
  useEffect(() => {
    store.activate(id);
    return () => store.clear();
  }, [store, id, state.access?.access_version]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useLiveResident() {
  const { state: auth } = useAuth();
  const store = useContext(Context);
  if (!store) throw Error("useLiveResident requires LiveResidentProvider");
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => EMPTY,
  );
  const enabled =
    auth.phase === "ready" &&
    auth.access?.eligible === true &&
    auth.access.product_role === "resident" &&
    Boolean(auth.user);
  // Synchronously hide every previous identity's data, before effects can run.
  const state = enabled && snapshot.owner === auth.user?.id ? snapshot : EMPTY;
  return { enabled, state, actions: store };
}
