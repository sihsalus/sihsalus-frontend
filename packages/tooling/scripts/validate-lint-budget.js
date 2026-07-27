#!/usr/bin/env node
/**
 * Lint warning ratchet.
 *
 * Biome reports ~860 warnings that CI does not fail on, because `biome lint`
 * only exits non-zero for errors. Promoting every one of those rules to `error`
 * today would mean fixing ~860 findings before anything can merge. Instead this
 * freezes the current count per (file, rule) and refuses to let it grow.
 *
 * The invariant, for every file f and rule r:
 *
 *     warnings(f, r) <= baseline(f, r)
 *
 * with three corollaries that make it a ratchet rather than a brake:
 *
 *   - A file absent from the baseline has an implicit budget of 0, so new and
 *     renamed files start clean.
 *   - A baseline entry for a file that no longer exists is an error, so deleting
 *     a file cannot leave behind a budget for a future file of the same name.
 *   - Dropping below the baseline is also an error, resolved by running
 *     `yarn lint-budget:update`. The stored numbers therefore only ever
 *     decrease, and a fixed warning can never be silently respent.
 *
 * Usage:
 *   node packages/tooling/scripts/validate-lint-budget.js            # gate
 *   node packages/tooling/scripts/validate-lint-budget.js --update   # rewrite baseline
 *   node packages/tooling/scripts/validate-lint-budget.js --report-only
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const baselinePath = path.join(repoRoot, 'packages/tooling/baselines/lint-warnings.json');

/**
 * Run Biome over the repo and fold its diagnostics into file -> rule -> count.
 */
function collectDiagnostics() {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/@biomejs/biome/bin/biome'),
      'lint',
      '--reporter=json',
      '--max-diagnostics=none',
      '.',
    ],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );

  if (!result.stdout) {
    throw new Error(`biome produced no output.\n${result.stderr ?? ''}`);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`could not parse biome JSON output: ${error.message}`);
  }

  const counts = {};

  for (const diagnostic of report.diagnostics ?? []) {
    const file =
      typeof diagnostic.location?.path === 'string' ? diagnostic.location.path : diagnostic.location?.path?.file;

    if (!file || !diagnostic.category) {
      continue;
    }

    const normalized = file.split(path.sep).join('/');
    counts[normalized] ??= {};
    counts[normalized][diagnostic.category] = (counts[normalized][diagnostic.category] ?? 0) + 1;
  }

  return counts;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

/**
 * Serialize with sorted keys so the baseline diffs cleanly and never reorders.
 */
function writeBaseline(counts) {
  const sorted = {};
  for (const file of Object.keys(counts).sort()) {
    const rules = {};
    for (const rule of Object.keys(counts[file]).sort()) {
      rules[rule] = counts[file][rule];
    }
    sorted[file] = rules;
  }

  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

function total(counts) {
  return Object.values(counts).reduce((sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0), 0);
}

/**
 * @param baseline stored budget, file -> rule -> count
 * @param actual   current counts, same shape
 * @param fileExists predicate over repo-relative paths; injectable for tests
 */
function diffBudget(baseline, actual, fileExists = (file) => fs.existsSync(path.join(repoRoot, file))) {
  const regressions = [];
  const improvements = [];
  const orphans = [];

  for (const [file, rules] of Object.entries(actual)) {
    for (const [rule, count] of Object.entries(rules)) {
      const budget = baseline[file]?.[rule] ?? 0;
      if (count > budget) {
        regressions.push({ file, rule, budget, count });
      }
    }
  }

  for (const [file, rules] of Object.entries(baseline)) {
    if (!fileExists(file)) {
      orphans.push(file);
      continue;
    }
    for (const [rule, budget] of Object.entries(rules)) {
      const count = actual[file]?.[rule] ?? 0;
      if (count < budget) {
        improvements.push({ file, rule, budget, count });
      }
    }
  }

  return { regressions, improvements, orphans };
}

function main() {
  const argv = process.argv.slice(2);
  const update = argv.includes('--update');
  const reportOnly = argv.includes('--report-only');

  const actual = collectDiagnostics();

  if (update) {
    writeBaseline(actual);
    console.log(`Wrote ${baselinePath.replace(`${repoRoot}/`, '')}`);
    console.log(`${total(actual)} warnings across ${Object.keys(actual).length} files.`);
    return;
  }

  const baseline = readBaseline();
  const { regressions, improvements, orphans } = diffBudget(baseline, actual);

  console.log(`Lint budget: ${total(actual)} warnings now, ${total(baseline)} allowed.`);

  if (regressions.length > 0) {
    console.error(`\n${regressions.length} new lint warning(s) over budget:\n`);
    for (const { file, rule, budget, count } of regressions) {
      console.error(`  ${file}\n    ${rule}: ${count} (budget ${budget})`);
    }
    console.error('\nFix the new warnings. The budget is a ceiling that only moves down.');
  }

  if (orphans.length > 0) {
    console.error(`\n${orphans.length} baseline entr(ies) for files that no longer exist:\n`);
    for (const file of orphans) {
      console.error(`  ${file}`);
    }
    console.error('\nRun `yarn lint-budget:update` to drop them.');
  }

  if (improvements.length > 0) {
    const fixed = improvements.reduce((sum, i) => sum + (i.budget - i.count), 0);
    console.error(`\n${fixed} warning(s) were fixed but the baseline still reserves budget for them:\n`);
    for (const { file, rule, budget, count } of improvements) {
      console.error(`  ${file}\n    ${rule}: ${count} (budget ${budget})`);
    }
    console.error('\nRun `yarn lint-budget:update` to bank the improvement.');
    console.error('This keeps the budget exact, so a fixed warning cannot be silently respent.');
  }

  const failed = regressions.length > 0 || orphans.length > 0 || improvements.length > 0;

  if (!failed) {
    console.log('Lint budget respected.');
    return;
  }

  if (reportOnly) {
    console.error('\n--report-only: not failing the build.');
    return;
  }

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  baselinePath,
  collectDiagnostics,
  diffBudget,
  total,
};
