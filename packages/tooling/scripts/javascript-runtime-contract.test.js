const assert = require('node:assert/strict');
const test = require('node:test');

const { findInvalidWebpackShareScopeReferences, findUnboundReactReferences } = require('./javascript-runtime-contract');

test('detects JSX compiled against a missing React global', () => {
  const references = findUnboundReactReferences(
    'function render(root) { root.render(React.createElement("div", null)); }',
  );

  assert.equal(references.length, 1);
  assert.equal(references[0].name, 'React');
});

test('accepts React when the bundle defines its binding', () => {
  const references = findUnboundReactReferences(
    'const React = require("react"); function render(root) { root.render(React.createElement("div", null)); }',
  );

  assert.deepEqual(references, []);
});

test('accepts minified JSX that uses an imported module alias', () => {
  const references = findUnboundReactReferences('function d(e){e.render(o.createElement(u,{subject:f}))}');

  assert.deepEqual(references, []);
});

test('detects Webpack share scopes read through the global object', () => {
  const references = findInvalidWebpackShareScopeReferences(
    'container.init(globalThis.__webpack_share_scopes__.default);',
  );

  assert.equal(references.length, 1);
  assert.equal(references[0].name, '__webpack_share_scopes__');
});

test('detects an unresolved Webpack share scope identifier', () => {
  const references = findInvalidWebpackShareScopeReferences('container.init(__webpack_share_scopes__.default);');

  assert.equal(references.length, 1);
});

test('accepts the share scope after Webpack resolves it to the bundle runtime', () => {
  const references = findInvalidWebpackShareScopeReferences('container.init(__webpack_require__.S.default);');

  assert.deepEqual(references, []);
});
