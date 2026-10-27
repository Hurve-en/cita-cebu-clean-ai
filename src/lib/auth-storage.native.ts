import "expo-sqlite/localStorage/install";
// Expo's SQLite-backed native localStorage; never shared with demo record keys.
export const authStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};
