#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { dirname, resolve } = require('node:path');
const { performance } = require('node:perf_hooks');

const repoRoot = resolve(__dirname, '../../..');
const compilers = [
  { name: 'TypeScript 6', packageName: 'typescript', executable: 'bin/tsc6' },
  { name: 'TypeScript 7', packageName: '@typescript/native', executable: 'bin/tsc' },
];
const workspaces = [
  'packages/apps/esm-atencion-ambulatoria-app',
  'packages/apps/esm-stock-management-app',
  'packages/libs/esm-patient-common-lib',
];

// Build workspace dependencies first. Both compilers check the same final source
// and config; no Turbo cache, incremental state, emission, or concurrent benchmark.
const args = ['--project', 'tsconfig.json', '--noEmit', '--incremental', 'false', '--pretty', 'false'];
const results = [];
for (const workspace of workspaces) {
  const samples = compilers.map(() => []);
  for (let round = 0; round < 4; round++) {
    // Discard one warm-up per compiler; alternate order in the measured rounds.
    for (const index of round % 2 ? [1, 0] : [0, 1]) {
      const compiler = compilers[index];
      const executable = resolve(dirname(require.resolve(`${compiler.packageName}/package.json`)), compiler.executable);
      const started = performance.now();
      const result = spawnSync(process.execPath, [executable, ...args], {
        cwd: resolve(repoRoot, workspace),
        encoding: 'utf8',
        timeout: 120_000,
      });
      const elapsed = performance.now() - started;
      if (result.error || result.status !== 0) {
        console.error(`${workspace}: ${compiler.name} failed; no speedup will be reported.`);
        console.error(result.error || `${result.stdout}\n${result.stderr}`);
        process.exit(1);
      }
      if (round > 0) samples[index].push(elapsed);
    }
  }
  const medians = samples.map((values) => [...values].sort((a, b) => a - b)[1]);
  results.push({ workspace, milliseconds: samples, medianMilliseconds: medians, speedup: medians[0] / medians[1] });
  console.log(
    `${workspace}: ${medians[0].toFixed(0)} ms → ${medians[1].toFixed(0)} ms (${(medians[0] / medians[1]).toFixed(2)}×)`,
  );
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      typescript6: require('typescript').version,
      typescript7: require('@typescript/native/package.json').version,
      results,
    },
    null,
    2,
  ),
);
