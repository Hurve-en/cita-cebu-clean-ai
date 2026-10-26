export type ResidentProfile = { name: string; email: string; barangay: string };
export type WasteReport = {
  id: string;
  title: string;
  location: string;
  description: string;
  status: "Pending review" | "Resolved";
  createdAt: string;
  photoFile?: string;
};
export type ScanRecord = {
  id: string;
  label: string;
  createdAt: string;
  photoFile: string;
};
export type ReportDraft = {
  title: string;
  location: string;
  description: string;
  photoUri?: string;
};
export type ScanDraft = { id: string; label: string; photoUri: string };
export type SavedRecords = {
  version: 1;
  reports: WasteReport[];
  scans: ScanRecord[];
};
export type State = {
  profile: ResidentProfile | null;
  points: number;
  reports: WasteReport[];
  scans: ScanRecord[];
  redemptions: { id: string; reward: string; cost: number }[];
  reminders: boolean;
  storageError: string;
};
export type Action =
  | { type: "enter"; profile: ResidentProfile }
  | { type: "logout" }
  | { type: "profile"; profile: ResidentProfile }
  | { type: "report"; report: WasteReport }
  | { type: "redeem"; rewardId: string }
  | { type: "reminders"; enabled: boolean };
export const REWARDS = [
  {
    id: "tote",
    name: "Reusable tote bag",
    cost: 150,
    description: "A reusable bag for everyday errands.",
  },
  {
    id: "bottle",
    name: "Reusable water bottle",
    cost: 300,
    description: "Carry water and reduce single-use bottles.",
  },
  {
    id: "kit",
    name: "Recycling starter kit",
    cost: 500,
    description: "A small kit to help organize household recyclables.",
  },
] as const;
export const MATERIAL_NAMES: Record<string, string> = {
  glass: "Glass",
  metal: "Metal",
  "non-recyclable": "Non-recyclable",
  organic: "Organic",
  paper: "Paper",
  plastic: "Plastic",
};
export const emptyState = (): State => ({
  profile: null,
  points: 350,
  reports: [],
  scans: [],
  redemptions: [],
  reminders: false,
  storageError: "",
});
let sequence = 0;
export function newRecordId() {
  return `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export interface LocalRecordsAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  savePhoto(uri: string): Promise<string>;
  deletePhoto(fileName: string): void;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const date = (v: unknown): v is string =>
  text(v) && Number.isFinite(Date.parse(v));
export const validPhotoName = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z0-9-]+\.jpg$/.test(v);
export function decodeRecords(raw: string | null): SavedRecords {
  if (raw === null) return { version: 1, reports: [], scans: [] };
  const data: unknown = JSON.parse(raw);
  if (
    !object(data) ||
    data.version !== 1 ||
    !Array.isArray(data.reports) ||
    !Array.isArray(data.scans) ||
    data.reports.length > 100 ||
    data.scans.length > 100
  )
    throw new Error("Unsupported local records.");
  for (const report of data.reports) {
    if (
      !object(report) ||
      !text(report.id) ||
      !text(report.title) ||
      !text(report.location) ||
      !text(report.description) ||
      !date(report.createdAt) ||
      !["Pending review", "Resolved"].includes(String(report.status)) ||
      (report.photoFile !== undefined && !validPhotoName(report.photoFile))
    )
      throw new Error("Invalid saved report.");
  }
  for (const scan of data.scans) {
    if (
      !object(scan) ||
      !text(scan.id) ||
      !text(scan.label) ||
      !Object.hasOwn(MATERIAL_NAMES, scan.label) ||
      !date(scan.createdAt) ||
      !validPhotoName(scan.photoFile)
    )
      throw new Error("Invalid saved scan.");
  }
  // Entries have been validated above; no arbitrary file paths are accepted.
  return data as unknown as SavedRecords;
}
