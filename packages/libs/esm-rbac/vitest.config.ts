import { fileURLToPath } from 'node:url';
import { defineWorkspaceVitestConfig } from '../../tooling/configs/vitest-config';

export default defineWorkspaceVitestConfig({
  resolve: {
    alias: [
      {
        find: /^\.\/useRequirePrivilege$/,
        replacement: fileURLToPath(new URL('./src/useRequirePrivilege.ts', import.meta.url)),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        branches: 80,
      },
    },
  },
});
