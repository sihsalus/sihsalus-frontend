const defaultConfig = require('openmrs/default-rspack-config');

module.exports = (env, argv) => {
  const config = defaultConfig(env, argv);

  // dev-server 2 imports named exports; core 1 publishes these HMR utilities
  // through module.exports. Preserve both interfaces on the same instances.
  if (config.mode === 'development') {
    config.module.rules.push({
      include: [
        require.resolve('@rspack/core/hot/log.js'),
        require.resolve('@rspack/core/hot/emitter.js'),
      ],
      use: require.resolve('./tooling/hmr-compat-loader.cjs'),
    });
  }

  return config;
};
