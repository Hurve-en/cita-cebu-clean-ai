import Storage from 'expo-sqlite/kv-store';
export const rewardsStorage = { getItem: (k: string) => Storage.getItemSync(k), setItem: (k: string, v: string) => Storage.setItemSync(k, v), removeItem: (k: string) => Storage.removeItemSync(k) };
