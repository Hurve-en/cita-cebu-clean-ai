import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { createResidentStore } from "./resident-store";
import { localRecords } from "./local-records";
export { REWARDS } from "./resident-model";
export type {
  ResidentProfile,
  WasteReport,
  ScanRecord,
} from "./resident-model";
const ResidentContext = createContext<ReturnType<
  typeof createResidentStore
> | null>(null);
export function ResidentProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createResidentStore(localRecords));
  return (
    <ResidentContext.Provider value={store}>
      {children}
    </ResidentContext.Provider>
  );
}
export function useResident() {
  const store = useContext(ResidentContext);
  if (!store) throw new Error("useResident must be inside ResidentProvider");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return {
    state,
    dispatch: store.dispatch,
    saveScan: store.saveScan,
    saveReport: store.saveReport,
    removeScan: store.removeScan,
    removeReport: store.removeReport,
  };
}
