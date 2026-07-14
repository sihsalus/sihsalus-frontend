const assert = require('node:assert/strict');
const test = require('node:test');

const { findDuplicateRouteRegistrations } = require('./validate-route-registration-names');

test('detects duplicate names inside the same global registration namespace', () => {
  const duplicates = findDuplicateRouteRegistrations([
    {
      file: 'first/routes.json',
      routes: { modals: [{ name: 'delete-dialog', component: 'FirstDelete', privileges: 'first.edit' }] },
    },
    {
      file: 'second/routes.json',
      routes: { modals: [{ name: 'delete-dialog', component: 'SecondDelete', privileges: 'second.edit' }] },
    },
  ]);

  assert.equal(duplicates.length, 1);
  assert.deepEqual(
    duplicates[0].map(({ file, namespace, name }) => ({ file, namespace, name })),
    [
      { file: 'first/routes.json', namespace: 'modal', name: 'delete-dialog' },
      { file: 'second/routes.json', namespace: 'modal', name: 'delete-dialog' },
    ],
  );
});

test('keeps legacy and v2 workspace namespaces independent', () => {
  const duplicates = findDuplicateRouteRegistrations([
    {
      file: 'app/routes.json',
      routes: {
        workspaces: [{ name: 'clinical-form', component: 'LegacyForm' }],
        workspaces2: [{ name: 'clinical-form', component: 'CurrentForm' }],
      },
    },
  ]);

  assert.deepEqual(duplicates, []);
});

test('detects duplicate workspace v2 names before runtime registration', () => {
  const duplicates = findDuplicateRouteRegistrations([
    { file: 'first/routes.json', routes: { workspaces2: [{ name: 'clinical-form' }] } },
    { file: 'second/routes.json', routes: { workspaces2: [{ name: 'clinical-form' }] } },
  ]);

  assert.equal(duplicates[0][0].namespace, 'workspace-v2');
});
