const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertCompatibleAppShellConfig,
  assertCompatibleServiceWorkerArtifact,
  assertCompatibleServiceWorkerConfig,
  assertCanonicalRepositoryRoot,
  assertRepoOwnedServiceWorkerSource,
  assertSafeAppShellSource,
  getAppShellBuildEnvironment,
  getAppShellPackageRoot,
  getAppShellWebpackConfig,
  getRepoOwnedServiceWorkerSource,
  getUpstreamServiceWorkerSource,
} = require('./build-app-shell');

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');

function withServiceWorkerEnvironment(
  source,
  callback,
  configuredRepositoryRoot = source ? repositoryRoot : undefined,
) {
  const previousOffline = process.env.OMRS_OFFLINE;
  const previousRepositoryRoot = process.env.OMRS_REPOSITORY_ROOT;
  const previousSource = process.env.OMRS_SERVICE_WORKER_SRC;
  process.env.OMRS_OFFLINE = 'enable';
  if (configuredRepositoryRoot == null) {
    delete process.env.OMRS_REPOSITORY_ROOT;
  } else {
    process.env.OMRS_REPOSITORY_ROOT = configuredRepositoryRoot;
  }
  if (source === undefined) {
    delete process.env.OMRS_SERVICE_WORKER_SRC;
  } else {
    process.env.OMRS_SERVICE_WORKER_SRC = source;
  }

  try {
    return callback();
  } finally {
    if (previousOffline === undefined) delete process.env.OMRS_OFFLINE;
    else process.env.OMRS_OFFLINE = previousOffline;
    if (previousRepositoryRoot === undefined) delete process.env.OMRS_REPOSITORY_ROOT;
    else process.env.OMRS_REPOSITORY_ROOT = previousRepositoryRoot;
    if (previousSource === undefined) delete process.env.OMRS_SERVICE_WORKER_SRC;
    else process.env.OMRS_SERVICE_WORKER_SRC = previousSource;
  }
}

test('maps SPA deployment settings to app-shell build settings', () => {
  const environment = getAppShellBuildEnvironment({
    API_URL: '/api/',
    IMPORTMAP_URL: 'https://cdn.example.test/importmap.json',
    SPA_CONFIG_URLS: '/spa/base.json, /spa/site.json',
    SPA_DEFAULT_LOCALE: 'es-PE',
    SPA_PATH: '/spa/',
  });

  assert.equal(environment.OMRS_API_URL, '/api');
  assert.equal(environment.OMRS_CONFIG_URLS, '/spa/base.json;/spa/site.json');
  assert.equal(environment.OMRS_ESM_DEFAULT_LOCALE, 'es-PE');
  assert.equal(environment.OMRS_ESM_IMPORTMAP_URL, 'https://cdn.example.test/importmap.json');
  assert.equal(environment.OMRS_FAVICON, '/spa/favicon.ico');
  assert.equal(environment.OMRS_PUBLIC_PATH, '/spa');
  assert.equal(environment.OMRS_REPOSITORY_ROOT, repositoryRoot);
  assert.equal(environment.OMRS_ROUTES_URL, '/spa/routes.registry.json');
  assert.equal(environment.OMRS_SERVICE_WORKER_SRC, getRepoOwnedServiceWorkerSource());
});

test('uses production-safe SIHSALUS defaults', () => {
  const environment = getAppShellBuildEnvironment({});

  assert.equal(environment.NODE_ENV, 'production');
  assert.equal(environment.OMRS_CONFIG_URLS, '/openmrs/spa/frontend.json');
  assert.equal(environment.OMRS_ESM_DEFAULT_LOCALE, 'es');
  assert.equal(environment.OMRS_OFFLINE, 'enable');
  assert.equal(environment.OMRS_PAGE_TITLE, 'SIH.SALUS');
  assert.equal(environment.OMRS_THEME_COLOR, '#27348b');
});

test('installed app-shell source contains the required source-level fixes', () => {
  assert.doesNotThrow(() => assertSafeAppShellSource(getAppShellPackageRoot()));
});

test('repository worker entry initially delegates to the controlled upstream alias', () => {
  const source = fs.readFileSync(assertRepoOwnedServiceWorkerSource(), 'utf8');

  assert.equal(source, "import '@openmrs/esm-app-shell/default-service-worker';\n");
});

test('unset worker source preserves the direct upstream InjectManifest entry', () => {
  const appShellRoot = getAppShellPackageRoot();
  const config = withServiceWorkerEnvironment(undefined, () => getAppShellWebpackConfig(appShellRoot));

  assert.doesNotThrow(() =>
    assertCompatibleServiceWorkerConfig(config, {
      appShellRoot,
      expectedSource: getUpstreamServiceWorkerSource(appShellRoot),
    }),
  );
});

test('configured worker source selects only the canonical repository entry', () => {
  const appShellRoot = getAppShellPackageRoot();
  const repositorySource = getRepoOwnedServiceWorkerSource();
  const config = withServiceWorkerEnvironment(repositorySource, () => getAppShellWebpackConfig(appShellRoot));

  assert.doesNotThrow(() =>
    assertCompatibleServiceWorkerConfig(config, {
      appShellRoot,
      expectedSource: repositorySource,
    }),
  );
});

