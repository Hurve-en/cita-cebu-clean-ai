import type { LocalRecordsAdapter } from "./resident-model";
export function savedPhotoUri(_fileName: string): string {
  return "";
}
export const localRecords: LocalRecordsAdapter = {
  read: (key) =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  write: (key, value) => {
    window.localStorage.setItem(key, value);
  },
  savePhoto: async () => {
    throw new Error(
      "Persistent photo saving requires the iOS or Android app. Web photo storage is not connected.",
    );
  },
  deletePhoto: () => {},
};
