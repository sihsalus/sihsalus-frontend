#!/usr/bin/env node
/**
 * Regression guard for lint coverage.
 *
 * Every workspace package must define a `lint` script so that `turbo run lint`
 * actually lints it. A package without one is silently skipped by Turbo, which
 * is how `esm-styleguide` accumulated 14 uncaught lint errors. This script
 * fails CI if any workspace is missing its `lint` script, so the gap cannot
 * silently return.
 *
 * Note: this is complementary to the `yarn lint:all` (`biome lint .`) CI step,
 * which is the broader safety net catching errors in non-workspace files too.
 */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');

/** Expand the simple `dir/*` workspace globs used in the root package.json. */
function resolveWorkspaceDirs(patterns) {
  const dirs = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const parent = path.join(repoRoot, pattern.slice(0, -2));
      if (!fs.existsSync(parent)) {
        continue;
      }
      for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          dirs.push(path.join(parent, entry.name));
        }
      }
    } else {
      dirs.push(path.join(repoRoot, pattern));
    }
  }
  return dirs;
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const workspacePatterns = rootPkg.workspaces ?? [];

const missing = [];
let checked = 0;

for (const dir of resolveWorkspaceDirs(workspacePatterns)) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    continue;
  }
  checked += 1;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts || typeof pkg.scripts.lint !== 'string') {
    missing.push(pkg.name ?? path.relative(repoRoot, dir));
  }
}

if (missing.length > 0) {
  console.error(`✖ Lint coverage gap: ${missing.length} workspace(s) missing a "lint" script:\n`);
  for (const name of missing.sort()) {
    console.error(`  - ${name}`);
  }
  console.error('\nAdd to the package.json scripts:');
  console.error('  "lint": "node ../../tooling/scripts/run-biome.js lint ."');
  process.exit(1);
}

console.log(`✓ Lint coverage OK — all ${checked} workspaces define a "lint" script.`);
