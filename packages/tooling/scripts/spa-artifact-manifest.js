const fs = require('node:fs');
const path = require('node:path');

const spaArtifactManifest = Object.freeze([
  Object.freeze({ file: 'index.html', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({ file: 'favicon.ico', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'routes.registry.json', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({ file: 'importmap.json', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({ file: 'frontend.json', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'service-worker.js', roles: Object.freeze(['complete']) }),
  Object.freeze({ file: 'app-shell-runtime-patches.json', roles: Object.freeze(['complete']) }),
]);

const spaArtifactRoles = new Set(spaArtifactManifest.flatMap(({ roles }) => roles));

function getSpaArtifactFiles(role) {
  if (!spaArtifactRoles.has(role)) {
    throw new Error(`Unknown SPA artifact role: ${role}`);
  }

  return spaArtifactManifest.filter(({ roles }) => roles.includes(role)).map(({ file }) => file);
}

function inspectSpaArtifacts(outDir, role, fileSystem = fs) {
  const issues = [];

  for (const file of getSpaArtifactFiles(role)) {
    const filePath = path.join(outDir, file);
    let stat;

    try {
      stat = fileSystem.statSync(filePath);
    } catch (error) {
      issues.push({
        file,
        filePath,
        reason: error?.code === 'ENOENT' ? 'missing' : 'unreadable',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (!stat.isFile()) {
      issues.push({ file, filePath, reason: 'not-file' });
    } else if (stat.size === 0) {
      issues.push({ file, filePath, reason: 'empty' });
    } else {
      try {
        fileSystem.accessSync(filePath, fs.constants.R_OK);
      } catch (error) {
        issues.push({
          file,
          filePath,
          reason: 'unreadable',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return issues;
}

function formatSpaArtifactIssue({ filePath, reason, detail }) {
  switch (reason) {
    case 'missing':
      return `Missing required file: ${filePath}`;
    case 'not-file':
      return `Required path is not a file: ${filePath}`;
    case 'empty':
      return `Required file is empty: ${filePath}`;
    default:
      return `Required file cannot be read: ${filePath}${detail ? ` (${detail})` : ''}`;
  }
}

module.exports = {
  formatSpaArtifactIssue,
  getSpaArtifactFiles,
  inspectSpaArtifacts,
  spaArtifactManifest,
};
