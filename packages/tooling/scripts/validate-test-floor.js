#!/usr/bin/env node
/**
 * Test coverage ratchet.
 *
 * The repo has 802 test files against 3,272 sources, but the number that
 * matters is not the ratio — it is that eight apps have no tests at all and
 * keep growing. Retrofitting those is a long campaign; letting them grow
 * untested is a decision nobody makes on purpose.
 *
 * So this measures, per workspace, how many testable source files have no test
 * to speak for them:
 *
 *     deficit(pkg) = testableSources(pkg) - testFiles(pkg)
 *
 * and enforces `deficit(pkg) <= baseline(pkg)`. Adding five components to an
 * app with no tests fails; adding five components with five tests passes; and
 * adding tests to an app that had none lowers its baseline permanently, since
 * dropping below it is also an error resolved by `yarn test-floor:update`.
 *
 * Files a test would never target — types, constants, declarations, the module
 * entry point — are excluded, so the deficit reflects untested behaviour rather
 * than untested type aliases.
 *
 * Usage:
 *   node packages/tooling/scripts/validate-test-floor.js            # gate
 *   node packages/tooling/scripts/validate-test-floor.js --update   # rewrite baseline
 *   node packages/tooling/scripts/validate-test-floor.js --report-only
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const baselinePath = path.join(repoRoot, 'packages/tooling/baselines/test-floor.json');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', 'coverage', '__mocks__']);

/**
 * Files that hold no behaviour to test: type aliases, constants, the module
 * entry point, ambient declarations, and test scaffolding itself.
 */
function isTestableSource(relativePath) {
  const name = path.basename(relativePath);

  if (name.endsWith('.d.ts')) return false;
  if (/\.(test|spec)\.tsx?$/.test(name)) return false;
  if (/^(index|types|constants|declarations|setup-tests|routes)\.tsx?$/.test(name)) return false;
  if (/\.(types|constants|mock|mocks)\.tsx?$/.test(name)) return false;
  if (/(^|\/)(test-utils|test-mocks|__mocks__|mocks)\//.test(relativePath)) return false;

  return true;
}

function isTestFile(relativePath) {
  return /\.(test|spec)\.tsx?$/.test(path.basename(relativePath));
}

function walk(absoluteDir, relativeBase, out = []) {
  if (!fs.existsSync(absoluteDir)) return out;

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;

    const absolute = path.join(absoluteDir, entry.name);
    const relative = path.posix.join(relativeBase, entry.name);

    if (entry.isDirectory()) {
      walk(absolute, relative, out);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(relative);
    }
  }

  return out;
}

function resolveWorkspaces() {
  const rootManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const workspaces = [];

  for (const pattern of rootManifest.workspaces ?? []) {
    if (!pattern.endsWith('/*')) continue;

    const parentRelative = pattern.slice(0, -2);
    const parentAbsolute = path.join(repoRoot, parentRelative);
    if (!fs.existsSync(parentAbsolute)) continue;

    for (const entry of fs.readdirSync(parentAbsolute)) {
      const packageDir = path.join(parentAbsolute, entry);
      if (fs.existsSync(path.join(packageDir, 'package.json'))) {
        workspaces.push(path.posix.join(parentRelative, entry));
      }
    }
  }

  return workspaces.sort();
}

/** Per workspace: how many testable sources have no test to speak for them. */
function measure() {
  const deficits = {};

  for (const workspace of resolveWorkspaces()) {
    const files = walk(path.join(repoRoot, workspace, 'src'), 'src');
    const tests = files.filter(isTestFile).length;
    const sources = files.filter((file) => !isTestFile(file) && isTestableSource(file)).length;

    // A package with neither is not a gap, it is empty.
    if (sources === 0 && tests === 0) continue;

    deficits[workspace] = Math.max(0, sources - tests);
  }

  return deficits;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return {};
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function writeBaseline(deficits) {
  const sorted = {};
  for (const key of Object.keys(deficits).sort()) {
    sorted[key] = deficits[key];
  }
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

function total(deficits) {
  return Object.values(deficits).reduce((sum, value) => sum + value, 0);
}

function diffFloor(baseline, actual) {
  const regressions = [];
  const improvements = [];
  const orphans = [];

  for (const [workspace, deficit] of Object.entries(actual)) {
    const allowed = baseline[workspace];
    // A package absent from the baseline is new: it starts at zero, so its
    // first untested source is a regression rather than a free allowance.
    if (allowed === undefined) {
      if (deficit > 0) regressions.push({ workspace, allowed: 0, deficit });
      continue;
    }
    if (deficit > allowed) regressions.push({ workspace, allowed, deficit });
    if (deficit < allowed) improvements.push({ workspace, allowed, deficit });
  }

  for (const workspace of Object.keys(baseline)) {
    if (!(workspace in actual)) orphans.push(workspace);
  }

  return { regressions, improvements, orphans };
}

function main() {
  const argv = process.argv.slice(2);
  const actual = measure();

  if (argv.includes('--update')) {
    writeBaseline(actual);
    console.log(`Wrote ${path.relative(repoRoot, baselinePath)}`);
    console.log(`${total(actual)} untested source files across ${Object.keys(actual).length} workspaces.`);
    return;
  }

  const baseline = readBaseline();
  const { regressions, improvements, orphans } = diffFloor(baseline, actual);

  console.log(`Test floor: ${total(actual)} untested source files now, ${total(baseline)} allowed.`);

  if (regressions.length > 0) {
    console.error('\nThese packages gained source files without tests to match:\n');
    for (const { workspace, allowed, deficit } of regressions) {
      console.error(`  ${workspace}\n    ${deficit} untested (allowed ${allowed})`);
    }
    console.error('\nAdd a test alongside the new code. The floor is a ceiling that only moves down.');
  }

  if (orphans.length > 0) {
    console.error(`\n${orphans.length} baseline entr(ies) for packages that no longer exist:\n`);
    for (const workspace of orphans) console.error(`  ${workspace}`);
    console.error('\nRun `yarn test-floor:update` to drop them.');
  }

  if (improvements.length > 0) {
    const closed = improvements.reduce((sum, i) => sum + (i.allowed - i.deficit), 0);
    console.error(`\n${closed} source file(s) gained tests but the baseline still allows for them:\n`);
    for (const { workspace, allowed, deficit } of improvements) {
      console.error(`  ${workspace}\n    ${deficit} untested (allowed ${allowed})`);
    }
    console.error('\nRun `yarn test-floor:update` to bank the improvement, so it cannot be spent again.');
  }

  if (regressions.length === 0 && orphans.length === 0 && improvements.length === 0) {
    console.log('Test floor respected.');
    return;
  }

  if (argv.includes('--report-only')) {
    console.error('\n--report-only: not failing the build.');
    return;
  }

  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = { baselinePath, diffFloor, isTestableSource, measure, total };
