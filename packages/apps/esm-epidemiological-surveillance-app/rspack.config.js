// Rspack 2 exposes HMR utilities as ES modules; no CommonJS adapter is needed.
const createConfig = require('openmrs/default-rspack-config');

module.exports = (env, argv) => {
  const config = createConfig(env, argv);
  config.module.rules.push({ test: /\.pdf$/i, type: 'asset/resource' });
  return config;
};
