import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { ImportMapOverridesApi } from './src/devtools/import-map-overrides.types';

// Node.js v25+ provides a broken native localStorage (missing methods unless --localstorage-file is set).
// This shadows happy-dom's working implementation, so we restore a complete in-memory shim.
if (typeof localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
    },
    writable: true,
    configurable: true,
  });
}

const emptyMap = { imports: {} };

window.importMapOverrides = {
  getOverrideMap: vi.fn().mockReturnValue(emptyMap),
  getNextPageMap: vi.fn().mockResolvedValue(emptyMap),
  getCurrentPageMap: vi.fn().mockResolvedValue(emptyMap),
  getDefaultMap: vi.fn().mockResolvedValue(emptyMap),
  getDisabledOverrides: vi.fn().mockReturnValue([]),
  isDisabled: vi.fn().mockReturnValue(false),
  enableOverride: vi.fn(),
  addOverride: vi.fn(),
  removeOverride: vi.fn(),
  resetOverrides: vi.fn(),
} as unknown as ImportMapOverridesApi;

afterEach(cleanup);

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(),
}));
