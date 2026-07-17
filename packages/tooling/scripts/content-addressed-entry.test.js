const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { HASH_LENGTH, copyContentAddressedEntry, getContentAddressedEntryName } = require('./content-addressed-entry');

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
