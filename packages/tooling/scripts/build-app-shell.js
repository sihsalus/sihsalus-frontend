const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const DEFAULT_API_URL = '/openmrs';
const DEFAULT_LOCALE = 'es';
const DEFAULT_SPA_PATH = '/openmrs/spa';
const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..');
const REPOSITORY_SERVICE_WORKER_RELATIVE_PATH = 'packages/tooling/app-shell/service-worker.ts';
const UPSTREAM_SERVICE_WORKER_ALIAS = '@openmrs/esm-app-shell/default-service-worker';

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '');
}

function getAppShellBuildEnvironment(environment = process.env) {
  const spaPath = trimTrailingSlashes(environment.SPA_PATH || DEFAULT_SPA_PATH);
  const apiUrl = trimTrailingSlashes(environment.API_URL || DEFAULT_API_URL);
  const defaultLocale = environment.SPA_DEFAULT_LOCALE || DEFAULT_LOCALE;
  const importmapUrl = environment.IMPORTMAP_URL || `${spaPath}/importmap.json`;
  const rawConfigUrls = environment.SPA_CONFIG_URLS || `${spaPath}/frontend.json`;
  const configUrls = rawConfigUrls
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .join(';');

  const repositoryRoot = assertCanonicalRepositoryRoot();

  return {
    NODE_ENV: 'production',
    OMRS_API_URL: apiUrl,
    OMRS_CLEAN_BEFORE_BUILD: 'true',
    OMRS_CONFIG_URLS: configUrls,
    OMRS_ENV: 'production',
    OMRS_ESM_DEFAULT_LOCALE: defaultLocale,
    OMRS_ESM_IMPORTMAP_URL: importmapUrl,
    OMRS_FAVICON: `${spaPath}/favicon.ico`,
    OMRS_OFFLINE: 'enable',
    OMRS_PAGE_DESCRIPTION: 'Sistema de información en salud',
    OMRS_PAGE_TITLE: 'SIH.SALUS',
    OMRS_PUBLIC_PATH: spaPath,
    OMRS_REPOSITORY_ROOT: repositoryRoot,
    OMRS_ROUTES_URL: `${spaPath}/routes.registry.json`,
    OMRS_SERVICE_WORKER_SRC: assertRepoOwnedServiceWorkerSource(
      getRepoOwnedServiceWorkerSource(repositoryRoot),
      repositoryRoot,
    ),
    OMRS_THEME_COLOR: '#27348b',
  };
}

function getAppShellPackageRoot() {
  return path.dirname(require.resolve('@openmrs/esm-app-shell/package.json'));
}

function getAppShellWebpackConfig(appShellRoot = getAppShellPackageRoot()) {
  const configFactory = require(path.join(appShellRoot, 'webpack.config.js'));
  return configFactory({}, { mode: 'production' });
}

function getRepoOwnedServiceWorkerSource(repositoryRoot = REPOSITORY_ROOT) {
  return path.join(path.resolve(repositoryRoot), REPOSITORY_SERVICE_WORKER_RELATIVE_PATH);
}

function getUpstreamServiceWorkerSource(appShellRoot = getAppShellPackageRoot()) {
  return path.join(appShellRoot, 'src/service-worker/index.ts');
}

function assertCanonicalRepositoryRoot(repositoryRoot = REPOSITORY_ROOT) {
  if (!repositoryRoot) {
    throw new Error('OMRS_REPOSITORY_ROOT is required when configuring the repository service worker');
  }

  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  let repositoryRootStat;
  try {
    repositoryRootStat = fs.lstatSync(resolvedRepositoryRoot);
  } catch {
    throw new Error(`Configured app-shell repository root is missing: ${resolvedRepositoryRoot}`);
  }
  if (!repositoryRootStat.isDirectory() || repositoryRootStat.isSymbolicLink()) {
    throw new Error('Configured app-shell repository root must be a regular, non-symlink directory');
  }

  const realRepositoryRoot = fs.realpathSync(resolvedRepositoryRoot);
  const expectedRepositoryRoot = fs.realpathSync(REPOSITORY_ROOT);
  if (realRepositoryRoot !== resolvedRepositoryRoot || realRepositoryRoot !== expectedRepositoryRoot) {
    throw new Error('Configured app-shell repository root does not match the canonical repository root');
  }

  return realRepositoryRoot;
}

