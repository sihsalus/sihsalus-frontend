import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  test: {
    setupFiles: ['./setup-tests.ts'],
  },
});
