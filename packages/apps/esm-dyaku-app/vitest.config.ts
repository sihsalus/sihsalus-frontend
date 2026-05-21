import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  aliases: {
    '@openmrs/esm-framework': './test-mocks/esm-framework.ts',
  },
});
