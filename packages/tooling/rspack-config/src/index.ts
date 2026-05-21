/**
 * This is the base webpack config for all OpenMRS 3.x modules.
 *
 * ## Usage
 *
 * You can use it as simply as
 *
 * ```ts
 * module.exports = require('openmrs/default-webpack-config');
 * ```
 *
 * or you can customize the configuration using merges and overrides
 * like
 *
 * ```ts
 * const config = require('openmrs/default-webpack-config');
 * config.cssRuleConfig.rules = [myCustomRule];
 * module.exports = config;
 * ```
 *
 * ## Development
 *
 * Advice for working on this file:
 *
 * Don't use `yarn link` or symlinks to work on it.
 *
 * After you `yarn build --watch`, do something like
 * `watch "cp -R dist /path/to/packages/esm-patient-chart-app/webpack"`
 * and then change the webpack line from
 * `module.exports = require('openmrs/default-webpack-config');`
 * to
 * `module.exports = require('./webpack');`
 *
 * This is because Webpack has unpredictable behavior when working with
 * symlinked files, **even when using absolute paths**. You read that right.
 * Telling Webpack to use `/a/b/c`? If the Webpack config is symlinked
 * from `/d/e/`, then it *might* in *some cases* try to import `/d/e/c`.
 */

import rspack, {
  CopyRspackPlugin,
  container,
  DefinePlugin,
  type ModuleOptions,
  type Plugin,
  type RspackOptionsNormalized as RspackConfiguration,
  type RuleSetRule,
} from '@rspack/core';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { existsSync, statSync } from 'fs';
import { merge, mergeWith } from 'lodash';
import { basename, dirname, resolve } from 'path';
import { inc } from 'semver';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { StatsWriterPlugin } from 'webpack-stats-plugin';

type OpenmrsRspackConfig = Omit<Partial<RspackConfiguration>, 'module'> & {
  module: ModuleOptions;
};

type AppPackageJson = {
  name: string;
  version: string;
  peerDependencies?: Record<string, string>;
  browser?: string;
  main?: string;
  types?: string;
};

type NormalizedPackageJson = {
  name: string;
  version: string;
  peerDependencies: Record<string, string>;
  browser?: string;
  main: string;
  types: string;
};

type SharedDependencyConfig = {
  requiredVersion: string | false;
  strictVersion: boolean;
  singleton: boolean;
  import: string | false;
  packageName?: string;
  shareKey: string;
  shareScope: 'default';
  version?: string;
};

type VersionedPackageJson = {
  version?: string;
};

const alwaysHostSharedDependencies = new Set([
  '@carbon/react',
  '@openmrs/esm-framework',
  '@openmrs/esm-framework/src/internal',
  'single-spa',
]);

const production = 'production';
const { ModuleFederationPluginV1: ModuleFederationPlugin } = container;
function getFrameworkVersion() {
  try {
    const frameworkPkgUnknown: unknown = require('@openmrs/esm-framework/package.json');
    const frameworkPkg = frameworkPkgUnknown as VersionedPackageJson;
    const version = typeof frameworkPkg.version === 'string' ? frameworkPkg.version : undefined;

    if (!version) {
      return '5.x';
    }

    return `^${version}`;
  } catch {
    return '5.x';
  }
}

