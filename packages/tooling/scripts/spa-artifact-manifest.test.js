const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  formatSpaArtifactIssue,
  getSpaArtifactFiles,
  inspectSpaArtifacts,
  spaArtifactManifest,
} = require('./spa-artifact-manifest');

test('defines the startup, complete, and precache artifact contracts centrally', () => {
  assert.deepEqual(getSpaArtifactFiles('startup'), ['index.html', 'routes.registry.json', 'importmap.json']);
  assert.deepEqual(getSpaArtifactFiles('complete'), [
    'index.html',
    'favicon.ico',
    'routes.registry.json',
    'importmap.json',
    'frontend.json',
    'service-worker.js',
    'manifest.webmanifest',
    'alternative-logo.png',
    'app-shell-build-info.json',
    'assembled-precache-revisions.json',
  ]);
  assert.deepEqual(getSpaArtifactFiles('precacheRevision'), [
    'index.html',
    'favicon.ico',
    'routes.registry.json',
    'importmap.json',
    'frontend.json',
    'manifest.webmanifest',
    'alternative-logo.png',
    'app-shell-build-info.json',
  ]);
});

test('keeps artifact names unique and inside the SPA output directory', () => {
  const files = spaArtifactManifest.map(({ file }) => file);

  assert.equal(new Set(files).size, files.length);
  for (const file of files) {
    assert.equal(path.basename(file), file);
  }
});

test('keeps startup and precache artifacts within the complete artifact contract', () => {
  const completeFiles = new Set(getSpaArtifactFiles('complete'));

  for (const role of ['startup', 'precacheRevision']) {
    assert.equal(
      getSpaArtifactFiles(role).every((file) => completeFiles.has(file)),
      true,
    );
  }
});

test('rejects unknown artifact roles', () => {
  assert.throws(() => getSpaArtifactFiles('unknown'), /Unknown SPA artifact role/);
});

test('reports missing, non-file, empty, and unreadable artifacts together', (context) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-spa-artifacts-'));
  context.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

  fs.writeFileSync(path.join(outDir, 'index.html'), '<html></html>');
  fs.mkdirSync(path.join(outDir, 'routes.registry.json'));
  fs.writeFileSync(path.join(outDir, 'importmap.json'), '');

  const unreadableError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
  const fileSystem = {
    statSync(filePath) {
      if (filePath.endsWith('frontend.json')) {
        throw unreadableError;
      }
      return fs.statSync(filePath);
    },
    accessSync(filePath, mode) {
      if (filePath.endsWith('index.html')) {
        throw unreadableError;
      }
      fs.accessSync(filePath, mode);
    },
  };

  const issues = inspectSpaArtifacts(outDir, 'complete', fileSystem);

  assert.deepEqual(
    issues.map(({ file, reason }) => ({ file, reason })),
    [
      { file: 'index.html', reason: 'unreadable' },
      { file: 'favicon.ico', reason: 'missing' },
      { file: 'routes.registry.json', reason: 'not-file' },
      { file: 'importmap.json', reason: 'empty' },
      { file: 'frontend.json', reason: 'unreadable' },
      { file: 'service-worker.js', reason: 'missing' },
      { file: 'manifest.webmanifest', reason: 'missing' },
      { file: 'alternative-logo.png', reason: 'missing' },
      { file: 'app-shell-build-info.json', reason: 'missing' },
      { file: 'assembled-precache-revisions.json', reason: 'missing' },
    ],
  );
  assert.match(formatSpaArtifactIssue(issues[0]), /permission denied/);
  assert.match(formatSpaArtifactIssue(issues[1]), /Missing required file/);
  assert.match(formatSpaArtifactIssue(issues[2]), /not a file/);
  assert.match(formatSpaArtifactIssue(issues[3]), /is empty/);
  assert.match(formatSpaArtifactIssue(issues[4]), /permission denied/);
});
