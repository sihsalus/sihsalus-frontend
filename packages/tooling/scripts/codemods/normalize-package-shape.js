#!/usr/bin/env node
/**
 * One-shot codemod: bring every app package.json and tsconfig.json in line with
 * packages/templates/esm-app-template.
 *
 * This is deliberately NOT wired into CI. Run it once, review the diff, commit.
 * The standing invariant is enforced by validate-package-shape.js.
 *
 * Usage:
 *   node packages/tooling/scripts/codemods/normalize-package-shape.js [--dry-run]
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../../..');
const appsDir = path.join(repoRoot, 'packages/apps');
const templateManifestPath = path.join(repoRoot, 'packages/templates/esm-app-template/package.json');

/** Scripts every app must have, with the exact value, in this order. */
const CANONICAL_SCRIPTS = JSON.parse(fs.readFileSync(templateManifestPath, 'utf8')).scripts;

/** Extra scripts an app may keep. Anything else is removed. */
const ALLOWED_EXTRA_SCRIPTS = ['build:development', 'test:e2e', 'check-translations'];

/** Scripts that are redundant with a root-level script and get removed. */
const REDUNDANT_SCRIPTS = [
  // Duplicates `yarn format` at the root, and confusingly named after a
  // formatter the repo no longer uses.
  'prettier',
  // Turbo always runs from the repo root, so a per-app `verify` silently
  // verifies the whole monorepo. Ten apps, seven different command strings.
  'verify',
];

/** Misspelled script names, mapped to their canonical form. */
const RENAMED_SCRIPTS = new Map([
  ['test-watch', 'test:watch'],
  ['test-e2e', 'test:e2e'],
]);

/** tsconfig `include` entry pointing at packages/tools/, a directory that does not exist. */
const DEAD_INCLUDE = '../../tools/setup-tests.ts';

function listApps() {
  return fs
    .readdirSync(appsDir)
    .filter((entry) => fs.existsSync(path.join(appsDir, entry, 'package.json')))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Write only when the *value* changed, never merely because our serializer
 * disagrees with Biome about where to wrap an array. Formatting is handed back
 * to Biome afterwards so the diff stays limited to real edits.
 */
function writeJson(filePath, value, dryRun, touched) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (JSON.stringify(JSON.parse(original)) === JSON.stringify(value)) {
    return false;
  }
  if (!dryRun) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
    touched.push(filePath);
  }
  return true;
}

/**
 * Rebuild the scripts block: canonical entries first in template order with
 * template values, then whichever allowed extras the app already had.
 */
function normalizeScripts(scripts, changes, app) {
  const source = { ...scripts };

  for (const [from, to] of RENAMED_SCRIPTS) {
    if (from in source) {
      source[to] = source[from];
      delete source[from];
      changes.push(`${app}: renamed script ${from} -> ${to}`);
    }
  }

  for (const name of REDUNDANT_SCRIPTS) {
    if (name in source) {
      delete source[name];
      changes.push(`${app}: removed redundant script ${name}`);
    }
  }

  const normalized = {};

  for (const [name, canonicalValue] of Object.entries(CANONICAL_SCRIPTS)) {
    if (!(name in source)) {
      changes.push(`${app}: added missing script ${name}`);
    } else if (source[name] !== canonicalValue) {
      changes.push(`${app}: normalized script ${name}`);
    }
    normalized[name] = canonicalValue;
    delete source[name];
  }

  for (const name of ALLOWED_EXTRA_SCRIPTS) {
    if (name in source) {
      normalized[name] = source[name];
      delete source[name];
    }
  }

  for (const name of Object.keys(source)) {
    changes.push(`${app}: removed unrecognized script ${name}`);
  }

  return normalized;
}

function normalizeTsconfig(tsconfigPath, app, changes, dryRun, touched) {
  if (!fs.existsSync(tsconfigPath)) {
    return false;
  }

  const tsconfig = readJson(tsconfigPath);

  if (Array.isArray(tsconfig.include) && tsconfig.include.includes(DEAD_INCLUDE)) {
    tsconfig.include = tsconfig.include.filter((entry) => entry !== DEAD_INCLUDE);
    changes.push(`${app}: dropped tsconfig include of ${DEAD_INCLUDE} (path does not exist)`);
  }

  // An empty `exclude` overrides the inherited one, silently pulling test files
  // into the build program.
  if (Array.isArray(tsconfig.exclude) && tsconfig.exclude.length === 0) {
    delete tsconfig.exclude;
    changes.push(`${app}: dropped empty tsconfig exclude that overrode the inherited one`);
  }

  // Redeclaring a path that packages/tsconfig.json already provides shadows the
  // shared entry and drifts the moment the shared list changes. Strip those and
  // keep only the aliases that are genuinely app-specific.
  if (tsconfig.compilerOptions?.paths) {
    const shared = readJson(path.join(repoRoot, 'packages/tsconfig.json')).compilerOptions.paths;
    const own = tsconfig.compilerOptions.paths;
    const duplicated = Object.keys(own).filter(
      (key) => key in shared && JSON.stringify(own[key]) === JSON.stringify(shared[key]),
    );
    const remaining = Object.fromEntries(Object.entries(own).filter(([key]) => !duplicated.includes(key)));

    if (duplicated.length > 0) {
      changes.push(`${app}: dropped ${duplicated.length} tsconfig paths identical to the shared base`);
    }

    if (Object.keys(remaining).length === 0) {
      delete tsconfig.compilerOptions.paths;
    } else {
      tsconfig.compilerOptions.paths = remaining;
      const overrides = Object.keys(remaining).filter((key) => key in shared);
      if (overrides.length > 0) {
        // Left alone on purpose: these resolve against the app's own baseUrl, so
        // deleting them is not a formatting change. validate-package-shape.js
        // reports them; unwinding each one needs its own typecheck.
        changes.push(`${app}: REVIEW - ${overrides.length} tsconfig paths shadow the shared base`);
      }
    }

    if (tsconfig.compilerOptions && Object.keys(tsconfig.compilerOptions).length === 0) {
      delete tsconfig.compilerOptions;
    }
  }

  return writeJson(tsconfigPath, tsconfig, dryRun, touched);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const changes = [];
  const touched = [];
  let manifestsChanged = 0;
  let tsconfigsChanged = 0;

  for (const app of listApps()) {
    const appDir = path.join(appsDir, app);
    const manifestPath = path.join(appDir, 'package.json');
    const manifest = readJson(manifestPath);

    manifest.scripts = normalizeScripts(manifest.scripts ?? {}, changes, app);

    if (writeJson(manifestPath, manifest, dryRun, touched)) {
      manifestsChanged += 1;
    }

    if (normalizeTsconfig(path.join(appDir, 'tsconfig.json'), app, changes, dryRun, touched)) {
      tsconfigsChanged += 1;
    }
  }

  for (const change of changes) {
    console.log(change);
  }

  if (touched.length > 0) {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(
      process.execPath,
      [path.join(repoRoot, 'packages/tooling/scripts/run-biome.js'), 'format', '--write', ...touched],
      { cwd: repoRoot, stdio: 'inherit' },
    );
    if (result.status !== 0) {
      console.error('biome format failed; the codemod left files unformatted');
      process.exit(1);
    }
  }

  console.log(`\n${dryRun ? '[dry run] ' : ''}${manifestsChanged} package.json, ${tsconfigsChanged} tsconfig.json`);
  console.log(`${changes.length} individual changes`);
}

main();
