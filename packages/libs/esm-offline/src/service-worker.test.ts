import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerOmrsServiceWorker } from './service-worker';

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(),
}));

describe('registerOmrsServiceWorker', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as typeof globalThis & { i18next?: unknown }).i18next;
  });

  it('throws a translated actionable message when service workers are not available', () => {
    (globalThis as typeof globalThis & { i18next?: { t: ReturnType<typeof vi.fn> } }).i18next = {
      t: vi.fn((_key, options) => `translated: ${options.defaultValue}`),
    };

    expect(() => registerOmrsServiceWorker('/openmrs/spa/service-worker.js')).toThrow(
      /translated: Offline setup unavailable. Offline mode could not be enabled because this browser or browsing context does not allow Service Workers/,
    );
  });

  it('falls back to the default actionable message when i18n is not initialized', () => {
    expect(() => registerOmrsServiceWorker('/openmrs/spa/service-worker.js')).toThrow(
      /Offline setup unavailable. Offline mode could not be enabled because this browser or browsing context does not allow Service Workers/,
    );
  });
});
