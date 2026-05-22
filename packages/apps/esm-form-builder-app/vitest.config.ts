import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

export default defineAppVitestConfig(__dirname, {
  aliases: {
    '@hooks/*': './src/hooks/*',
    '@types': './src/types.ts',
    '@tools/*': './tools/*',
    '@constants': './src/constants.ts',
    '@resources/*': './src/resources/*',
  },
});
