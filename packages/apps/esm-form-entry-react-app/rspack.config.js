const path = require('node:path');
const defaultConfig = require('openmrs/default-rspack-config');

defaultConfig.additionalConfig.resolve = {
  ...(defaultConfig.additionalConfig.resolve ?? {}),
  alias: {
    ...(defaultConfig.additionalConfig.resolve?.alias ?? {}),
    '@sihsalus/esm-form-engine-lib$': path.resolve(__dirname, '../../libs/esm-form-engine-lib/src/index.ts'),
  },
};

module.exports = defaultConfig;
