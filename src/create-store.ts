import { NAME } from "./metadata.ts";
import type { Store } from "./types.ts";

export const createStore = <T>(key: string): Store<T> => {
  const _key = NAME + ":" + key;
  const _localStorage = localStorage;
  return {
    get: () => {
      const text = _localStorage.getItem(_key);
      return text ? JSON.parse(text) as T : null;
    },
    set: (value) => {
      value
        ? _localStorage.setItem(_key, JSON.stringify(value))
        : _localStorage.removeItem(_key);
    },
  };
};
