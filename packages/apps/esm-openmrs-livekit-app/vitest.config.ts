import { defineWorkspaceVitestConfig } from '../../tooling/configs/vitest-config';

export default defineWorkspaceVitestConfig({
  test: {
    environment: 'happy-dom',
  },
});
