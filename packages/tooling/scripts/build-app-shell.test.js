const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertCompatibleAppShellConfig,
  assertSafeAppShellSource,
  getAppShellBuildEnvironment,
  getAppShellPackageRoot,
  getAppShellWebpackConfig,
} = require('./build-app-shell');

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
  assert.equal(environment.OMRS_ROUTES_URL, '/spa/routes.registry.json');
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
