const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const { rspack, container } = require('@rspack/core');
const createConfig = require('../rspack.config');

test('development HMR utilities execute and publish the federated container', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'surveillance-hmr-'));
  const entry = join(directory, 'hmr.js');
  const name = '_sihsalus_esm_epidemiological_surveillance_app';
  const config = createConfig({}, { mode: 'development' });
  // Use the app's loader rules: a synchronous HMR startup failure prevents
  // publication of the container. No backend or clinical data is involved.
  writeFileSync(entry, `
    import { log } from ${JSON.stringify(require.resolve('@rspack/core/hot/log.js'))};
    import { emitter } from ${JSON.stringify(require.resolve('@rspack/core/hot/emitter.js'))};
    log.setLogLevel('error');
    emitter.on('webpackHotUpdate', hash => { globalThis.receivedHash = hash; });
    emitter.emit('webpackHotUpdate', 'synthetic-build');
  `);
  const compiler = rspack({
    mode: 'development',
    context: process.cwd(),
    entry,
    target: 'web',
    devtool: false,
    module: config.module,
    output: { path: directory, filename: '[name].js', publicPath: '/' },
    plugins: [new container.ModuleFederationPluginV1({
      name,
      library: { type: 'var', name },
      filename: 'remote.js',
      exposes: { './start': entry },
    })],
    optimization: { runtimeChunk: { name: 'runtime' } },
  });
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => error ? reject(error) : resolve(result));
    });
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
    const context = { console };
    context.self = context;
    for (const file of ['runtime.js', 'main.js', 'remote.js']) {
      runInNewContext(readFileSync(join(directory, file), 'utf8'), context);
    }
    assert.equal(context.receivedHash, 'synthetic-build');
    assert.equal(typeof context[name].get, 'function');
    assert.equal(typeof context[name].init, 'function');
  } finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
});
