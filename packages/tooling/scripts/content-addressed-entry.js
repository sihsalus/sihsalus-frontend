const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HASH_LENGTH = 16;

function assertFileName(fileName, label) {
  if (path.basename(fileName) !== fileName) {
    throw new Error(`${label} must not contain a directory: ${fileName}`);
  }
}

function getContentAddressedEntryName(entryFileName, contents) {
  assertFileName(entryFileName, 'Entry filename');

  const extension = path.extname(entryFileName);
  if (!extension) {
    throw new Error(`Entry filename must have an extension: ${entryFileName}`);
  }

  const stem = entryFileName.slice(0, -extension.length);
  const digest = crypto.createHash('sha256').update(contents).digest('hex').slice(0, HASH_LENGTH);
  return `${stem}.${digest}${extension}`;
}

function rewriteBuildManifestEntry(buildManifest, entryFileName, addressedEntryFileName) {
  assertFileName(entryFileName, 'Entry filename');
  assertFileName(addressedEntryFileName, 'Content-addressed entry filename');

  if (!buildManifest || typeof buildManifest !== 'object' || !Array.isArray(buildManifest.chunks)) {
    throw new Error('Build manifest must contain a chunks array');
  }

  let replacements = 0;
  const chunks = buildManifest.chunks.map((chunk) => {
    if (!chunk || typeof chunk !== 'object' || !Array.isArray(chunk.files)) {
      return chunk;
    }

    return {
      ...chunk,
      files: chunk.files.map((file) => {
        if (file === entryFileName) {
          replacements += 1;
          return addressedEntryFileName;
        }
        return file;
      }),
    };
  });

  if (replacements === 0) {
    throw new Error(`Build manifest does not reference its entry file: ${entryFileName}`);
  }

  return { ...buildManifest, chunks };
}

function copyContentAddressedEntry(sourcePath, outputDirectory, entryFileName = path.basename(sourcePath)) {
  const contents = fs.readFileSync(sourcePath);
  const addressedFileName = getContentAddressedEntryName(entryFileName, contents);
  fs.copyFileSync(sourcePath, path.join(outputDirectory, addressedFileName));
  return addressedFileName;
}

function copyContentAddressedBuildManifest(sourcePath, outputDirectory, entryFileName, addressedEntryFileName) {
  const buildManifest = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const addressedBuildManifest = rewriteBuildManifestEntry(buildManifest, entryFileName, addressedEntryFileName);
  const addressedBuildManifestName = `${addressedEntryFileName}.buildmanifest.json`;

  fs.writeFileSync(
    path.join(outputDirectory, addressedBuildManifestName),
    `${JSON.stringify(addressedBuildManifest, null, 2)}\n`,
  );
  return addressedBuildManifestName;
}

function getContentAddressedBuildManifestIssues(outputDirectory, addressedEntryFileName) {
  assertFileName(addressedEntryFileName, 'Content-addressed entry filename');
  const outputRoot = path.resolve(outputDirectory);
  const manifestName = `${addressedEntryFileName}.buildmanifest.json`;
  const manifestPath = path.join(outputRoot, manifestName);

  if (!fs.existsSync(manifestPath)) {
    return [`content-addressed build manifest does not exist: ${manifestName}`];
  }

  let buildManifest;
  try {
    buildManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return [`content-addressed build manifest is invalid: ${manifestName}: ${error.message}`];
  }

  if (!buildManifest || typeof buildManifest !== 'object' || !Array.isArray(buildManifest.chunks)) {
    return [`content-addressed build manifest has no chunks array: ${manifestName}`];
  }

  const files = buildManifest.chunks.flatMap((chunk) => (Array.isArray(chunk?.files) ? chunk.files : []));
  const issues = [];
  if (!files.includes(addressedEntryFileName)) {
    issues.push(`content-addressed build manifest does not include its entry: ${manifestName}`);
  }

  for (const file of files) {
    if (typeof file !== 'string' || file.length === 0) {
      issues.push(`content-addressed build manifest contains an invalid file reference: ${manifestName}`);
      continue;
    }

    const resolvedFile = path.resolve(outputRoot, file);
    if (!resolvedFile.startsWith(outputRoot + path.sep) && resolvedFile !== outputRoot) {
      issues.push(`content-addressed build manifest path escapes output directory: ${file}`);
    } else if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
      issues.push(`content-addressed build manifest target does not exist: ${file}`);
    }
  }

  return issues;
}

module.exports = {
  HASH_LENGTH,
  copyContentAddressedBuildManifest,
  copyContentAddressedEntry,
  getContentAddressedBuildManifestIssues,
  getContentAddressedEntryName,
  rewriteBuildManifestEntry,
};
