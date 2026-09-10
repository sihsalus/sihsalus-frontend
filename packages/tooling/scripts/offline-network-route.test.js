const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = path.resolve(__dirname, '../app-shell/service-worker.ts');
const header = 'x-omrs-offline-caching-strategy';

function loadRoute() {
  const routes = [];
  class NetworkOnly {}
  const javascript = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const requireDependency = (name) => {
    if (name === '@openmrs/esm-app-shell/default-service-worker') return {};
    if (name === 'workbox-routing') return { registerRoute: (...args) => routes.push(args) };
    if (name === 'workbox-strategies') return { NetworkOnly };
    if (name === '../../libs/esm-offline/src/service-worker-http-headers') {
      return { omrsOfflineCachingStrategyHttpHeaderName: header };
    }
    throw new Error(`Unexpected worker dependency: ${name}`);
  };
  vm.runInNewContext(javascript, { require: requireDependency, exports: {} }, { filename: source });
  assert.equal(routes.length, 1);
  const [matches, strategy, method] = routes[0];
  assert.ok(strategy instanceof NetworkOnly);
  assert.equal(method, 'GET');
  return matches;
}

test('fresh clinical reads use the Workbox network-only route', () => {
  const matches = loadRoute();
  const request = new Request('https://synthetic.example.test/openmrs/ws/fhir2/R4/Observation', {
    cache: 'no-store',
    headers: { [header]: 'network-only-or-cache-only' },
  });
  assert.equal(matches({ request }), true);
});

for (const [name, init] of [
  ['ordinary offline reads', { headers: { [header]: 'network-only-or-cache-only' } }],
  ['explicit network-first caching', { cache: 'no-store', headers: { [header]: 'network-first' } }],
  ['requests without an offline strategy', { cache: 'no-store' }],
]) {
  test(`preserves the upstream strategy for ${name}`, () => {
    const matches = loadRoute();
    const request = new Request('https://synthetic.example.test/openmrs/ws/rest/v1/patient', init);
    assert.equal(matches({ request }), false);
  });
}
