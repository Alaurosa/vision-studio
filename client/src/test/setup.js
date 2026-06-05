import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

/**
 * Node may expose a broken `localStorage` when `--localstorage-file` has no valid path.
 * Zustand persist and projectCompat need a full Storage API in jsdom tests.
 */
function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

const memoryStorage = createMemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
  writable: true,
});

beforeEach(() => {
  memoryStorage.clear();
});
