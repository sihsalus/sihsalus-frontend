const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const chalk = require('chalk');

const logInfo = (msg) => console.log(`${chalk.green.bold('[assemble]')} ${msg}`);
const logWarn = (msg) => console.warn(`${chalk.yellow.bold('[assemble]')} ${chalk.yellow(msg)}`);
const logFail = (msg) => console.error(`${chalk.red.bold('[assemble]')} ${chalk.red(msg)}`);

const importmap = { imports: {} };
const routesRegistry = {};
const outDir = process.env.SPA_OUTPUT_DIR || 'dist/spa';
const hostSharedWorkspacePackages = [
  '@openmrs/esm-framework',
  '@openmrs/esm-styleguide',
  '@openmrs/esm-config',
  '@openmrs/esm-context',
  '@openmrs/esm-extensions',
  '@openmrs/esm-navigation',
  '@openmrs/esm-offline',
  '@openmrs/esm-react-utils',
  '@openmrs/esm-state',
  '@openmrs/esm-translations',
  '@openmrs/esm-utils',
  '@openmrs/esm-api',
  '@openmrs/esm-emr-api',
  '@openmrs/esm-error-handling',
  '@openmrs/esm-expression-evaluator',
  '@openmrs/esm-routes',
];

function copyFileReplacingIfNeeded(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    return;
  } catch (e) {
    const canRetryWithReplace = (e.code === 'EACCES' || e.code === 'EPERM') && fs.existsSync(dest);
    if (!canRetryWithReplace) {
      throw e;
    }

    // Some previous runs may leave root-owned artifacts in outDir.
    // If the directory is writable, removing the destination and retrying
    // avoids permission errors when opening the file for overwrite.
    fs.rmSync(dest, { force: true });
    fs.copyFileSync(src, dest);
  }
}

/** Ensures resolvedPath stays inside baseDir. Exits on traversal attempt. */
function assertInsideDir(resolvedPath, baseDir, label) {
  const real = path.resolve(resolvedPath);
  const base = path.resolve(baseDir);
  if (!real.startsWith(base + path.sep) && real !== base) {
    logFail(`Path traversal blocked (${label}): ${resolvedPath} escapes ${baseDir}`);
    process.exit(1);
  }
}

// Clean and recreate output directory
function cleanOutputDirectory() {
  const resolvedOutDir = path.resolve(outDir);
  const rootDir = path.parse(resolvedOutDir).root;
  const cwd = path.resolve(process.cwd());

  if (resolvedOutDir === rootDir || resolvedOutDir === cwd) {
    logFail(`Refusing to clean unsafe SPA output directory: ${resolvedOutDir}`);
    process.exit(1);
  }

  fs.rmSync(resolvedOutDir, { recursive: true, force: true });
  fs.mkdirSync(resolvedOutDir, { recursive: true });
}

cleanOutputDirectory();

