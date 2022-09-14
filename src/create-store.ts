import { Store } from "./types";

export const createStore = <Value>(key: string): Store<Value> => {
  const prefixedKey = `OCTOKIT:AUTH_OAUTH_USER_CLIENT:${key}`;
  return {
    get: async () => {
      const text = localStorage.getItem(prefixedKey);
      return text == null ? null : JSON.parse(text);
    },
    set: async (value = null) => {
      value == null
        ? localStorage.removeItem(prefixedKey)
        : localStorage.setItem(prefixedKey, JSON.stringify(value));
    },
  };
};
