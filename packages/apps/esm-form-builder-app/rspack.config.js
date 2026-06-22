const path = require('node:path');
const defaultConfig = require('openmrs/default-rspack-config');

defaultConfig.additionalConfig.resolve = {
  ...(defaultConfig.additionalConfig.resolve ?? {}),
  alias: {
    ...(defaultConfig.additionalConfig.resolve?.alias ?? {}),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
    '@types': path.resolve(__dirname, 'src/types.ts'),
    '@tools': path.resolve(__dirname, 'tools'),
    '@constants': path.resolve(__dirname, 'src/constants.ts'),
    '@resources': path.resolve(__dirname, 'src/resources'),
  },
};

module.exports = defaultConfig;
