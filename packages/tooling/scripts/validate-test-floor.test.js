const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { baselinePath, diffFloor, isTestableSource, measure, total } = require('./validate-test-floor');

test('a package that holds its ground passes', () => {
  const { regressions, improvements, orphans } = diffFloor({ 'packages/apps/a': 5 }, { 'packages/apps/a': 5 });

  assert.deepEqual(regressions, []);
  assert.deepEqual(improvements, []);
  assert.deepEqual(orphans, []);
});

test('gaining source files without tests is a regression', () => {
  const { regressions } = diffFloor({ 'packages/apps/a': 5 }, { 'packages/apps/a': 8 });

  assert.equal(regressions.length, 1);
  assert.deepEqual(regressions[0], { workspace: 'packages/apps/a', allowed: 5, deficit: 8 });
});

test('a package absent from the baseline starts at zero', () => {
  // Otherwise a brand new app could arrive with a hundred untested files and
  // set its own floor at a hundred.
  const { regressions } = diffFloor({}, { 'packages/apps/brand-new': 3 });

  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].allowed, 0);
});

test('a new package with tests for everything is accepted', () => {
  assert.deepEqual(diffFloor({}, { 'packages/apps/brand-new': 0 }).regressions, []);
});

test('closing the gap without updating the baseline is rejected', () => {
  // The floor has to be exact, or a package could add tests, bank nothing, and
  // later spend the same slack on untested code.
  const { improvements, regressions } = diffFloor({ 'packages/apps/a': 5 }, { 'packages/apps/a': 2 });

  assert.deepEqual(regressions, []);
  assert.equal(improvements.length, 1);
  assert.deepEqual(improvements[0], { workspace: 'packages/apps/a', allowed: 5, deficit: 2 });
});

test('a baseline entry for a package that no longer exists is an orphan', () => {
  const { orphans } = diffFloor({ 'packages/apps/deleted': 4 }, {});

  assert.deepEqual(orphans, ['packages/apps/deleted']);
});

test('files with no behaviour to test are not counted against a package', () => {
  for (const file of [
    'src/types.ts',
    'src/constants.ts',
    'src/index.ts',
    'src/routes.ts',
    'src/declarations.d.ts',
    'src/setup-tests.ts',
    'src/patient.types.ts',
    'src/foo.mock.ts',
    'src/test-utils/render.tsx',
    'src/__mocks__/session.ts',
  ]) {
    assert.equal(isTestableSource(file), false, `${file} should not count as testable`);
  }
});

test('components, hooks and resources do count', () => {
  for (const file of [
    'src/patient-banner.component.tsx',
    'src/hooks/use-visit.ts',
    'src/visit.resource.ts',
    'src/visit-form.workspace.tsx',
  ]) {
    assert.equal(isTestableSource(file), true, `${file} should count as testable`);
  }
});

test('test files never count as untested sources', () => {
  assert.equal(isTestableSource('src/foo.test.tsx'), false);
  assert.equal(isTestableSource('src/foo.spec.ts'), false);
});

test('total sums every workspace', () => {
  assert.equal(total({ a: 3, b: 4 }), 7);
  assert.equal(total({}), 0);
});

test('the committed baseline is sorted and matches the tree', () => {
  if (!fs.existsSync(baselinePath)) return;

  const raw = fs.readFileSync(baselinePath, 'utf8');
  const baseline = JSON.parse(raw);
  const keys = Object.keys(baseline);

  assert.deepEqual(keys, [...keys].sort(), 'baseline workspaces must be sorted');
  assert.ok(raw.endsWith('\n'), 'baseline must end with a newline');

  const repoRoot = path.resolve(__dirname, '../../..');
  const missing = keys.filter((workspace) => !fs.existsSync(path.join(repoRoot, workspace)));
  assert.deepEqual(missing, [], 'run `yarn test-floor:update` to drop entries for deleted packages');
});

test('the repository currently sits exactly on its floor', () => {
  if (!fs.existsSync(baselinePath)) return;

  const { regressions, improvements, orphans } = diffFloor(JSON.parse(fs.readFileSync(baselinePath, 'utf8')), measure());

  assert.deepEqual(regressions, [], 'a package gained untested source files');
  assert.deepEqual(improvements, [], 'a package gained tests; run `yarn test-floor:update`');
  assert.deepEqual(orphans, [], 'the baseline names a package that no longer exists');
});
