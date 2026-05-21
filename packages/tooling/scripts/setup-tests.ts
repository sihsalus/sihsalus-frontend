import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Use the global `vi` (provided by test runner) instead of importing from 'vitest'
// so TypeScript doesn't need to resolve the module during `tsc` checks.
const vi: any = (globalThis as any).vi ?? (global as any).vi ?? { fn: () => {}, mocked: (x: any) => x, mock: () => {} };

vi.mock?.('single-spa', () => ({
  navigateToUrl: vi.fn?.(),
}));

declare global {
  interface Window {
    openmrsBase: string;
    spaBase: string;
    getOpenmrsSpaBase(): string;
  }
}

window.openmrsBase = '/openmrs';
window.spaBase = '/spa';
window.getOpenmrsSpaBase = () => '/openmrs/spa/';

// Ensure i18next locale is available for components that call getLocale()
// (e.g. Carbon DatePicker via @openmrs/esm-styleguide) before the framework mock loads.
(globalThis as any).i18next = { ...(globalThis as any).i18next, language: 'en' } as unknown;
globalThis.TextEncoder = globalThis.TextEncoder ?? TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder ?? TextDecoder;
window.URL.createObjectURL = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const _ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(global as any).ResizeObserver = _ResizeObserver;
(window as any).ResizeObserver = _ResizeObserver;

const _IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
(global as any).IntersectionObserver = _IntersectionObserver;
(window as any).IntersectionObserver = _IntersectionObserver;

const isLocalBackendUrl = (input: unknown): boolean => {
  try {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as { url?: string })?.url;
    return (
      typeof url === 'string' &&
      (url.startsWith('/openmrs') ||
        url.includes('http://localhost:3000') ||
        url.includes('https://localhost:3000') ||
        url.includes('http://127.0.0.1:3000') ||
        url.includes('https://127.0.0.1:3000'))
    );
  } catch {
    return false;
  }
};

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = vi.fn(async (...args: Parameters<typeof fetch>) => {
    if (isLocalBackendUrl(args[0])) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(...args);
  }) as typeof fetch;
}
