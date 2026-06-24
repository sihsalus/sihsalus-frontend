import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@openmrs/esm-styleguide/src/internal': fileURLToPath(new URL('./src/internal.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        url: 'http://localhost/',
      },
      jsdom: {
        url: 'http://localhost/',
      },
    },
    mockReset: true,
    setupFiles: ['./setup-tests.ts'],
  },
});
