export const rewardsStorage = {
    getItem: (key: string) => { if (typeof localStorage === 'undefined')
        throw Error('Local retry storage unavailable.'); return localStorage.getItem(key); },
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
    removeItem: (key: string) => localStorage.removeItem(key),
};
