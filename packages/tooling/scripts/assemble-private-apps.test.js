const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');

test('delivery configuration excludes the blood-bank prototype and preserves other apps', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'sihsalus-delivery-'));
  try {
    for (const app of ['esm-blood-bank-app', 'esm-crecimiento-desarrollo-app']) {
      const dir = path.join(fixture, 'packages/apps', app);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, 'package.json'),
        readFileSync(path.join(root, 'packages/apps', app, 'package.json')),
      );
    }
    mkdirSync(path.join(fixture, 'config'));
    // A stale generated entry must not bring the prototype back into the next delivery.
    writeFileSync(
      path.join(fixture, 'config/spa-assemble-config.json'),
      JSON.stringify({
        frontendModules: { '@sihsalus/esm-blood-bank-app': '1.0.0-alpha', '@openmrs/example-app': '1.0.0' },
      }),
    );
    execFileSync(process.execPath, [path.join(__dirname, 'generate-assemble-config.js')], { cwd: fixture });
    const { frontendModules } = JSON.parse(readFileSync(path.join(fixture, 'config/spa-assemble-config.json')));
    assert.equal(frontendModules['@sihsalus/esm-blood-bank-app'], undefined);
    assert.ok(frontendModules['@sihsalus/esm-cred-app']);
    assert.equal(frontendModules['@openmrs/example-app'], '1.0.0');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
