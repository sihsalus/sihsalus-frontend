#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const chalk = require('chalk');

const logInfo = (msg) => console.log(`${chalk.green.bold('[validate-spa]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[validate-spa]')} ${chalk.yellow(msg)}`);
const logFail = (msg) => console.error(`${chalk.red.bold('[validate-spa]')} ${chalk.red(msg)}`);

const outDir = process.env.SPA_OUTPUT_DIR || 'dist/spa';
const assembleConfigPath = process.env.SPA_ASSEMBLE_CONFIG || 'config/spa-assemble-config.json';
const requiredFiles = [
  'index.html',
  'importmap.json',
  'routes.registry.json',
  'frontend.json',
  'service-worker.js',
  'app-shell-runtime-patches.json',
];

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

for (const file of requiredFiles) {
  const filePath = path.join(outDir, file);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  } else if (fs.statSync(filePath).size === 0) {
    fail(`Required file is empty: ${filePath}`);
  }
}

const importmapPath = path.join(outDir, 'importmap.json');
const routesPath = path.join(outDir, 'routes.registry.json');
const importmap = fs.existsSync(importmapPath) ? readJson(importmapPath) : null;
const routesRegistry = fs.existsSync(routesPath) ? readJson(routesPath) : null;

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
  }
}

const modulesWithoutRoutes = Object.keys(imports).filter((name) => !routes[name]);
if (modulesWithoutRoutes.length > 0) {
  logWarn(`${modulesWithoutRoutes.length} module(s) have no route registration:`);
  for (const name of modulesWithoutRoutes) {
    logWarn(`  - ${name}`);
  }
}

const unsafeAppShellPatterns = [
  'title:"Offline Setup Error",description:',
  'description:e??"Oops! An unexpected error occurred."',
  'description:e.reason??"Oops! An unhandled promise rejection occurred."',
  'r.textContent=(null==e?void 0:e.message)||"No additional information available."',
  'Offline Setup Error',
  'Oops! An unexpected error occurred.',
  'Oops! An unhandled promise rejection occurred.',
  'No additional information available.',
];
const patchedAppShellMarkers = [
  'Modo sin conexión no disponible',
  'Ocurrió un error inesperado.',
  'No se pudo iniciar la aplicación. Intente recargar la página o contacte a soporte.',
  'timeouts:{bootstrap:{millis:1e4',
];
const appShellJavaScriptFiles = fs
  .readdirSync(outDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => {
    const source = fs.readFileSync(path.join(outDir, entry.name), 'utf8');
    return {
      name: entry.name,
      hasRawErrors: unsafeAppShellPatterns.some((pattern) => source.includes(pattern)),
      isPatchedAppShell: patchedAppShellMarkers.some((marker) => source.includes(marker)),
    };
  });
const appShellFilesWithRawErrors = appShellJavaScriptFiles.filter(({ hasRawErrors }) => hasRawErrors);

if (appShellFilesWithRawErrors.length > 0) {
  fail(`App shell still exposes technical errors in: ${appShellFilesWithRawErrors.map(({ name }) => name).join(', ')}`);
}

const requiredSafeAppShellMarkers = [
  { marker: 'Modo sin conexión no disponible', minimumOccurrences: 1 },
  { marker: 'Offline setup unavailable', minimumOccurrences: 1 },
  { marker: 'Ocurrió un error inesperado.', minimumOccurrences: 2 },
  { marker: 'An unexpected error occurred.', minimumOccurrences: 2 },
  {
    marker: 'No se pudo iniciar la aplicación. Intente recargar la página o contacte a soporte.',
    minimumOccurrences: 1,
  },
  {
    marker: 'The application could not start. Try reloading the page or contact support.',
    minimumOccurrences: 1,
  },
];

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

const runtimePatchManifestPath = path.join(outDir, 'app-shell-runtime-patches.json');
const serviceWorkerPath = path.join(outDir, 'service-worker.js');
const runtimePatchManifest = fs.existsSync(runtimePatchManifestPath) ? readJson(runtimePatchManifestPath) : null;
const serviceWorker = fs.existsSync(serviceWorkerPath) ? fs.readFileSync(serviceWorkerPath, 'utf8') : '';
const workboxEntries = parseWorkboxPrecacheEntries(serviceWorker);
const requiredRevisionFiles = ['index.html', 'favicon.ico', 'routes.registry.json', 'importmap.json', 'frontend.json'];
const patchedAppShellFiles = appShellJavaScriptFiles
  .filter(({ isPatchedAppShell }) => isPatchedAppShell)
  .map(({ name }) => name);

if (workboxEntries.length === 0) {
  fail('service-worker.js does not contain a recognizable Workbox precache manifest');
}

if (
  !runtimePatchManifest ||
  runtimePatchManifest.schemaVersion !== 1 ||
  runtimePatchManifest.algorithm !== 'sha256' ||
  !Array.isArray(runtimePatchManifest.files)
) {
  fail('app-shell-runtime-patches.json does not match the required schema');
} else {
  const manifestFiles = runtimePatchManifest.files;
  const seenFiles = new Set();
  const seenUrls = new Set();

  for (const entry of manifestFiles) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail('app-shell-runtime-patches.json contains a non-object file entry');
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
      fail('app-shell-runtime-patches.json contains an invalid file entry');
      continue;
    }

    if (seenFiles.has(file) || seenUrls.has(url)) {
      fail(`app-shell-runtime-patches.json contains a duplicate entry: ${file}`);
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

  for (const file of [...requiredRevisionFiles, ...patchedAppShellFiles]) {
    if (!seenFiles.has(file)) {
      fail(`app-shell-runtime-patches.json does not revision required file: ${file}`);
    }
  }

  if (!manifestFiles.some((entry) => typeof entry?.file === 'string' && entry.file.endsWith('.js'))) {
    fail('app-shell-runtime-patches.json does not revision any patched app-shell JavaScript bundle');
  }

  const revisionedAppShellJavaScript = [...seenFiles]
    .filter((file) => {
      const filePath = path.join(outDir, file);
      return file.endsWith('.js') && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    })
    .map((file) => fs.readFileSync(path.join(outDir, file), 'utf8'))
    .join('\n');
  for (const { marker, minimumOccurrences } of requiredSafeAppShellMarkers) {
    const occurrences = revisionedAppShellJavaScript.split(marker).length - 1;
    if (occurrences < minimumOccurrences) {
      fail(`App shell is missing required safe error handling: ${marker}`);
    }
  }
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
