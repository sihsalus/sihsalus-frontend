const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { normalizeDevBackendUrl } = require('./dev-backend-url');

for (const suffix of ['/openmrs', '/openmrs/', '/openmrs///']) {
  test(`normalizes the API base ending in ${suffix}`, () => {
    assert.equal(normalizeDevBackendUrl(`https://example.test${suffix}`), 'https://example.test');
  });
}

test('startup rejects an invalid backend before serving and does not print embedded credentials', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'start-dev.js')], {
    cwd: path.resolve(__dirname, '../../..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      SIHSALUS_BACKEND_URL: 'https://synthetic-user:synthetic-password@example.test/openmrs',
    },
    timeout: 10000,
  });
  assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.match(output, /SIHSALUS_BACKEND_URL must use HTTP\(S\)/);
  assert.doesNotMatch(output, /synthetic-user|synthetic-password|Listening at|Local SPA/);
});
test('preserves origins, custom paths and local ports', () => {
  for (const url of ['https://example.test', 'https://example.test/custom', 'http://localhost:8081']) {
    assert.equal(normalizeDevBackendUrl(url), url);
  }
});
test('normalizes surrounding whitespace, trailing slashes and an HTTP API base', () => {
  assert.equal(normalizeDevBackendUrl('  http://localhost:8081/openmrs/  '), 'http://localhost:8081');
  assert.equal(normalizeDevBackendUrl('https://example.test///'), 'https://example.test');
});
test('does not change a custom context containing openmrs', () => {
  assert.equal(normalizeDevBackendUrl('https://example.test/custom/openmrs/'), 'https://example.test/custom/openmrs');
});
for (const value of [
  '',
  'not-a-url',
  'file:///openmrs',
  'ftp://example.test/openmrs',
  'https://synthetic-user:synthetic-password@example.test/openmrs',
  'https://example.test/openmrs?token=synthetic-secret',
  'https://example.test/openmrs#fragment',
]) {
  test(`rejects unsupported backend form ${value.split(':')[0] || 'empty'}`, () => {
    assert.throws(
      () => normalizeDevBackendUrl(value),
      (error) => {
        assert.match(error.message, /^SIHSALUS_BACKEND_URL must/);
        assert.ok(!error.message.includes('synthetic-password'));
        assert.ok(!error.message.includes('synthetic-secret'));
        assert.ok(!error.message.includes(value) || !value);
        return true;
      },
    );
  });
}
