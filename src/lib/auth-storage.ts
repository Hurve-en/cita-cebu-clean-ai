export const authStorage = {
  getItem(key: string): string | null {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  },

  removeItem(key: string): void {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  },
};
