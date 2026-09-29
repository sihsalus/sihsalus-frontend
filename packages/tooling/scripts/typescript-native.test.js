const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const test = require('node:test');

const repoRoot = resolve(__dirname, '../../..');
const nativePackage = require('@typescript/native/package.json');
const nativeCompiler = resolve(dirname(require.resolve('@typescript/native/package.json')), nativePackage.bin.tsc);

test('native compiler rejects an invalid assignment and accepts the corrected source', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sihsalus-native-types-'));
  try {
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          types: [],
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
        files: ['fixture.ts'],
      }),
    );
    for (const [source, expectedStatus] of [
      ['const count: number = "invalid";', 1],
      ['const count: number = 1;', 0],
    ]) {
      writeFileSync(join(directory, 'fixture.ts'), source);
      const result = spawnSync(process.execPath, [nativeCompiler, '--project', directory, '--pretty', 'false'], {
        encoding: 'utf8',
        timeout: 30_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, expectedStatus, result.stdout + result.stderr);
      if (expectedStatus !== 0) assert.match(result.stdout, /TS2322/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Yarn exposes the native compiler in application, library and CLI workspaces', () => {
  const { packageManager } = require('../../../package.json');
  const yarnVersion = packageManager.replace('yarn@', '');
  const yarn = join(repoRoot, '.yarn/releases', `yarn-${yarnVersion}.cjs`);
  for (const workspace of ['@sihsalus/esm-emergency-app', '@openmrs/esm-patient-common-lib', 'openmrs']) {
    const result = spawnSync(process.execPath, [yarn, 'workspace', workspace, 'exec', 'tsc', '--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout.trim(), `Version ${nativePackage.version}`, workspace);
  }
});
