const test = require('node:test');
const assert = require('node:assert/strict');

const { checkFormatting, getChangedFiles, parseArgs, selectScssFiles } = require('./validate-scss-format');

test('parses comparison and staged modes', () => {
  assert.deepEqual(parseArgs(['--base', 'origin/main', '--head', 'HEAD']), {
    base: 'origin/main',
    head: 'HEAD',
    staged: false,
    help: false,
  });
  assert.equal(parseArgs(['--staged']).staged, true);
});

test('rejects missing values, unknown flags, and conflicting modes', () => {
  assert.throws(() => parseArgs(['--base']), /Missing value/);
  assert.throws(() => parseArgs(['--unknown']), /Unknown argument/);
  assert.throws(() => parseArgs(['--staged', '--head', 'HEAD']), /cannot be combined/);
});

test('asks git only for changed files that still have content', () => {
  const calls = [];
  const spawn = (command, args) => {
    calls.push([command, args]);
    return { status: 0, stdout: 'src/new.scss\0src/with newline\n.scss\0', stderr: '' };
  };

  const files = getChangedFiles(parseArgs(['--base', 'origin/main', '--head', 'HEAD']), spawn);

  assert.deepEqual(calls, [['git', ['diff', '--name-only', '--diff-filter=ACMR', '-z', 'origin/main...HEAD']]]);
  assert.deepEqual(files, ['src/new.scss', 'src/with newline\n.scss']);
});

test('compares an initial push against the empty Git tree', () => {
  const calls = [];
  getChangedFiles(parseArgs(['--base', '0000000000', '--head', 'HEAD']), (command, args) => {
    calls.push([command, args]);
    return { status: 0, stdout: '', stderr: '' };
  });

  assert.deepEqual(calls, [
    ['git', ['diff', '--name-only', '--diff-filter=ACMR', '-z', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD']],
  ]);
});

test('selects existing SCSS files deterministically', () => {
  const existing = new Set(['/repo/src/a.scss', '/repo/src/b.SCSS']);
  const files = selectScssFiles(['src/z.ts', 'src/b.SCSS', 'src/deleted.scss', 'src/a.scss'], (file) =>
    existing.has(file.replace(/^.*\/sihsalus-frontend/, '/repo')),
  );

  assert.deepEqual(files, ['src/a.scss', 'src/b.SCSS']);
});

test('passes exact changed paths to Prettier check mode', () => {
  const calls = [];
  const status = checkFormatting(['src/a.scss', 'src/with spaces.scss'], (command, args) => {
    calls.push([command, args]);
    return { status: 0 };
  });

  assert.equal(status, 0);
  assert.deepEqual(calls, [['yarn', ['exec', 'prettier', '--check', '--', 'src/a.scss', 'src/with spaces.scss']]]);
});
