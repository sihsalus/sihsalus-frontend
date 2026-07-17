const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HASH_LENGTH = 16;

function getContentAddressedEntryName(entryFileName, contents) {
  if (path.basename(entryFileName) !== entryFileName) {
    throw new Error(`Entry filename must not contain a directory: ${entryFileName}`);
  }

  const extension = path.extname(entryFileName);
  if (!extension) {
    throw new Error(`Entry filename must have an extension: ${entryFileName}`);
  }

  const stem = entryFileName.slice(0, -extension.length);
  const digest = crypto.createHash('sha256').update(contents).digest('hex').slice(0, HASH_LENGTH);
  return `${stem}.${digest}${extension}`;
}

function copyContentAddressedEntry(sourcePath, outputDirectory, entryFileName = path.basename(sourcePath)) {
  const contents = fs.readFileSync(sourcePath);
  const addressedFileName = getContentAddressedEntryName(entryFileName, contents);
  fs.copyFileSync(sourcePath, path.join(outputDirectory, addressedFileName));
  return addressedFileName;
}

module.exports = {
  HASH_LENGTH,
  copyContentAddressedEntry,
  getContentAddressedEntryName,
};
