const assert = require('node:assert/strict');
const test = require('node:test');

const {
  criticalApps,
  findMissingPrivileges,
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

test('keeps every production-critical application guarded', () => {
  assert.equal(criticalApps.length, 14);
  assert.deepEqual(validateCriticalRoutePrivileges(), []);
});
