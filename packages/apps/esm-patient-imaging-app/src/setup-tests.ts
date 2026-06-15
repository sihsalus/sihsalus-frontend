import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

const testGlobal = globalThis as typeof globalThis & {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
  ResizeObserver?: typeof ResizeObserver;
};

if (!testGlobal.TextEncoder) {
  testGlobal.TextEncoder = TextEncoder;
}
if (!testGlobal.TextDecoder) {
  testGlobal.TextDecoder = TextDecoder;
}

// Polyfill ResizeObserver
class ResizeObserver {
  observe() {
    // Test environment no-op.
  }
  unobserve() {
    // Test environment no-op.
  }
  disconnect() {
    // Test environment no-op.
  }
}

if (!testGlobal.ResizeObserver) {
  testGlobal.ResizeObserver = ResizeObserver;
}
