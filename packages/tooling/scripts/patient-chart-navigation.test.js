const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const frontendConfig = require(path.join(repoRoot, 'config/frontend.json'));
const chartSlot = 'patient-chart-dashboard-slot';
const slotConfig = frontendConfig['@sihsalus/esm-patient-chart-app'].extensionSlots?.[chartSlot];
const appsDirectory = path.join(repoRoot, 'packages/apps');

// Run in the uncached tooling CI gate, even when incremental workspace
// verification selects only the app adding or removing a navigation entry.
test('the patient chart order covers visible extensions without changing their registration or visibility', () => {
  const visibleNames = fs.readdirSync(appsDirectory).flatMap((directory) => {
    const manifestPath = path.join(appsDirectory, directory, 'src/routes.json');
    if (!fs.existsSync(manifestPath)) return [];
    return (JSON.parse(fs.readFileSync(manifestPath, 'utf8')).extensions ?? [])
      .filter(({ slot, slots }) => slot === chartSlot || slots?.includes(chartSlot))
      .filter(({ component }) => component !== 'hiddenDashboardMarker')
      .map(({ name }) => name);
  });

  assert.deepEqual(Object.keys(slotConfig ?? {}), ['order']);
  assert.equal(new Set(slotConfig.order).size, slotConfig.order.length, 'Duplicate navigation IDs');
  assert.deepEqual([...slotConfig.order].sort(), visibleNames.sort(), 'Unknown or unpositioned navigation IDs');
});

test('navigation integration-test cache tracks the root configuration and all source manifests', () => {
  const turbo = require(path.join(repoRoot, 'turbo.json'));
  assert.ok(turbo.tasks.test.inputs.includes('$TURBO_ROOT$/config/frontend.json'));
  assert.ok(turbo.tasks.test.inputs.includes('$TURBO_ROOT$/packages/apps/*/src/routes.json'));
});
