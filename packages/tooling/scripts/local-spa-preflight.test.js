const assert = require('node:assert/strict');
const test = require('node:test');

const { findMissingSpaArtifacts } = require('./local-spa-preflight');

test('accepts a complete assembled SPA', () => {
  const artifacts = ['/dist/spa/importmap.json', '/dist/spa/routes.registry.json', '/dist/spa/index.html'];

  assert.deepEqual(
    findMissingSpaArtifacts(artifacts, () => true),
    [],
  );
});

test('reports every missing assembled SPA artifact', () => {
  const artifacts = ['/dist/spa/importmap.json', '/dist/spa/routes.registry.json', '/dist/spa/index.html'];
  const existingArtifacts = new Set(['/dist/spa/importmap.json']);

  assert.deepEqual(
    findMissingSpaArtifacts(artifacts, (artifactPath) => existingArtifacts.has(artifactPath)),
    ['/dist/spa/routes.registry.json', '/dist/spa/index.html'],
  );
});