function assertRepoOwnedServiceWorkerSource(
  source = getRepoOwnedServiceWorkerSource(),
  repositoryRoot = REPOSITORY_ROOT,
) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const expectedSource = getRepoOwnedServiceWorkerSource(resolvedRepositoryRoot);
  const resolvedSource = path.resolve(source);

  if (resolvedSource !== expectedSource) {
    throw new Error(
      `App-shell service-worker source must be the repository-owned entry: ${REPOSITORY_SERVICE_WORKER_RELATIVE_PATH}`,
    );
  }

  let sourceStat;
  try {
    sourceStat = fs.lstatSync(resolvedSource);
  } catch {
    throw new Error(`Repository-owned app-shell service-worker source is missing: ${resolvedSource}`);
  }
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error('Repository-owned app-shell service-worker source must be a regular, non-symlink file');
  }

  const realRepositoryRoot = fs.realpathSync(resolvedRepositoryRoot);
  const realSource = fs.realpathSync(resolvedSource);
  const expectedRealSource = getRepoOwnedServiceWorkerSource(realRepositoryRoot);
  if (realSource !== expectedRealSource) {
    throw new Error('Repository-owned app-shell service-worker source resolves outside the controlled entry');
  }

  return realSource;
}

function assertCompatibleServiceWorkerConfig(
  config,
  { appShellRoot = getAppShellPackageRoot(), expectedSource = getUpstreamServiceWorkerSource(appShellRoot) } = {},
) {
  const plugins = Array.isArray(config?.plugins) ? config.plugins : [];
  const injectManifestPlugins = plugins.filter((plugin) => plugin?.constructor?.name === 'InjectManifest');
  if (injectManifestPlugins.length !== 1) {
    throw new Error(`App-shell webpack config must contain exactly one InjectManifest plugin`);
  }

  const actualSource = path.resolve(injectManifestPlugins[0]?.config?.swSrc || '');
  if (actualSource !== path.resolve(expectedSource)) {
    throw new Error(`App-shell InjectManifest source is ${actualSource || '(missing)'}; expected ${expectedSource}`);
  }

  const expectedUpstreamSource = getUpstreamServiceWorkerSource(appShellRoot);
  const actualAlias = config?.resolve?.alias?.[`${UPSTREAM_SERVICE_WORKER_ALIAS}$`];
  if (path.resolve(actualAlias || '') !== expectedUpstreamSource) {
    throw new Error(`App-shell webpack config must bind ${UPSTREAM_SERVICE_WORKER_ALIAS} to its upstream worker`);
  }
}

