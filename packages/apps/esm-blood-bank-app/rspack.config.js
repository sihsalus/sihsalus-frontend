const defaultConfig = require('openmrs/default-rspack-config');

module.exports = (env, argv) => {
  const config = defaultConfig(env, argv);

  if (config.mode === 'development') {
    // The current Rspack dev client crashes before this ESM can mount when it
    // calls setLogLevel. Keep recompilation, and refresh the browser manually.
    config.devServer = {
      ...config.devServer,
      client: false,
      hot: false,
      liveReload: false,
    };
  }

  return config;
};
