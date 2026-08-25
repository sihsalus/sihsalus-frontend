const fs = require('node:fs');
const path = require('node:path');

const spaArtifactManifest = Object.freeze([
  Object.freeze({ file: 'index.html', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({
    file: 'sihsalus-error-ui.js',
    roles: Object.freeze(['startup', 'complete', 'precacheRevision']),
  }),
  Object.freeze({
    file: 'sihsalus-spa-bootstrap.js',
    roles: Object.freeze(['startup', 'complete', 'precacheRevision']),
  }),
  Object.freeze({ file: 'favicon.ico', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'routes.registry.json', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({ file: 'importmap.json', roles: Object.freeze(['startup', 'complete', 'precacheRevision']) }),
  Object.freeze({ file: 'frontend.json', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'service-worker.js', roles: Object.freeze(['complete']) }),
  Object.freeze({ file: 'manifest.webmanifest', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'alternative-logo.png', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'app-shell-build-info.json', roles: Object.freeze(['complete', 'precacheRevision']) }),
  Object.freeze({ file: 'assembled-precache-revisions.json', roles: Object.freeze(['complete']) }),
]);

const spaArtifactRoles = new Set(spaArtifactManifest.flatMap(({ roles }) => roles));

function getSpaArtifactFiles(role) {
  if (!spaArtifactRoles.has(role)) {
    throw new Error(`Unknown SPA artifact role: ${role}`);
  }

  return spaArtifactManifest.filter(({ roles }) => roles.includes(role)).map(({ file }) => file);
}

function getHtmlAttribute(tag, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

/**
 * Returns root-level local stylesheets linked by the assembled index. The app
 * shell emits these files beside index.html, even when the public href contains
 * the full SPA path.
 */
function getLinkedLocalStylesheetFiles(indexHtml) {
  if (typeof indexHtml !== 'string' || indexHtml.length === 0) {
    return [];
  }

  const files = [];
  for (const [tag] of indexHtml.matchAll(/<link\b[^>]*>/gi)) {
    const rel = getHtmlAttribute(tag, 'rel');
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === 'stylesheet')) {
      continue;
    }

    const href = getHtmlAttribute(tag, 'href');
    if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
      continue;
    }

    const pathname = href.split(/[?#]/, 1)[0].replace(/\\/g, '/');
    const file = path.posix.basename(pathname);
    if (file && file.toLowerCase().endsWith('.css')) {
      files.push(file);
    }
  }

  return [...new Set(files)];
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
  getLinkedLocalStylesheetFiles,
  getSpaArtifactFiles,
  inspectSpaArtifacts,
  spaArtifactManifest,
};