test('configured worker source is independent of the current working directory', () => {
  const appShellRoot = getAppShellPackageRoot();
  const repositorySource = getRepoOwnedServiceWorkerSource();
  const alternateWorkingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-cwd-test-'));
  const previousWorkingDirectory = process.cwd();

  try {
    process.chdir(alternateWorkingDirectory);
    const config = withServiceWorkerEnvironment(repositorySource, () => getAppShellWebpackConfig(appShellRoot));
    assert.doesNotThrow(() =>
      assertCompatibleServiceWorkerConfig(config, {
        appShellRoot,
        expectedSource: repositorySource,
      }),
    );
  } finally {
    process.chdir(previousWorkingDirectory);
    fs.rmSync(alternateWorkingDirectory, { recursive: true, force: true });
  }
});

test('configured worker source requires the explicit repository-root contract', () => {
  const repositorySource = getRepoOwnedServiceWorkerSource();

  assert.throws(
    () =>
      withServiceWorkerEnvironment(repositorySource, () => getAppShellWebpackConfig(getAppShellPackageRoot()), null),
    /OMRS_REPOSITORY_ROOT is required/,
  );
});

test('patched webpack rejects an arbitrary worker source', () => {
  const arbitrarySource = path.join(os.tmpdir(), 'arbitrary-service-worker.ts');

  assert.throws(
    () => withServiceWorkerEnvironment(arbitrarySource, () => getAppShellWebpackConfig(getAppShellPackageRoot())),
    /must resolve to packages\/tooling\/app-shell\/service-worker\.ts/,
  );
});

test('patched webpack rejects a repository root reached through an ancestor symlink', () => {
  const linkParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-root-link-test-'));
  const actualParent = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-real-root-test-'));
  const actualRepositoryRoot = path.join(actualParent, 'repository');
  const linkedParent = path.join(linkParent, 'linked-parent');
  const linkedRepositoryRoot = path.join(linkedParent, 'repository');
  const linkedWorkerSource = getRepoOwnedServiceWorkerSource(linkedRepositoryRoot);
  fs.mkdirSync(path.dirname(getRepoOwnedServiceWorkerSource(actualRepositoryRoot)), { recursive: true });
  fs.writeFileSync(getRepoOwnedServiceWorkerSource(actualRepositoryRoot), 'export {};\n');
  fs.symlinkSync(actualParent, linkedParent);

  try {
    assert.throws(
      () =>
        withServiceWorkerEnvironment(
          linkedWorkerSource,
          () => getAppShellWebpackConfig(getAppShellPackageRoot()),
          linkedRepositoryRoot,
        ),
      /must not resolve through a symlink/,
    );
  } finally {
    fs.rmSync(linkParent, { recursive: true, force: true });
    fs.rmSync(actualParent, { recursive: true, force: true });
  }
});

test('repository worker validation rejects a symlink at the canonical path', () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-source-test-'));
  const workerSource = getRepoOwnedServiceWorkerSource(repositoryRoot);
  const outsideSource = path.join(repositoryRoot, 'outside.ts');
  fs.mkdirSync(path.dirname(workerSource), { recursive: true });
  fs.writeFileSync(outsideSource, 'export {};\n');
  fs.symlinkSync(outsideSource, workerSource);

  try {
    assert.throws(() => assertRepoOwnedServiceWorkerSource(workerSource, repositoryRoot), /regular, non-symlink file/);
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test('repository worker validation rejects an ancestor symlink that escapes the controlled entry', () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-root-test-'));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sihsalus-worker-outside-test-'));
  const workerSource = getRepoOwnedServiceWorkerSource(repositoryRoot);
  fs.mkdirSync(path.join(repositoryRoot, 'packages', 'tooling'), { recursive: true });
  fs.writeFileSync(path.join(outsideRoot, 'service-worker.ts'), 'export {};\n');
  fs.symlinkSync(outsideRoot, path.dirname(workerSource));

  try {
    assert.throws(
      () => assertRepoOwnedServiceWorkerSource(workerSource, repositoryRoot),
      /resolves outside the controlled entry/,
    );
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test('canonical repository-root validation rejects a path escape', () => {
  assert.throws(
    () => assertCanonicalRepositoryRoot(path.dirname(repositoryRoot)),
    /does not match the canonical repository root/,
  );
});

test('generated worker compatibility requires the upstream lifecycle behavior', () => {
  const compatibleArtifact = `
    self.__WB_DISABLE_DEV_LOGS = true;
    const cacheNames = ['spa-cache-v1', 'precache-v2'];
    const requestContract = ['x-omrs-offline-caching-strategy', 'network-only-or-cache-only'];
    const routeStore = { dynamicRouteRegistrations: [] };
    const messageHandlers = {
      onImportMapChanged() {},
      clearDynamicRoutes() {},
      registerDynamicRoute() {},
    };
    self.addEventListener("message", () => console.warn('[SW] Handling a message resulted in an error.'));
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", () => self.clients.claim());
  `;

  assert.doesNotThrow(() => assertCompatibleServiceWorkerArtifact(compatibleArtifact));
  assert.throws(() => assertCompatibleServiceWorkerArtifact('noop'), /missing upstream behavior/);
  assert.throws(() => assertCompatibleServiceWorkerArtifact('function {'), /not valid JavaScript/);
  assert.throws(
    () => assertCompatibleServiceWorkerArtifact(compatibleArtifact.replace('registerDynamicRoute', 'otherHandler')),
    /registerDynamicRoute/,
  );
});

test('installed app-shell build provides React and shares the resolved runtime versions', () => {
  const config = getAppShellWebpackConfig(getAppShellPackageRoot());

  assert.doesNotThrow(() => assertCompatibleAppShellConfig(config));
});

test('rejects an app-shell config that can emit an unresolved React global', () => {
  assert.throws(
    () => assertCompatibleAppShellConfig({ plugins: [] }, { frameworkVersion: '9.0.3', swrVersion: '2.4.1' }),
    /must provide React/,
  );
});
