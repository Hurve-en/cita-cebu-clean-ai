import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  createOfficerService,
  type OfficerData,
  type OfficerSession,
  type ReportStatus,
  type ScheduleDraft,
} from "./officer-service";
const empty = (): OfficerData => ({ schedules: [], reports: [] });
type Workspace = {
  session: OfficerSession | null;
  data: OfficerData;
  startDemo: () => void;
  endDemo: () => void;
  reload: () => Promise<void>;
  saveSchedule: (id: string | undefined, draft: ScheduleDraft) => Promise<void>;
  archiveSchedule: (id: string) => Promise<void>;
  restoreSchedule: (id: string) => Promise<void>;
  updateReport: (
    id: string,
    status: ReportStatus,
    note: string,
  ) => Promise<void>;
};
const OfficerContext = createContext<Workspace | null>(null);
export function OfficerProvider({ children }: PropsWithChildren) {
  const [service] = useState(createOfficerService);
  const [session, setSession] = useState<OfficerSession | null>(null);
  const [data, setData] = useState<OfficerData>(empty);
  const epoch = useRef(0);
  const startDemo = useCallback(() => {
    epoch.current++;
    const next = service.start();
    setData(next.data);
    setSession(next.session);
  }, [service]);
  const endDemo = useCallback(() => {
    epoch.current++;
    service.end();
    setSession(null);
    setData(empty());
  }, [service]);
  const run = useCallback(async (operation: () => Promise<OfficerData>) => {
    const current = epoch.current;
    const next = await operation();
    if (epoch.current !== current)
      throw new Error("The demo session ended. Open it again to continue.");
    setData(next);
  }, []);
  const reload = useCallback(() => run(() => service.load()), [run, service]);
  const saveSchedule = useCallback(
    (id: string | undefined, draft: ScheduleDraft) =>
      run(() => service.saveSchedule(id, draft)),
    [run, service],
  );
  const archiveSchedule = useCallback(
    (id: string) => run(() => service.archiveSchedule(id)),
    [run, service],
  );
  const restoreSchedule = useCallback(
    (id: string) => run(() => service.restoreSchedule(id)),
    [run, service],
  );
  const updateReport = useCallback(
    (id: string, status: ReportStatus, note: string) =>
      run(() => service.updateReport(id, status, note)),
    [run, service],
  );
  return (
    <OfficerContext.Provider
      value={{
        session,
        data,
        startDemo,
        endDemo,
        reload,
        saveSchedule,
        archiveSchedule,
        restoreSchedule,
        updateReport,
      }}
    >
      {children}
    </OfficerContext.Provider>
  );
}
export function useOfficer() {
  const context = useContext(OfficerContext);
  if (!context) throw new Error("useOfficer requires OfficerProvider");
  return context;
}
