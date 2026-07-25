import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Node's built-in `localStorage` global (unusable without --localstorage-file)
 * takes precedence over happy-dom's implementation because vitest's happy-dom
 * bridge only forwards an allow-listed set of window properties and skips any
 * key the host already defines. Swap in a plain in-memory Storage so code
 * under test can use the standard localStorage API unmodified.
 */
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private readonly store = new Map<string, string>();

    get length(): number {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
