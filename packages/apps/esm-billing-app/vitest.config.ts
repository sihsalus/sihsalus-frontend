import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  aliases: {
    'mocks/*': 'test-utils/mocks/*',
  },
});
