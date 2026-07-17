#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const chalk = require('chalk');
const { findInvalidWebpackShareScopeReferences, findUnboundReactReferences } = require('./javascript-runtime-contract');
const { formatSpaArtifactIssue, getSpaArtifactFiles, inspectSpaArtifacts } = require('./spa-artifact-manifest');

const logInfo = (msg) => console.log(`${chalk.green.bold('[validate-spa]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[validate-spa]')} ${chalk.yellow(msg)}`);
const logFail = (msg) => console.error(`${chalk.red.bold('[validate-spa]')} ${chalk.red(msg)}`);

const outDir = process.env.SPA_OUTPUT_DIR || 'dist/spa';
const assembleConfigPath = process.env.SPA_ASSEMBLE_CONFIG || 'config/spa-assemble-config.json';
let failed = false;

function fail(message) {
  failed = true;
  logFail(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${filePath}: ${error.message}`);
    return null;
  }
}

logInfo(`Validating ${outDir}`);

if (!fs.existsSync(outDir)) {
  fail(`SPA output directory does not exist: ${outDir}`);
  process.exit(1);
}

const requiredArtifactIssues = inspectSpaArtifacts(outDir, 'complete');
const invalidRequiredArtifacts = new Set(requiredArtifactIssues.map(({ file }) => file));
for (const issue of requiredArtifactIssues) {
  fail(formatSpaArtifactIssue(issue));
}

const importmapPath = path.join(outDir, 'importmap.json');
const routesPath = path.join(outDir, 'routes.registry.json');
const importmap = invalidRequiredArtifacts.has('importmap.json') ? null : readJson(importmapPath);
const routesRegistry = invalidRequiredArtifacts.has('routes.registry.json') ? null : readJson(routesPath);

const imports = importmap?.imports || {};
const routes = routesRegistry || {};

if (Object.keys(imports).length === 0) {
  fail('importmap.json has no imports');
}

if (Object.keys(routes).length === 0) {
  fail('routes.registry.json has no routes');
}

if (fs.existsSync(assembleConfigPath)) {
  const assembleConfig = readJson(assembleConfigPath);
  const expectedModules = Object.keys(assembleConfig?.frontendModules || {});
  const missingModules = expectedModules.filter((name) => !imports[name]);

  if (missingModules.length > 0) {
    fail(`${missingModules.length} expected module(s) missing from importmap.json:`);
    for (const name of missingModules) {
      logFail(`  - ${name}`);
    }
  } else {
    logInfo(`All ${expectedModules.length} expected module(s) are present in importmap.json`);
  }
} else {
  logWarn(`Assemble config not found: ${assembleConfigPath}; skipping expected-module validation`);
}

for (const [moduleName, bundlePath] of Object.entries(imports)) {
  if (typeof bundlePath !== 'string' || bundlePath.length === 0) {
    fail(`${moduleName}: importmap entry is empty`);
    continue;
  }

  if (/^https?:\/\//.test(bundlePath)) {
    continue;
  }

  const relativePath = bundlePath.replace(/^\.\//, '');
  const resolvedPath = path.resolve(outDir, relativePath);
  const outputRoot = path.resolve(outDir);

  if (!resolvedPath.startsWith(outputRoot + path.sep) && resolvedPath !== outputRoot) {
    fail(`${moduleName}: importmap path escapes output directory: ${bundlePath}`);
    continue;
  }

  if (!fs.existsSync(resolvedPath)) {
    fail(`${moduleName}: importmap target does not exist: ${bundlePath}`);
    continue;
  }

  // Root-level workspace remotes are rebuilt in place on every release. Their
  // import-map target must therefore be content-addressed; otherwise a browser
  // or proxy can retain an old remote that points at chunks no longer present.
  if (!relativePath.includes('/') && relativePath.endsWith('.js')) {
    const contentAddress = relativePath.match(/\.([a-f0-9]{16})\.js$/)?.[1];
    if (!contentAddress) {
      fail(`${moduleName}: root JavaScript importmap target is not content-addressed: ${bundlePath}`);
      continue;
    }

    const actualDigest = crypto.createHash('sha256').update(fs.readFileSync(resolvedPath)).digest('hex');
    if (!actualDigest.startsWith(contentAddress)) {
      fail(`${moduleName}: importmap content address does not match bundle bytes: ${bundlePath}`);
    }
  }
}

const modulesWithoutRoutes = Object.keys(imports).filter((name) => !routes[name]);
if (modulesWithoutRoutes.length > 0) {
  logWarn(`${modulesWithoutRoutes.length} module(s) have no route registration:`);
  for (const name of modulesWithoutRoutes) {
    logWarn(`  - ${name}`);
  }
}

const appShellJavaScriptFiles = fs
  .readdirSync(outDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => ({
    name: entry.name,
    source: fs.readFileSync(path.join(outDir, entry.name), 'utf8'),
  }));
const appShellJavaScript = appShellJavaScriptFiles.map(({ source }) => source).join('\n');

for (const { name, source } of appShellJavaScriptFiles) {
  try {
    const unboundReactReferences = findUnboundReactReferences(source);
    if (unboundReactReferences.length > 0) {
      fail(`${name} contains ${unboundReactReferences.length} unresolved React global reference(s)`);
    }
    const invalidShareScopeReferences = findInvalidWebpackShareScopeReferences(source);
    if (invalidShareScopeReferences.length > 0) {
      fail(`${name} contains ${invalidShareScopeReferences.length} unresolved Webpack share scope reference(s)`);
    }
  } catch (error) {
    fail(`${name} could not be checked for unresolved runtime globals: ${error.message}`);
  }
}

const forbiddenAppShellCopy = [
  'Offline Setup Error',
  'Oops! An unexpected error occurred.',
  'Oops! An unhandled promise rejection occurred.',
  'No additional information available.',
];
for (const text of forbiddenAppShellCopy) {
  if (appShellJavaScript.includes(text)) {
    fail(`Source-built app shell still exposes technical copy: ${text}`);
  }
}

const requiredSafeAppShellMarkers = [
  'Modo sin conexión no disponible',
  'Offline setup unavailable',
  'Ocurrió un error inesperado.',
  'An unexpected error occurred.',
  'No se pudo iniciar la aplicación. Intente recargar la página o contacte a soporte.',
  'The application could not start. Try reloading the page or contact support.',
];
for (const marker of requiredSafeAppShellMarkers) {
  if (!appShellJavaScript.includes(marker)) {
    fail(`Source-built app shell is missing required safe error handling: ${marker}`);
  }
}

function parseWorkboxPrecacheEntries(serviceWorker) {
  const entryPattern =
    /\{\s*['"]revision['"]\s*:\s*(null|['"]([^'"]*)['"])\s*,\s*['"]url['"]\s*:\s*['"]([^'"]+)['"]\s*\}/g;

  return [...serviceWorker.matchAll(entryPattern)].map((match) => ({
    revision: match[1] === 'null' ? null : match[2],
    url: match[3],
  }));
}

function getPrecacheFileName(url) {
  return path.posix.basename(url.split(/[?#]/, 1)[0]);
}

const revisionManifestPath = path.join(outDir, 'assembled-precache-revisions.json');
const serviceWorkerPath = path.join(outDir, 'service-worker.js');
const revisionManifest = invalidRequiredArtifacts.has('assembled-precache-revisions.json')
  ? null
  : readJson(revisionManifestPath);
const serviceWorker = invalidRequiredArtifacts.has('service-worker.js')
  ? ''
  : fs.readFileSync(serviceWorkerPath, 'utf8');
const workboxEntries = parseWorkboxPrecacheEntries(serviceWorker);
const requiredRevisionFiles = getSpaArtifactFiles('precacheRevision');

if (workboxEntries.length === 0) {
  fail('service-worker.js does not contain a recognizable Workbox precache manifest');
}

if (
  !revisionManifest ||
  revisionManifest.schemaVersion !== 1 ||
  revisionManifest.algorithm !== 'sha256' ||
  !Array.isArray(revisionManifest.files)
) {
  fail('assembled-precache-revisions.json does not match the required schema');
} else {
  const manifestFiles = revisionManifest.files;
  const seenFiles = new Set();
  const seenUrls = new Set();

  for (const entry of manifestFiles) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('assembled-precache-revisions.json contains a non-object file entry');
      continue;
    }

    const { file, url, revision, sha256 } = entry;
    if (
      typeof file !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(file) ||
      path.basename(file) !== file ||
      typeof url !== 'string' ||
      url !== file ||
      typeof revision !== 'string' ||
      !/^sihsalus-[a-f0-9]{16}$/.test(revision) ||
      typeof sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(sha256)
    ) {
      fail('assembled-precache-revisions.json contains an invalid file entry');
      continue;
    }

    if (seenFiles.has(file) || seenUrls.has(url)) {
      fail(`assembled-precache-revisions.json contains a duplicate entry: ${file}`);
      continue;
    }
    seenFiles.add(file);
    seenUrls.add(url);

    const bundlePath = path.join(outDir, file);
    if (!fs.existsSync(bundlePath) || !fs.statSync(bundlePath).isFile()) {
      fail(`Revisioned assembled file is missing: ${file}`);
      continue;
    }

    const expectedSha256 = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
    const expectedRevision = `sihsalus-${expectedSha256.slice(0, 16)}`;
    if (sha256 !== expectedSha256 || revision !== expectedRevision) {
      fail(`Assembled precache revision does not match ${file}`);
    }

    const matchingWorkboxEntries = workboxEntries.filter(
      (workboxEntry) => getPrecacheFileName(workboxEntry.url) === file,
    );
    if (
      matchingWorkboxEntries.length !== 1 ||
      matchingWorkboxEntries[0].url !== url ||
      matchingWorkboxEntries[0].revision !== expectedRevision
    ) {
      fail(`service-worker.js does not contain the expected revision for ${file}`);
    }
  }

  for (const file of requiredRevisionFiles) {
    if (!seenFiles.has(file)) {
      fail(`assembled-precache-revisions.json does not revision required file: ${file}`);
    }
  }
}

const appShellBuildInfoPath = path.join(outDir, 'app-shell-build-info.json');
const appShellBuildInfo = invalidRequiredArtifacts.has('app-shell-build-info.json')
  ? null
  : readJson(appShellBuildInfoPath);
if (
  !appShellBuildInfo ||
  appShellBuildInfo.schemaVersion !== 1 ||
  appShellBuildInfo.sourceBuild !== true ||
  typeof appShellBuildInfo.appShellVersion !== 'string' ||
  typeof appShellBuildInfo.frameworkVersion !== 'string'
) {
  fail('app-shell-build-info.json does not prove a source-built app shell');
}

const pwaManifestPath = path.join(outDir, 'manifest.webmanifest');
const pwaManifest = invalidRequiredArtifacts.has('manifest.webmanifest') ? null : readJson(pwaManifestPath);
if (
  !pwaManifest ||
  pwaManifest.name !== 'SIH.SALUS' ||
  pwaManifest.short_name !== 'SIH.SALUS' ||
  pwaManifest.description !== 'Sistema de información en salud' ||
  pwaManifest.theme_color !== '#27348b' ||
  !Array.isArray(pwaManifest.icons) ||
  pwaManifest.icons.length !== 1 ||
  pwaManifest.icons[0]?.src !== 'alternative-logo.png'
) {
  fail('manifest.webmanifest does not contain the required SIHSALUS branding');
}

const indexHtmlPath = path.join(outDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  if (/Application Error|Something went wrong\. Please try reloading\./.test(indexHtml)) {
    fail('Fatal app-shell error template was not localized');
  }

  const requiredLocalizedLoadErrorCopy = [
    'No se pudo cargar la página',
    'No se pudo cargar un módulo de la aplicación.',
    'The page could not be loaded',
    'An application module could not be loaded.',
  ];
  for (const text of requiredLocalizedLoadErrorCopy) {
    if (!indexHtml.includes(text)) {
      fail(`Microfrontend load error is missing localized copy: ${text}`);
    }
  }

  if (
    !indexHtml.includes("return document.documentElement.lang.toLowerCase().indexOf('es') === 0;") ||
    !/title:\s*isSpanishLocale\(\)\s*\?\s*'No se pudo cargar la página'\s*:\s*'The page could not be loaded'/.test(
      indexHtml,
    ) ||
    !/description:\s*isSpanishLocale\(\)\s*\?\s*'No se pudo cargar un módulo de la aplicación\.[^']*'\s*:\s*'An application module could not be loaded\.[^']*'/s.test(
      indexHtml,
    )
  ) {
    fail('Microfrontend load error is not selected from the document locale at runtime');
  }

  const documentLocale = indexHtml.match(/<html\s+lang="([^"]+)"/i)?.[1] || '';
  const expectedFatalCopy = documentLocale.toLowerCase().startsWith('es')
    ? ['<h1>Error de la aplicación</h1>', '<p>No se pudo iniciar la aplicación. Intente recargar la página.</p>']
    : ['<h1>Application error</h1>', '<p>The application could not start. Try reloading the page.</p>'];
  for (const text of expectedFatalCopy) {
    if (!indexHtml.includes(text)) {
      fail(`Fatal app-shell error template does not match locale ${documentLocale || '(missing)'}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

logInfo('SPA artifact is valid');
