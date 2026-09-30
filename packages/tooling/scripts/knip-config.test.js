const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');

test('Knip finds unused code while tracing lazy and require.context entries without executing build factories', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sihsalus-knip-'));
  const app = path.join(directory, 'packages/apps/example');
  try {
    mkdirSync(path.join(app, 'src/panels'), { recursive: true });
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true, workspaces: ['packages/apps/*'] }),
    );
    writeFileSync(path.join(directory, 'knip.json'), readFileSync(path.join(repositoryRoot, 'knip.json')));
    writeFileSync(
      path.join(app, 'package.json'),
      JSON.stringify({ name: 'example', dependencies: { '@rspack/core': '*' } }),
    );
    writeFileSync(
      path.join(app, 'rspack.config.js'),
      'module.exports = () => { throw new Error("Build factories must run only in their workspace"); };',
    );
    writeFileSync(
      path.join(app, 'src/index.ts'),
      'export const lazy = () => import("./lazy"); export const panels = require.context("./panels", false, /\\.ts$/);',
    );
    writeFileSync(path.join(app, 'src/lazy.ts'), 'export default "lazy";');
    writeFileSync(path.join(app, 'src/panels/active.ts'), 'export default "active";');
    writeFileSync(path.join(app, 'src/unused.ts'), 'export default "unused";');

    const result = spawnSync(
      process.execPath,
      [path.join(repositoryRoot, 'node_modules/knip/bin/knip.js'), '--reporter', 'json', '--include', 'files'],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 30000,
      },
    );
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    const unused = report.issues.flatMap((issue) => issue.files.map((file) => file.name));
    assert.deepEqual(unused, ['packages/apps/example/src/unused.ts']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
