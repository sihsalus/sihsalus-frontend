const { existsSync } = require('node:fs');

function findMissingSpaArtifacts(artifactPaths, fileExists = existsSync) {
  return artifactPaths.filter((artifactPath) => !fileExists(artifactPath));
}

module.exports = { findMissingSpaArtifacts };
