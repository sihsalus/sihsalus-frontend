import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  aliases: {
    __mocks__: '../../test-utils/mocks',
  },
});