function assertCompatibleServiceWorkerArtifact(serviceWorker) {
  try {
    acorn.parse(serviceWorker, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (error) {
    throw new Error(`Generated service worker is not valid JavaScript: ${error.message}`);
  }

  const requiredMarkers = [
    '__WB_DISABLE_DEV_LOGS',
    'spa-cache-v1',
    'precache-v2',
    'x-omrs-offline-caching-strategy',
    'network-only-or-cache-only',
    'dynamicRouteRegistrations',
    'onImportMapChanged',
    'clearDynamicRoutes',
    'registerDynamicRoute',
    '[SW] Handling a message resulted in an error.',
    'addEventListener("message"',
    'addEventListener("install"',
    'skipWaiting',
    'addEventListener("activate"',
    'clients.claim',
  ];

  for (const marker of requiredMarkers) {
    if (!serviceWorker.includes(marker)) {
      throw new Error(`Generated service worker is missing upstream behavior: ${marker}`);
    }
  }
}

function assertCompatibleAppShellConfig(
  config,
  {
    frameworkVersion = require('@openmrs/esm-framework/package.json').version,
    swrVersion = require('swr/package.json').version,
  } = {},
) {
  const plugins = Array.isArray(config?.plugins) ? config.plugins : [];
  const providePlugin = plugins.find((plugin) => plugin?.constructor?.name === 'ProvidePlugin');
  if (providePlugin?.definitions?.React !== 'react') {
    throw new Error('App-shell webpack config must provide React for workspace JSX compiled with the classic runtime');
  }

  const moduleFederationPlugin = plugins.find((plugin) => plugin?.constructor?.name === 'ModuleFederationPlugin');
  const shared = moduleFederationPlugin?._options?.shared;
  if (!shared || typeof shared !== 'object') {
    throw new Error('App-shell webpack config is missing Module Federation shared dependencies');
  }

  const expectedVersions = {
    '@openmrs/esm-framework': frameworkVersion,
    '@openmrs/esm-framework/src/internal': frameworkVersion,
    'swr/_internal': swrVersion,
  };
  for (const [dependency, expectedVersion] of Object.entries(expectedVersions)) {
    const requiredVersion = shared[dependency]?.requiredVersion;
    if (requiredVersion !== expectedVersion) {
      throw new Error(
        `App-shell shared dependency ${dependency} requires ${requiredVersion ?? '(missing)'} but resolves ${expectedVersion}`,
      );
    }
  }
}

function assertSafeAppShellSource(appShellRoot = getAppShellPackageRoot()) {
  const runSource = fs.readFileSync(path.join(appShellRoot, 'src/run.ts'), 'utf8');
  const webpackSource = fs.readFileSync(path.join(appShellRoot, 'webpack.config.js'), 'utf8');

  const requiredRunMarkers = [
    "getCoreTranslation('fatalErrorMessage')",
    "getCoreTranslation('offlineSetupErrorTitle')",
    "getCoreTranslation('offlineSetupGenericError')",
  ];
  const forbiddenRunMarkers = ['Offline Setup Error', 'No additional information available.'];

  for (const marker of requiredRunMarkers) {
    if (!runSource.includes(marker)) {
      throw new Error(`Patched app-shell source is missing required behavior: ${marker}`);
    }
  }
  for (const marker of forbiddenRunMarkers) {
    if (runSource.includes(marker)) {
      throw new Error(`Patched app-shell source still exposes technical copy: ${marker}`);
    }
  }

  if (!webpackSource.includes("filename: 'manifest.webmanifest'") || !webpackSource.includes('icons: []')) {
    throw new Error('Patched app-shell build must emit the SIHSALUS-owned PWA manifest without generated icons');
  }
  if (webpackSource.includes('html-webpack-tags-plugin')) {
    throw new Error('Patched app-shell build still requires the unpublished html-webpack-tags-plugin dependency');
  }
  const requiredServiceWorkerMarkers = [
    'process.env.OMRS_REPOSITORY_ROOT',
    'process.env.OMRS_SERVICE_WORKER_SRC',
    'packages/tooling/app-shell/service-worker.ts',
    `${UPSTREAM_SERVICE_WORKER_ALIAS}$`,
  ];
  for (const marker of requiredServiceWorkerMarkers) {
    if (!webpackSource.includes(marker)) {
      throw new Error(`Patched app-shell source is missing the controlled service-worker seam: ${marker}`);
    }
  }
}

function writeBuildInfo(outputDir, appShellRoot) {
  const appShellPackage = JSON.parse(fs.readFileSync(path.join(appShellRoot, 'package.json'), 'utf8'));
  const frameworkPackage = require('@openmrs/esm-framework/package.json');
  const buildInfo = {
    schemaVersion: 1,
    sourceBuild: true,
    appShellVersion: appShellPackage.version,
    frameworkVersion: frameworkPackage.version,
  };

  fs.writeFileSync(path.join(outputDir, 'app-shell-build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
}

async function buildAppShell(outputDir) {
  const webpack = require('webpack');
  const resolvedOutputDir = path.resolve(outputDir);
  const appShellRoot = getAppShellPackageRoot();
  assertSafeAppShellSource(appShellRoot);

  const configuredServiceWorkerSource = process.env.OMRS_SERVICE_WORKER_SRC;
  const expectedServiceWorkerSource = configuredServiceWorkerSource
    ? assertRepoOwnedServiceWorkerSource(
        configuredServiceWorkerSource,
        assertCanonicalRepositoryRoot(process.env.OMRS_REPOSITORY_ROOT),
      )
    : getUpstreamServiceWorkerSource(appShellRoot);

  const config = getAppShellWebpackConfig(appShellRoot);
  assertCompatibleAppShellConfig(config);
  assertCompatibleServiceWorkerConfig(config, {
    appShellRoot,
    expectedSource: expectedServiceWorkerSource,
  });
  config.output.path = resolvedOutputDir;

  await new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) {
        reject(error);
        return;
      }

      const output = stats.toString({
        all: false,
        colors: false,
        errors: true,
        timings: true,
        warnings: true,
      });
      if (output) {
        console.log(output);
      }

      if (stats.hasErrors()) {
        reject(new Error('App-shell source build failed'));
        return;
      }
      resolve();
    });
  });

  const serviceWorkerPath = path.join(resolvedOutputDir, 'service-worker.js');
  if (!fs.existsSync(serviceWorkerPath)) {
    throw new Error('App-shell source build did not emit service-worker.js');
  }
  assertCompatibleServiceWorkerArtifact(fs.readFileSync(serviceWorkerPath, 'utf8'));

  writeBuildInfo(resolvedOutputDir, appShellRoot);
}

if (require.main === module) {
  const outputDir = process.env.APP_SHELL_OUTPUT_DIR;
  if (!outputDir) {
    console.error('APP_SHELL_OUTPUT_DIR is required');
    process.exit(1);
  }

  buildAppShell(outputDir).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  assertCompatibleAppShellConfig,
  assertCompatibleServiceWorkerArtifact,
  assertCompatibleServiceWorkerConfig,
  assertCanonicalRepositoryRoot,
  assertRepoOwnedServiceWorkerSource,
  assertSafeAppShellSource,
  buildAppShell,
  getAppShellBuildEnvironment,
  getAppShellPackageRoot,
  getAppShellWebpackConfig,
  getRepoOwnedServiceWorkerSource,
  getUpstreamServiceWorkerSource,
};
