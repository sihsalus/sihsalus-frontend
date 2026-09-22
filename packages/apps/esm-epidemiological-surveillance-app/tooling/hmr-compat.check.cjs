const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const loader = require('./hmr-compat-loader.cjs');

for (const name of ['log', 'emitter']) {
  test(`HMR ${name} supports CommonJS and named imports on the same instance`, () => {
    const resourcePath = require.resolve(`@rspack/core/hot/${name}.js`);
    const source = loader.call({ resourcePath }, readFileSync(resourcePath, 'utf8'));
    const context = { module: { exports: {} }, console };
    runInNewContext(source, context);
    const utility = context.module.exports;
    assert.equal(utility[name], utility);
    if (name === 'log') {
      assert.equal(typeof utility, 'function');
      utility.log.setLogLevel('error');
    } else {
      let received;
      utility.on('webpackHotUpdate', (hash) => { received = hash; });
      utility.emitter.emit('webpackHotUpdate', 'new-build');
      assert.equal(received, 'new-build');
    }
  });
}
