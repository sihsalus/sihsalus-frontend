const assert = require('node:assert/strict');
const test = require('node:test');

const {
  criticalApps,
  findMissingPrivileges,
  findStaleExemptions,
  guardExemptions,
  validateCriticalRoutePrivileges,
} = require('./validate-critical-route-privileges');

test('detects unguarded critical route entries', () => {
  const failures = findMissingPrivileges(
    {
      pages: [{ component: 'root', route: 'clinical' }],
      extensions: [{ name: 'summary', privileges: 'View Clinical Data' }],
      workspaces2: [{ name: 'edit-form', privileges: '' }],
    },
    'clinical-app',
  );

  assert.deepEqual(failures, [
    { appName: 'clinical-app', section: 'pages', name: 'root' },
    { appName: 'clinical-app', section: 'workspaces2', name: 'edit-form' },
  ]);
});

test('accepts non-empty string and array privilege declarations', () => {
  assert.deepEqual(
    findMissingPrivileges(
      {
        pages: [{ component: 'root', privileges: 'View Clinical Data' }],
        modals: [{ name: 'edit', privileges: ['View Clinical Data', 'Edit Clinical Data'] }],
      },
      'clinical-app',
    ),
    [],
  );
});

test('an exemption with a reason excuses an unguarded entry', () => {
  const routes = { workspaces2: [{ name: 'start-visit-workspace-form' }] };
  const exemptions = {
    'clinical-app/workspaces2/start-visit-workspace-form': { reason: 'Guarded in code by canStartVisit.' },
  };

  assert.deepEqual(findMissingPrivileges(routes, 'clinical-app', exemptions), []);
});

test('an exemption without a reason does not excuse anything', () => {
  // A bare key would let someone silence the guard without saying why, which is
  // the omission this whole mechanism exists to prevent.
  const routes = { workspaces2: [{ name: 'edit-form' }] };

  for (const exemption of [{}, { reason: '' }, { reason: '   ' }, { reason: 42 }]) {
    assert.deepEqual(
      findMissingPrivileges(routes, 'clinical-app', { 'clinical-app/workspaces2/edit-form': exemption }),
      [{ appName: 'clinical-app', section: 'workspaces2', name: 'edit-form' }],
      `reason ${JSON.stringify(exemption)} must not excuse the route`,
    );
  }
});

test('an exemption does not leak across apps or sections', () => {
  const exemptions = { 'other-app/modals/edit-form': { reason: 'Guarded elsewhere.' } };

  assert.deepEqual(findMissingPrivileges({ modals: [{ name: 'edit-form' }] }, 'clinical-app', exemptions), [
    { appName: 'clinical-app', section: 'modals', name: 'edit-form' },
  ]);
});

test('every committed exemption states a reason', () => {
  for (const [key, exemption] of Object.entries(guardExemptions)) {
    assert.ok(
      typeof exemption.reason === 'string' && exemption.reason.trim().length > 0,
      `exemption ${key} must say why the manifest cannot express its guard`,
    );
  }
});

test('no exemption survives the route it excused being guarded or removed', () => {
  assert.deepEqual(
    findStaleExemptions(),
    [],
    'a stale exemption would silently excuse a future route that reuses the same key',
  );
});

test('keeps every production-critical application guarded', () => {
  assert.equal(criticalApps.length, 15);
  assert.deepEqual(validateCriticalRoutePrivileges(), []);
});
