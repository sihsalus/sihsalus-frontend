#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const corePackageDirs = [
  'packages/libs/esm-api',
  'packages/libs/esm-config',
  'packages/libs/esm-dynamic-loading',
  'packages/libs/esm-emr-api',
  'packages/libs/esm-error-handling',
  'packages/libs/esm-expression-evaluator',
  'packages/libs/esm-extensions',
  'packages/libs/esm-feature-flags',
  'packages/libs/esm-framework',
  'packages/libs/esm-globals',
  'packages/libs/esm-navigation',
  'packages/libs/esm-offline',
  'packages/libs/esm-react-utils',
  'packages/libs/esm-routes',
  'packages/libs/esm-state',
  'packages/libs/esm-translations',
  'packages/libs/esm-utils',
];

const corePackages = corePackageDirs.map((relativeDir) => {
  const packageJsonPath = path.join(repoRoot, relativeDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json for ${relativeDir}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.name) {
    throw new Error(`Missing package name in ${relativeDir}/package.json`);
  }

  return packageJson.name;
});

run('yarn', ['biome', 'check', ...corePackageDirs]);

const turboArgs = ['turbo', 'run', 'build', 'test', '--concurrency=1'];
corePackages.forEach((packageName) => {
  turboArgs.push('--filter', packageName);
});

run('yarn', turboArgs);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
