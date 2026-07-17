const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HASH_LENGTH,
  copyContentAddressedBuildManifest,
  copyContentAddressedEntry,
  getContentAddressedBuildManifestIssues,
  getContentAddressedEntryName,
  rewriteBuildManifestEntry,
} = require('./content-addressed-entry');

test('derives a deterministic content-addressed JavaScript filename', () => {
  const first = getContentAddressedEntryName('openmrs-esm-example.js', Buffer.from('first build'));
  const repeated = getContentAddressedEntryName('openmrs-esm-example.js', Buffer.from('first build'));
  const changed = getContentAddressedEntryName('openmrs-esm-example.js', Buffer.from('second build'));

  assert.equal(first, repeated);
  assert.notEqual(first, changed);
  assert.match(first, new RegExp(`^openmrs-esm-example\\.[a-f0-9]{${HASH_LENGTH}}\\.js$`));
});

test('copies the entry under the content-addressed name without changing its bytes', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-entry-'));
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }));

  const sourcePath = path.join(temporaryDirectory, 'openmrs-esm-example.js');
  const outputDirectory = path.join(temporaryDirectory, 'spa');
  const contents = Buffer.from('window.example = true;');
  fs.mkdirSync(outputDirectory);
  fs.writeFileSync(sourcePath, contents);

  const addressedFileName = copyContentAddressedEntry(sourcePath, outputDirectory);

  assert.deepEqual(fs.readFileSync(path.join(outputDirectory, addressedFileName)), contents);
});

test('rejects entry names that could escape the output directory', () => {
  assert.throws(
    () => getContentAddressedEntryName('../openmrs-esm-example.js', Buffer.from('unsafe')),
    /must not contain a directory/,
  );
});

test('publishes the offline build manifest under the addressed entry and rewrites the cached entry', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-manifest-'));
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }));

  const outputDirectory = path.join(temporaryDirectory, 'spa');
  const sourceManifestPath = path.join(temporaryDirectory, 'openmrs-esm-example.js.buildmanifest.json');
  const stableEntryFileName = 'openmrs-esm-example.js';
  const addressedEntryFileName = 'openmrs-esm-example.0123456789abcdef.js';
  const chunkFileName = 'esm-example-main-a1b2c3d4.js';
  const sourceManifest = {
    chunks: [
      { entry: true, files: [stableEntryFileName] },
      { entry: true, files: [chunkFileName] },
    ],
  };
  fs.mkdirSync(outputDirectory);
  fs.writeFileSync(sourceManifestPath, JSON.stringify(sourceManifest));
  fs.writeFileSync(path.join(outputDirectory, addressedEntryFileName), 'entry');
  fs.writeFileSync(path.join(outputDirectory, chunkFileName), 'chunk');

  const manifestName = copyContentAddressedBuildManifest(
    sourceManifestPath,
    outputDirectory,
    stableEntryFileName,
    addressedEntryFileName,
  );
  const addressedManifest = JSON.parse(fs.readFileSync(path.join(outputDirectory, manifestName), 'utf8'));

  assert.equal(manifestName, `${addressedEntryFileName}.buildmanifest.json`);
  assert.deepEqual(addressedManifest.chunks[0].files, [addressedEntryFileName]);
  assert.deepEqual(addressedManifest.chunks[1].files, [chunkFileName]);
  assert.deepEqual(getContentAddressedBuildManifestIssues(outputDirectory, addressedEntryFileName), []);
});

test('rejects a build manifest that does not reference the stable entry', () => {
  assert.throws(
    () =>
      rewriteBuildManifestEntry(
        { chunks: [{ entry: true, files: ['other.js'] }] },
        'openmrs-esm-example.js',
        'openmrs-esm-example.0123456789abcdef.js',
      ),
    /does not reference its entry file/,
  );
});

test('reports missing offline manifests, addressed entries, and chunks', (t) => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-manifest-validation-'));
  t.after(() => fs.rmSync(temporaryDirectory, { force: true, recursive: true }));

  const addressedEntryFileName = 'openmrs-esm-example.0123456789abcdef.js';
  assert.deepEqual(getContentAddressedBuildManifestIssues(temporaryDirectory, addressedEntryFileName), [
    `content-addressed build manifest does not exist: ${addressedEntryFileName}.buildmanifest.json`,
  ]);

  fs.writeFileSync(
    path.join(temporaryDirectory, `${addressedEntryFileName}.buildmanifest.json`),
    JSON.stringify({ chunks: [{ files: ['missing-chunk.js'] }] }),
  );
  assert.deepEqual(getContentAddressedBuildManifestIssues(temporaryDirectory, addressedEntryFileName), [
    `content-addressed build manifest does not include its entry: ${addressedEntryFileName}.buildmanifest.json`,
    'content-addressed build manifest target does not exist: missing-chunk.js',
  ]);
});
