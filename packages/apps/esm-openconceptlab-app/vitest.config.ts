import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  aliases: {
    '@mocks/*': '../../test-utils/mocks/*',
    '@tools/test-helpers': '../../test-utils/index.tsx',
  },
});
