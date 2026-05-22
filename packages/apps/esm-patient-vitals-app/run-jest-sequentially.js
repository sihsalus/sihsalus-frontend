const { spawnSync } = require('node:child_process');

const vitestBin = require.resolve('vitest/vitest.mjs');
const args = process.argv.slice(2);
const baseArgs = ['run', '--config', 'vitest.config.js', '--reporter', 'verbose', '--color'];

function runVitest(extraArgs, options = {}) {
  return spawnSync(process.execPath, [vitestBin, ...baseArgs, ...extraArgs], {
    stdio: options.captureStdout ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: options.captureStdout ? 'utf8' : undefined,
    env: { ...process.env, TZ: 'UTC' },
  });
}

if (args.length > 0) {
  const result = runVitest(args);
  process.exit(result.status ?? 1);
}

const listTestsResult = runVitest(['--list'], { captureStdout: true });

if (listTestsResult.status !== 0) {
  process.exit(listTestsResult.status ?? 1);
}

const tests = listTestsResult.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

if (tests.length === 0) {
  process.exit(0);
}

for (const testFile of tests) {
  const result = runVitest([testFile]);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
