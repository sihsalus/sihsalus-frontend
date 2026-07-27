const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { baselinePath, diffBudget, total } = require('./validate-lint-budget');

const ANY = 'lint/suspicious/noExplicitAny';
const BANG = 'lint/style/noNonNullAssertion';

/** Treat every file named in the fixture as existing, so orphan detection is opt-in. */
const allPresent = () => true;

test('a clean run reports nothing', () => {
  const baseline = { 'src/a.ts': { [ANY]: 2 } };
  const actual = { 'src/a.ts': { [ANY]: 2 } };

  const { regressions, improvements, orphans } = diffBudget(baseline, actual, allPresent);

  assert.deepEqual(regressions, []);
  assert.deepEqual(improvements, []);
  assert.deepEqual(orphans, []);
});

test('exceeding the budget for a rule is a regression', () => {
  const baseline = { 'src/a.ts': { [ANY]: 2 } };
  const actual = { 'src/a.ts': { [ANY]: 3 } };

  const { regressions } = diffBudget(baseline, actual, allPresent);

  assert.equal(regressions.length, 1);
  assert.deepEqual(regressions[0], { file: 'src/a.ts', rule: ANY, budget: 2, count: 3 });
});

test('a rule with no budget in a known file cannot be introduced', () => {
  const baseline = { 'src/a.ts': { [ANY]: 2 } };
  const actual = { 'src/a.ts': { [ANY]: 2, [BANG]: 1 } };

  const { regressions } = diffBudget(baseline, actual, allPresent);

  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].rule, BANG);
  assert.equal(regressions[0].budget, 0);
});

test('a file absent from the baseline has an implicit budget of zero', () => {
  const { regressions } = diffBudget({}, { 'src/brand-new.ts': { [ANY]: 1 } }, allPresent);

  assert.equal(regressions.length, 1);
  assert.equal(regressions[0].file, 'src/brand-new.ts');
  assert.equal(regressions[0].budget, 0);
});

test('renaming a file does not carry its budget across', () => {
  // The budget is keyed by path, so the new path starts clean. This is what
  // forces mass renames to happen before the baseline is taken, not after.
  const baseline = { 'src/old-name.ts': { [ANY]: 5 } };
  const actual = { 'src/new-name.ts': { [ANY]: 5 } };

  const { regressions, orphans } = diffBudget(baseline, actual, (file) => file === 'src/new-name.ts');

  assert.equal(regressions.length, 1, 'the new path must not inherit the old budget');
  assert.deepEqual(orphans, ['src/old-name.ts']);
});

test('fixing a warning without updating the baseline is rejected', () => {
  // Without this the budget would stay stale and the fixed warning could be
  // silently respent later.
  const baseline = { 'src/a.ts': { [ANY]: 3 } };
  const actual = { 'src/a.ts': { [ANY]: 1 } };

  const { improvements, regressions } = diffBudget(baseline, actual, allPresent);

  assert.deepEqual(regressions, []);
  assert.equal(improvements.length, 1);
  assert.deepEqual(improvements[0], { file: 'src/a.ts', rule: ANY, budget: 3, count: 1 });
});

test('clearing a file entirely still requires banking the improvement', () => {
  const { improvements } = diffBudget({ 'src/a.ts': { [ANY]: 2 } }, {}, allPresent);

  assert.equal(improvements.length, 1);
  assert.equal(improvements[0].count, 0);
});

test('a baseline entry for a deleted file is an orphan, not a free budget', () => {
  const { orphans, improvements } = diffBudget({ 'src/gone.ts': { [ANY]: 4 } }, {}, () => false);

  assert.deepEqual(orphans, ['src/gone.ts']);
  assert.deepEqual(improvements, [], 'an orphan is reported once, not also as an improvement');
});

test('total sums every rule across every file', () => {
  assert.equal(total({ 'a.ts': { [ANY]: 2, [BANG]: 1 }, 'b.ts': { [ANY]: 3 } }), 6);
  assert.equal(total({}), 0);
});

test('the committed baseline is sorted, so it diffs cleanly', () => {
  if (!fs.existsSync(baselinePath)) {
    return;
  }

  const raw = fs.readFileSync(baselinePath, 'utf8');
  const baseline = JSON.parse(raw);

  const files = Object.keys(baseline);
  assert.deepEqual(files, [...files].sort(), 'baseline files must be sorted');

  for (const [file, rules] of Object.entries(baseline)) {
    const names = Object.keys(rules);
    assert.deepEqual(names, [...names].sort(), `rules for ${file} must be sorted`);
  }

  assert.ok(raw.endsWith('\n'), 'baseline must end with a newline');
});

test('every file in the committed baseline still exists', () => {
  if (!fs.existsSync(baselinePath)) {
    return;
  }

  const repoRoot = path.resolve(__dirname, '../../..');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const missing = Object.keys(baseline).filter((file) => !fs.existsSync(path.join(repoRoot, file)));

  assert.deepEqual(missing, [], 'run `yarn lint-budget:update` to drop entries for deleted files');
});