function getInstalledVersion(depName: string): string | undefined {
  const packageName = getPackageNameForDependency(depName);

  try {
    const resolvedEntry = require.resolve(depName);
    let currentDir = dirname(resolvedEntry);

    while (currentDir !== dirname(currentDir)) {
      const candidate = resolve(currentDir, 'package.json');

      if (existsSync(candidate)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkgUnknown: unknown = require(candidate);
        const pkg = pkgUnknown as VersionedPackageJson & { name?: string };

        if (pkg.name === packageName && typeof pkg.version === 'string') {
          return pkg.version;
        }
      }

      currentDir = dirname(currentDir);
    }
  } catch {
    // Fall back to package root probing below.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkgUnknown: unknown = require(resolve(process.cwd(), 'node_modules', packageName, 'package.json'));
    const pkg = pkgUnknown as VersionedPackageJson;
    return typeof pkg.version === 'string' ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

function getPackageNameForDependency(depName: string): string {
  return depName.startsWith('@') ? depName.split('/').slice(0, 2).join('/') : depName.split('/')[0];
}

function makeIdent(name: string): string {
  if (name.includes('/')) {
    name = name.slice(name.indexOf('/') + 1);
  }
  if (name.endsWith('-app')) {
    name = name.slice(0, -4);
  }
  return name;
}

function mergeFunction(objValue: unknown, srcValue: unknown) {
  if (Array.isArray(objValue)) {
    const target = objValue as unknown[];
    return target.concat(srcValue);
  }
}

function getPackageJson(root: string): NormalizedPackageJson {
  const appPkgUnknown: unknown = require(resolve(root, 'package.json'));
  const appPkg = (appPkgUnknown ?? {}) as AppPackageJson;

  const name = typeof appPkg.name === 'string' ? appPkg.name : 'openmrs-app';
  const version = typeof appPkg.version === 'string' ? appPkg.version : '0.0.0';
  const main = typeof appPkg.main === 'string' ? appPkg.main : 'src/index.ts';
  const types = typeof appPkg.types === 'string' ? appPkg.types : main;

  return {
    name,
    version,
    main,
    types,
    browser: appPkg.browser,
    peerDependencies: appPkg.peerDependencies ?? {},
  };
}

function slugify(name: string) {
  return name.replace(/[/\-@]/g, '_');
}

function fileExistsSync(name: string) {
  return existsSync(name) && statSync(name).isFile();
}

/**
 * This object will be merged into the webpack config.
 * Array values will be concatenated with the existing array.
 * Make sure to modify this object and not reassign it.
 */
export const overrides: Partial<OpenmrsRspackConfig> = {};

/**
 * The keys of this object will override the top-level keys
 * of the webpack config.
 * Make sure to modify this object and not reassign it.
 */
export const additionalConfig: Partial<OpenmrsRspackConfig> = {};

/**
 * This object will be merged into the webpack rule governing
 * the loading of JS, JSX, TS, etc. files.
 * Make sure to modify this object and not reassign it.
 */
export const scriptRuleConfig: Partial<RuleSetRule> = {};

/**
 * This object will be merged into the webpack rule governing
 * the loading of CSS files.
 * Make sure to modify this object and not reassign it.
 */
export const cssRuleConfig: Partial<RuleSetRule> = {};

/**
 * This object will be merged into the webpack rule governing
 * the loading of SCSS files.
 * Make sure to modify this object and not reassign it.
 */
export const scssRuleConfig: Partial<RuleSetRule> = {};

/**
 * This object will be merged into the webpack rule governing
 * the loading of static asset files.
 * Make sure to modify this object and not reassign it.
 */
export const assetRuleConfig: Partial<RuleSetRule> = {};

/**
 * This object will be merged into the webpack rule governing
 * the watch options.
 * Make sure to modify this object and not reassign it.
 */
export const watchConfig: Partial<OpenmrsRspackConfig['watchOptions']> = {};

/**
 * This object will be merged with the webpack optimization
 * object.
 * Make sure to modify this object and not reassign it.
 */
export const optimizationConfig: Partial<OpenmrsRspackConfig['optimization']> = {};

export default (env: Record<string, string>, argv: Record<string, string> = {}) => {
  const root = process.cwd();
  const { name, version, peerDependencies, browser, main, types } = getPackageJson(root);
  // this typing is provably incorrect, but actually works
  const mode = (argv.mode || process.env.NODE_ENV || 'development') as OpenmrsRspackConfig['mode'];
  const filename = basename(browser || main);
  const outDir = dirname(browser || main);
  const srcFile = resolve(root, browser ? main : types);
  const ident = makeIdent(name);
  const frameworkVersion = getFrameworkVersion();
  const routes = resolve(root, 'src', 'routes.json');
  const hasRoutesDefined = fileExistsSync(routes);

  if (!hasRoutesDefined) {
    console.error(
      'This app does not define a routes.json. This file is required for this app to be used by the OpenMRS 3 App Shell.',
    );
    // key-smash error code
    // so this (hopefully) doesn't interfere with Webpack-specific exit codes
    process.exit(9819023573289);
  }

  const cssLoader = {
    loader: require.resolve('css-loader'),
    options: {
      modules: {
        namedExport: false,
        localIdentName: `${ident}__[name]__[local]___[hash:base64:5]`,
      },
    },
  };

  const baseConfig: OpenmrsRspackConfig = {
    // The only `entry` in the application is the app shell. Everything else is
    // a Webpack Module Federation "remote." This ensures that there is always
    // only one container context--i.e., if we had an entry point per module,
    // WMF could get confused and not resolve shared dependencies correctly.
    output: {
      publicPath: 'auto',
      path: resolve(root, outDir),
      hashFunction: 'xxhash64',
      filename: `${ident}-[name]-[contenthash:8].js`,
      chunkFilename: `${ident}-[name]-[contenthash:8].js`,
    },
    module: {
      rules: [
        merge(
          {
            test: /\.m?(js|ts|tsx)$/,
            exclude: (path: string) =>
              path.includes('node_modules') && !path.includes('@openmrs') && !path.includes('@sihsalus'),
            loader: require.resolve('swc-loader'),
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                  },
                },
                target: 'es2020',
              },
            },
          },
          scriptRuleConfig,
        ),
        merge(
          {
            test: /\.css$/,
            use: [require.resolve('style-loader'), cssLoader],
          },
          cssRuleConfig,
        ),
        merge(
          {
            test: /\.s[ac]ss$/i,
            use: [
              require.resolve('style-loader'),
              cssLoader,
              {
                loader: require.resolve('sass-loader'),
                options: {
                  api: 'modern-compiler',
                  implementation: require.resolve('sass-embedded'),
                  sassOptions: { quietDeps: true, loadPaths: [resolve(root, '..', '..', '..', 'node_modules')] },
                },
              },
            ],
          },
          scssRuleConfig,
        ),
        merge(
          {
            test: /\.(png|jpe?g|gif|svg)$/i,
            type: 'asset/resource',
          },
          assetRuleConfig,
        ),
      ],
    },
    mode,
    devtool: mode === production ? false : 'source-map',
    stats: mode === production ? 'normal' : 'errors-warnings',
    infrastructureLogging: {
      level: 'warn',
    },
    devServer: {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      devMiddleware: {
        writeToDisk: true,
      },
      static: [resolve(root, outDir)],
    },
    watchOptions: merge(
      {
        ignored: ['.git', 'test-results'],
      },
      watchConfig,
    ),
    performance: {
      hints: mode === production && 'warning',
    },
    optimization: merge(
      {
        // The defaults for both of these are 30; however, due to the modular nature of
        // the frontend, we want each app to produce substantially
        splitChunks: {
          maxAsyncRequests: 3,
          maxInitialRequests: 1,
        },
        minimizer: [
          new rspack.SwcJsMinimizerRspackPlugin(),
          new rspack.LightningCssMinimizerRspackPlugin({
            minimizerOptions: {
              targets: ['last 2 Chrome versions', 'Firefox ESR', 'last 2 Safari versions'],
            },
          }),
        ],
      },
      optimizationConfig,
    ),
    plugins: [
      mode !== production &&
        new TsCheckerRspackPlugin({
          issue: {
            exclude: [(issue) => issue.file?.includes('node_modules') ?? false],
          },
        }),
      new CleanWebpackPlugin(),
      new (BundleAnalyzerPlugin as unknown as new (options: { analyzerMode: 'server' | 'disabled' }) => Plugin)({
        analyzerMode: env && env.analyze ? 'server' : 'disabled',
      }),
      new DefinePlugin({
        'process.env.FRAMEWORK_VERSION': JSON.stringify(frameworkVersion),
      }),
      new rspack.ProvidePlugin({
        React: 'react',
      }),
      new ModuleFederationPlugin({
        // Look in the `esm-dynamic-loading` framework package for an explanation of how modules
        // get loaded into the application.
        name: slugify(name),
        library: { type: 'var', name: slugify(name) },
        filename,
        exposes: {
          './start': srcFile,
        },
        shared: [
          ...new Set([
            ...Object.keys(peerDependencies),
            ...alwaysHostSharedDependencies,
            '@openmrs/esm-framework/src/internal',
          ]),
        ].reduce<Record<string, SharedDependencyConfig>>((obj, depName) => {
          const versionSpec = peerDependencies[depName] ?? false;

          if (typeof versionSpec === 'string' && versionSpec.startsWith('workspace:')) {
            const msg =
              `[rspack-config] Invalid workspace protocol in peerDependencies: ` +
              `"${depName}": "${versionSpec}" (package: ${name}). ` +
              `Workspace protocols are not valid at runtime and will break Module Federation shared modules. ` +
              `Replace "workspace:*" with "*" or an explicit semver range in ${name}/package.json.`;
            console.error(msg);
            throw new Error(msg);
          }

          if (depName === 'swr') {
            // SWR is annoying with Module Federation
            // See: https://github.com/webpack/webpack/issues/16125 and https://github.com/vercel/swr/issues/2356
            // Must match the app-shell host config which shares as 'swr/_internal'
            obj['swr/_internal'] = {
              requiredVersion: peerDependencies['swr'] ?? false,
              strictVersion: false,
              singleton: true,
              import: 'swr/_internal',
              shareKey: 'swr/_internal',
              shareScope: 'default',
              version: (require('swr/package.json') as VersionedPackageJson).version,
            };
          } else {
            const installedVersion = getInstalledVersion(depName);
            const packageName = getPackageNameForDependency(depName);
            obj[depName] = {
              requiredVersion: versionSpec,
              strictVersion: false,
              singleton: true,
              import: alwaysHostSharedDependencies.has(depName) ? false : depName,
              ...(depName !== packageName ? { packageName } : {}),
              shareKey: depName,
              shareScope: 'default',
              version: installedVersion,
            };
          }

          return obj;
        }, {}),
      }),
      hasRoutesDefined &&
        new CopyRspackPlugin({
          patterns: [
            {
              from: routes,
              transform: {
                transformer: (content) =>
                  JSON.stringify(
                    Object.assign({}, JSON.parse(content.toString()) as Record<string, unknown>, {
                      version: mode === production ? version : (inc(version, 'prerelease', 'local') ?? version),
                    }),
                  ),
              },
            },
          ],
        }),
      new (
        StatsWriterPlugin as unknown as new (options: {
          filename: string;
          stats: { all: boolean; chunks: boolean };
        }) => Plugin
      )({
        filename: `${filename}.buildmanifest.json`,
        stats: {
          all: false,
          chunks: true,
        },
      }),
    ].filter((plugin): plugin is Exclude<typeof plugin, false> => Boolean(plugin)),
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.scss', '.json'],
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.jsx': ['.tsx', '.jsx'],
      },
      alias: {
        'lodash.debounce': 'lodash-es/debounce',
        'lodash.findlast': 'lodash-es/findLast',
        'lodash.omit': 'lodash-es/omit',
        'lodash.throttle': 'lodash-es/throttle',
      },
      tsConfig: existsSync(resolve(root, 'tsconfig.json')) ? resolve(root, 'tsconfig.json') : undefined,
    },
    ...overrides,
  };
  return mergeWith(baseConfig, additionalConfig, mergeFunction);
};
