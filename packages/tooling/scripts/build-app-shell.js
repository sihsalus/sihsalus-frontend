const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_API_URL = '/openmrs';
const DEFAULT_LOCALE = 'es';
const DEFAULT_SPA_PATH = '/openmrs/spa';

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
    OMRS_ROUTES_URL: `${spaPath}/routes.registry.json`,
    OMRS_THEME_COLOR: '#27348b',
  };
}

function getAppShellPackageRoot() {
  return path.dirname(require.resolve('@openmrs/esm-app-shell/package.json'));
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

  const configFactory = require(path.join(appShellRoot, 'webpack.config.js'));
  const config = configFactory({}, { mode: 'production' });
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
  assertSafeAppShellSource,
  buildAppShell,
  getAppShellBuildEnvironment,
  getAppShellPackageRoot,
};