// ── Phase 1: Copy locally-built app bundles (@sihsalus/* and @openmrs/* overrides) ──
logInfo('Phase 1: Local modules');
const appDirs = fs
  .readdirSync('packages/apps', { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('esm-'))
  .map((d) => path.join('packages/apps', d.name, 'dist'))
  .filter((d) => fs.existsSync(d));
const localBaseNames = new Set();

// Track packages found locally but without a built dist, for a summary warning
const notBuilt = [];

for (const distDir of appDirs) {
  const pkgJsonPath = path.join(distDir, '..', 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (pkg.private) {
    logInfo(`SKIP ${pkg.name}: private package`);
    continue;
  }

  const isLocalOverride = !pkg.name.startsWith('@sihsalus/');
  const tag = isLocalOverride ? '[override]' : '[local]   ';

  const browserField = pkg.browser || pkg.module || pkg.main;
  if (!browserField) {
    logWarn(`SKIP ${tag} ${pkg.name}: no browser/module/main field in package.json`);
    continue;
  }

  const entryFileName = path.basename(browserField);
  const entryFilePath = path.join(distDir, '..', browserField);
  assertInsideDir(entryFilePath, path.join(distDir, '..'), `${pkg.name} browserField`);

  if (!fs.existsSync(entryFilePath)) {
    notBuilt.push(pkg.name);
    logWarn(`SKIP ${tag} ${pkg.name}: dist not found at ${browserField} — run build first`);
    continue;
  }

  copyFileReplacingIfNeeded(entryFilePath, path.join(outDir, entryFileName));
  importmap.imports[pkg.name] = `./${entryFileName}`;
  localBaseNames.add(pkg.name.replace(/^@[^/]+\//, ''));

  const buildManifestName = `${entryFileName}.buildmanifest.json`;
  const buildManifestPath = path.join(distDir, buildManifestName);
  if (fs.existsSync(buildManifestPath)) {
    copyFileReplacingIfNeeded(buildManifestPath, path.join(outDir, buildManifestName));
  }

  // Copy chunk files (skip directories and manifests)
  let chunkCount = 0;
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === entryFileName) continue;
    if (entry.name.endsWith('.buildmanifest.json')) continue;
    const dest = path.join(outDir, entry.name);
    if (fs.existsSync(dest)) continue;
    copyFileReplacingIfNeeded(path.join(distDir, entry.name), dest);
    chunkCount++;
  }

  // Collect routes — prefer src/routes.json (source of truth), fall back to dist/routes.json
  const routesPathSrc = path.join(distDir, '..', 'src', 'routes.json');
  const routesPathDist = path.join(distDir, 'routes.json');
  const routesPath = fs.existsSync(routesPathSrc)
    ? routesPathSrc
    : fs.existsSync(routesPathDist)
      ? routesPathDist
      : null;
  if (routesPath) {
    routesRegistry[pkg.name] = {
      ...JSON.parse(fs.readFileSync(routesPath, 'utf8')),
      version: pkg.version || '0.0.0',
    };
  } else {
    logWarn(`${pkg.name}: no routes.json — will have no pages or extensions registered`);
  }

  logInfo(`OK ${tag} ${pkg.name} -> ${entryFileName} (${chunkCount} chunks)`);
}

if (notBuilt.length > 0) {
  logWarn(`${notBuilt.length} local package(s) without dist — run 'yarn build' first:`);
  for (const name of notBuilt) logWarn(`  - ${name}`);
}

// ── Phase 1b: Copy local shared host libraries ───────────────────────────────
// Some apps mark core OpenMRS libraries as Module Federation shared modules with
// `import: false`, so they must be present in the app shell import map. These
// libraries do not have routes, but the shell still needs their bundles to
// register them in the shared scope before app remotes consume them.
logInfo('Phase 1b: Local shared host libraries');
for (const packageName of hostSharedWorkspacePackages) {
  const packageDirName = packageName.replace(/^@openmrs\//, '');
  const packageDir = path.join('packages/libs', packageDirName);
  const pkgJsonPath = path.join(packageDir, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    logWarn(`SKIP [shared] ${packageName}: package.json not found at ${pkgJsonPath}`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const entryField = pkg.browser || pkg.module || pkg.main;

  if (!entryField) {
    logWarn(`SKIP [shared] ${packageName}: no browser/module/main field in package.json`);
    continue;
  }

  const entryFilePath = path.join(packageDir, entryField);
  assertInsideDir(entryFilePath, packageDir, `${packageName} entryField`);

  if (!fs.existsSync(entryFilePath)) {
    logWarn(`SKIP [shared] ${packageName}: entry not found at ${entryField} — run build first`);
    continue;
  }

  const entryFileName = path.basename(entryField);
  const versionedSubdir = `${packageDirName}-${pkg.version || '0.0.0'}`;
  const versionedDir = path.join(outDir, versionedSubdir);
  const entryDir = path.dirname(entryFilePath);

  fs.mkdirSync(versionedDir, { recursive: true });
  fs.cpSync(entryDir, versionedDir, { recursive: true, force: true });

  importmap.imports[pkg.name] = `./${versionedSubdir}/${entryFileName}`;
  localBaseNames.add(pkg.name.replace(/^@[^/]+\//, ''));

  logInfo(`OK [shared] ${pkg.name} -> ${versionedSubdir}/${entryFileName}`);
}

// ── Phase 2: Resolve modules from spa-assemble-config.json ───────────────────────
// The config is generated by generate-assemble-config.js and lists all workspace
// packages. Local builds (Phase 1) always take precedence. External packages
// (@openmrs/* or others) not present locally are downloaded from npm as a fallback.
async function downloadNpmModules() {
  const configPath = process.env.SPA_ASSEMBLE_CONFIG || 'config/spa-assemble-config.json';

  if (!fs.existsSync(configPath)) {
    logInfo('Phase 2: skipped — config not found. Run `yarn generate-config` to create it.');
    return;
  }

  let pacote;

  const { frontendModules = {} } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const entries = Object.entries(frontendModules);

  const externalEntries = entries.filter(([name]) => {
    const baseName = name.replace(/^@[^/]+\//, '');
    if (localBaseNames.has(baseName)) return false; // Phase 1 already handled it
    if (name.startsWith('@sihsalus/')) {
      // Local package with missing dist — not published to npm, warn and skip
      logWarn(`[npm] SKIP ${name}: local package not built — run 'yarn build' first`);
      return false;
    }
    return true; // External package (e.g. @openmrs/*) — attempt npm download
  });

  if (externalEntries.length === 0) {
    logInfo(`Phase 2: all ${entries.length} config entries resolved locally — nothing to download`);
    return;
  }

  try {
    pacote = require('pacote');
  } catch (e) {
    logFail(`pacote not available: ${e.message}`);
    process.exit(1);
  }

  logInfo(`Phase 2: downloading ${externalEntries.length} external module(s) from npm`);

  const os = require('node:os');
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-assemble-'));

  for (const [name, version] of externalEntries) {
    const baseName = name.replace(/^@[^/]+\//, '');
    const spec = `${name}@${version}`;
    const tmpDir = path.join(tmpBase, baseName);

    try {
      await pacote.extract(spec, tmpDir, { cache: path.join(tmpBase, '.cache') });

      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
      const browserField = pkg.browser || pkg.module || pkg.main;

      if (!browserField) {
        logWarn(`SKIP [npm] ${name}: no browser/module/main field in package`);
        continue;
      }

      // Validate browserField doesn't escape the package directory
      assertInsideDir(path.join(tmpDir, browserField), tmpDir, `${name} browserField`);

      // Preserve versioned directory (mirrors upstream convention for chunk resolution)
      const versionedSubdir = `${baseName}-${version}`;
      const versionedDir = path.join(outDir, versionedSubdir);
      fs.mkdirSync(versionedDir, { recursive: true });

      // Copy all files from the package dist directory (recursive for chunks/subdirs)
      const pkgDistDir = path.join(tmpDir, path.dirname(browserField));
      if (fs.existsSync(pkgDistDir) && pkgDistDir !== tmpDir) {
        fs.cpSync(pkgDistDir, versionedDir, { recursive: true, force: true });
      } else {
        // browserField is at the package root (no subdirectory)
        copyFileReplacingIfNeeded(
          path.join(tmpDir, browserField),
          path.join(versionedDir, path.basename(browserField)),
        );
      }

      const entryFileName = path.basename(browserField);
      importmap.imports[name] = `./${versionedSubdir}/${entryFileName}`;

      // Collect routes
      const routesPath = path.join(tmpDir, 'src', 'routes.json');
      if (fs.existsSync(routesPath) && !routesRegistry[name]) {
        routesRegistry[name] = {
          ...JSON.parse(fs.readFileSync(routesPath, 'utf8')),
          version,
        };
      }

      logInfo(`OK [npm] ${name}@${version} -> ${versionedSubdir}/${entryFileName}`);
    } catch (e) {
      logWarn(`[npm] ${spec}: ${e.message} — skipped`);
    }
  }

  // Cleanup tmp dir
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

// ── Phase 3: Copy app-shell dist ──────────────────────────────────────
function copyAppShell() {
  logInfo('Phase 3: App shell');
  let shellDist;
  try {
    shellDist = path.join(path.dirname(require.resolve('@openmrs/esm-app-shell/package.json')), 'dist');
  } catch {
    logWarn('@openmrs/esm-app-shell not found — SPA will have no shell');
    return;
  }

  if (fs.existsSync(shellDist)) {
    fs.cpSync(shellDist, outDir, { recursive: true, force: false });
    logInfo('OK app-shell dist copied');
    stripRootCssSourceMapComments();
    patchAppShellRuntime();
  }
}

function stripRootCssSourceMapComments() {
  const rootCssFiles = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => entry.name);

  for (const cssFile of rootCssFiles) {
    const cssPath = path.join(outDir, cssFile);
    const css = fs.readFileSync(cssPath, 'utf8');
    const withoutSourceMapComment = css.replace(/\/\*# sourceMappingURL=[^*]+\.map\*\//g, '');

    if (withoutSourceMapComment !== css) {
      fs.writeFileSync(cssPath, withoutSourceMapComment);
      logInfo(`OK stripped CSS source map comment from ${cssFile}`);
    }
  }
}

function patchAppShellRuntime() {
  const minifiedTemplateVariable = (name) => '$' + `{${name}}`;
  const jsFiles = fs
    .readdirSync(outDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(outDir, entry.name));

  const extensionParcelName = `${minifiedTemplateVariable('t')}/${minifiedTemplateVariable(
    'd',
  )}-${minifiedTemplateVariable('f')}`;
  const extensionParcelProps =
    '{...l,_meta:o,_extensionContext:{extensionId:c,extensionSlotName:t,extensionSlotModuleName:n,extensionModuleName:m},domElement:e}';
  const extensionParcelTimeouts =
    'timeouts:{bootstrap:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},mount:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},update:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},unmount:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4}}';
  const extensionParcelMount = `p=(0,r.mountRootParcel)(u({...s,name:\`${extensionParcelName}\`}),${extensionParcelProps})`;
  const extensionParcelMountWithTimeouts = `p=(0,r.mountRootParcel)(u({...s,name:\`${extensionParcelName}\`,${extensionParcelTimeouts}}),${extensionParcelProps})`;

  const duplicateSlotWarning = `if(o&&o!=e)return console.warn(\`An extension slot with the name '${minifiedTemplateVariable(
    't',
  )}' already exists. Refusing to register the same slot name twice (in "registerExtensionSlot"). The existing one is from module ${minifiedTemplateVariable(
    'o',
  )}.\`),r;`;
  const duplicateSlotNoop = 'if(o&&o!=e)return r;';

  const patches = [
    {
      name: 'extension parcel lifecycle timeout',
      search: extensionParcelMount,
      replacement: extensionParcelMountWithTimeouts,
    },
    {
      name: 'duplicate extension slot warning',
      search: duplicateSlotWarning,
      replacement: duplicateSlotNoop,
    },
  ];

  for (const patch of patches) {
    let applied = 0;

    for (const jsFile of jsFiles) {
      const source = fs.readFileSync(jsFile, 'utf8');
      if (!source.includes(patch.search)) {
        continue;
      }

      fs.writeFileSync(jsFile, source.split(patch.search).join(patch.replacement));
      applied++;
    }

    if (applied > 0) {
      logInfo(`OK patched app-shell ${patch.name} (${applied} file${applied === 1 ? '' : 's'})`);
    } else {
      logWarn(`app-shell ${patch.name} patch not applied; expected runtime pattern was not found`);
    }
  }
}

// ── Phase 4: Write importmap.json and routes ──────────────────────────
function writeOutputs() {
  logInfo('Phase 4: Write outputs');
  fs.writeFileSync(path.join(outDir, 'importmap.json'), JSON.stringify(importmap, null, 2));
  fs.writeFileSync(path.join(outDir, 'routes.registry.json'), JSON.stringify(routesRegistry, null, 2));

  // Verify no duplicate bundle filenames
  const values = Object.values(importmap.imports);
  const dupes = values.filter((v, i) => values.indexOf(v) !== i);
  if (dupes.length > 0) {
    logFail('Duplicate bundle names detected — this will cause runtime collisions:');
    for (const dupe of [...new Set(dupes)]) {
      const apps = Object.entries(importmap.imports)
        .filter(([, v]) => v === dupe)
        .map(([k]) => k);
      logFail(`  ${dupe}: ${apps.join(', ')}`);
    }
  }

  // Detect modules in importmap without registered routes
  const withoutRoutes = Object.keys(importmap.imports).filter((name) => !routesRegistry[name]);
  if (withoutRoutes.length > 0) {
    logWarn(`${withoutRoutes.length} module(s) without registered routes (will have no pages/extensions):`);
    for (const name of withoutRoutes) logWarn(`  - ${name}`);
  }

  logInfo(`Import map: ${Object.keys(importmap.imports).length} total modules`);
  logInfo(`Routes: ${Object.keys(routesRegistry).length} modules`);
}

// ── Phase 5: Copy config files into outDir ────────────────────────────
function copyConfigFiles() {
  logInfo('Phase 5: Config files');
  const configDir = path.resolve('config');
  if (!fs.existsSync(configDir)) {
    logWarn('config/ directory not found — skipping');
    return;
  }
  for (const file of fs.readdirSync(configDir)) {
    if (file === 'spa-assemble-config.json') continue; // build-time only
    const src = path.join(configDir, file);
    if (!fs.statSync(src).isFile()) continue;
    const dest = path.join(outDir, file);
    copyFileReplacingIfNeeded(src, dest);
    logInfo(`OK config/${file} -> ${outDir}/`);
  }
}

// ── Phase 6: Copy brand assets (logos, favicon) into outDir ──────────
function copyAssets() {
  logInfo('Phase 6: Brand assets');
  const assetsDir = path.resolve('assets/resources');
  if (!fs.existsSync(assetsDir)) {
    logWarn('assets/resources/ not found — skipping brand assets');
    return;
  }
  function copyAssetDir(srcDir, relativeDir = '') {
    for (const file of fs.readdirSync(srcDir)) {
      const src = path.join(srcDir, file);
      const relativePath = path.join(relativeDir, file);
      const stat = fs.statSync(src);

      if (stat.isDirectory()) {
        copyAssetDir(src, relativePath);
        continue;
      }

      if (!stat.isFile()) continue;

      const dest = path.join(outDir, relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      copyFileReplacingIfNeeded(src, dest);
      logInfo(`OK assets/resources/${relativePath.replace(/\\/g, '/')} -> ${outDir}/`);
    }
  }

  copyAssetDir(assetsDir);
}

// ── Phase 7: Patch index.html — port of startup.sh envsubst logic ─────
// Injects SPA_PATH, API_URL, SPA_CONFIG_URLS, SPA_DEFAULT_LOCALE, IMPORTMAP_URL
// so nginx serves a fully-resolved index.html with no runtime substitution needed.
function patchIndexHtml() {
  const indexPath = path.join(outDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    logWarn('Phase 6: index.html not found — skipping');
    return;
  }

  logInfo('Phase 6: Patching index.html');

  const importmapUrl = process.env.IMPORTMAP_URL || '';
  const spaPath = process.env.SPA_PATH || '/openmrs/spa';
  const apiUrl = process.env.API_URL || '/openmrs';
  const defaultLocale = process.env.SPA_DEFAULT_LOCALE || 'es';
  const rawConfigUrls = (process.env.SPA_CONFIG_URLS || `${spaPath}/frontend.json`).trim();

  let html = fs.readFileSync(indexPath, 'utf8');

  const sihsalusErrorUiScript = `<script>
(function () {
  function getErrorMessage(error) {
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    return typeof error === 'string' ? error : '';
  }

  function isMicrofrontendLoadError(error) {
    var message = getErrorMessage(error);
    return (
      message.indexOf('died in status LOADING_SOURCE_CODE') >= 0 ||
      message.indexOf('ChunkLoadError') >= 0 ||
      message.indexOf('Loading chunk') >= 0 ||
      message.indexOf('CSS_CHUNK_LOAD_FAILED') >= 0 ||
      message.indexOf("doesn't exist in shared scope") >= 0 ||
      message.indexOf('Shared module') >= 0
    );
  }

  function showMicrofrontendLoadError(error) {
    console.error('[sihsalus] Microfrontend load failure:', error);
    window.dispatchEvent(
      new CustomEvent('openmrs:toast-shown', {
        detail: {
          kind: 'error',
          title: 'No se pudo cargar la página',
          description:
            'No se pudo cargar un módulo de la aplicación. Recarga la página. Si el problema continúa, contacta a soporte.',
        },
      }),
    );
  }

  function installOnErrorWrapper() {
    if (window.onerror && window.onerror.__sihsalusWrapped) {
      return;
    }
    var previousOnError = window.onerror;
    function sihsalusOnError(message, source, lineno, colno, error) {
      var reason = error || message;
      if (isMicrofrontendLoadError(reason)) {
        showMicrofrontendLoadError(reason);
        return true;
      }
      return typeof previousOnError === 'function' ? previousOnError.apply(this, arguments) : false;
    }
    sihsalusOnError.__sihsalusWrapped = true;
    window.onerror = sihsalusOnError;
  }

  installOnErrorWrapper();
  window.setTimeout(installOnErrorWrapper, 0);
  window.setTimeout(installOnErrorWrapper, 500);
  window.setTimeout(installOnErrorWrapper, 1500);
  window.setTimeout(installOnErrorWrapper, 3000);

  if (window.__sihsalusErrorUiInstalled) {
    return;
  }
  window.__sihsalusErrorUiInstalled = true;

  window.addEventListener(
    'error',
    function (event) {
      var reason = event.error || event.message;
      if (isMicrofrontendLoadError(reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showMicrofrontendLoadError(reason);
      }
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    function (event) {
      if (isMicrofrontendLoadError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showMicrofrontendLoadError(event.reason);
      }
    },
    true,
  );
})();
</script>`;

  html = html.replace(/<script>[\s\S]*?__sihsalusErrorUiInstalled[\s\S]*?<\/script>/, '');
  const appShellScript = /(<body><script src="[^"]+"><\/script>)/;
  html = appShellScript.test(html)
    ? html.replace(appShellScript, `$1${sihsalusErrorUiScript}`)
    : html.replace('</head>', `${sihsalusErrorUiScript}</head>`);

  // 1. Normalize importmap URL — replace both template variables and any hardcoded absolute URL
  //    (e.g. https://dev3.openmrs.org/openmrs/spa/importmap.json from upstream builds)
  const resolvedImportmapUrl = importmapUrl || (spaPath ? `${spaPath}/importmap.json` : '');
  if (resolvedImportmapUrl) {
    html = html.replace(/(['"])https?:\/\/[^'"]*\/importmap\.json\1/g, `$1${resolvedImportmapUrl}$1`);
    html = html.replace(/(['"])(?:\$\{SPA_PATH\}|\$SPA_PATH)\/importmap\.json\1/g, `$1${resolvedImportmapUrl}$1`);
  }

  // The app shell loads these JSON files via typed script tags. Keeping separate
  // preload links makes browsers warn that the preloaded fetch was not used.
  html = html.replace(
    /<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bhref=["'][^"']*\/(?:importmap|routes\.registry)\.json["'])[^>]*>\s*/g,
    '',
  );

  // 2. SPA_CONFIG_URLS — convert comma-separated list to JS array elements
  //    e.g. "/spa/a.json,/spa/b.json" → "/spa/a.json","/spa/b.json"
  if (!rawConfigUrls) {
    html = html.replace('"$SPA_CONFIG_URLS"', '');
  } else {
    const configUrlsJs = rawConfigUrls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => `"${u}"`)
      .join(',');
    html = html.replace('"$SPA_CONFIG_URLS"', configUrlsJs);
    html = html.replace(/configUrls:\s*\[[^\]]*\]/, `configUrls: [${configUrlsJs}]`);
  }

  // 3. General substitution — $VAR and ${VAR} forms
  //    Process longest names first to avoid partial matches (e.g. $SPA_PATH vs $SPA_PATH_X)
  const envsubst = (str) =>
    str
      .replace(/\$\{SPA_DEFAULT_LOCALE\}|\$SPA_DEFAULT_LOCALE(?![A-Za-z0-9_])/g, defaultLocale)
      .replace(/\$\{IMPORTMAP_URL\}|\$IMPORTMAP_URL(?![A-Za-z0-9_])/g, importmapUrl)
      .replace(/\$\{API_URL\}|\$API_URL(?![A-Za-z0-9_])/g, apiUrl)
      .replace(/\$\{SPA_PATH\}|\$SPA_PATH(?![A-Za-z0-9_])/g, spaPath)
      // Avoid service-worker registration in locally assembled builds.
      .replace(/offline:\s*true/g, 'offline: false');

  fs.writeFileSync(indexPath, envsubst(html));
  logInfo('OK index.html patched');

  // 4. service-worker.js
  const swPath = path.join(outDir, 'service-worker.js');
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8');
    if (resolvedImportmapUrl && spaPath) {
      sw = sw.replace(/(['"])https?:\/\/[^'"]*\/importmap\.json\1/g, `$1${resolvedImportmapUrl}$1`);
      sw = sw.replace(/(['"])(?:\$\{SPA_PATH\}|\$SPA_PATH)\/importmap\.json\1/g, `$1${resolvedImportmapUrl}$1`);
    }
    fs.writeFileSync(swPath, envsubst(sw));
    logInfo('OK service-worker.js patched');
  }
}

// ── Phase 8: Write build-info.json ───────────────────────────────────
// Stamps the assembled SPA with its provenance so the running app can report
// exactly which version/commit is deployed. Values come from CI build args that
// are promoted to env vars in the runtime image (see Dockerfile). Falls back to
// the root package version when assembled locally without those vars.
function getRootPackageVersion() {
  try {
    const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return typeof rootPackageJson.version === 'string' ? rootPackageJson.version : '';
  } catch {
    return '';
  }
}

function getCurrentGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function getBuildValue(value) {
  const trimmedValue = typeof value === 'string' ? value.trim() : '';
  return trimmedValue && trimmedValue !== '0.0.0-dev' ? trimmedValue : '';
}

function writeBuildInfo() {
  logInfo('Phase 8: Build info');
  const version = getBuildValue(process.env.APP_VERSION) || getRootPackageVersion() || '0.0.0-dev';
  const gitSha = getBuildValue(process.env.GIT_SHA) || getCurrentGitSha();
  const buildInfo = {
    version,
    gitSha,
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
  logInfo(`OK build-info.json (version=${buildInfo.version}, sha=${buildInfo.gitSha || 'n/a'})`);
}

// ── Main ──────────────────────────────────────────────────────────────
(async () => {
  await downloadNpmModules();
  copyAppShell();
  writeOutputs();
  copyConfigFiles();
  copyAssets();
  patchIndexHtml();
  writeBuildInfo();
  logInfo('Done! dist/spa/ is self-contained.');
})().catch((err) => {
  logFail(err.message);
  process.exit(1);
});
