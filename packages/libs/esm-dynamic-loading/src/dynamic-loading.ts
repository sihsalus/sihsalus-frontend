/** @module @category Dynamic Loading */

import { dispatchToastShown, type ImportMap } from '@openmrs/esm-globals';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { getCurrentPageMap, getImportMapOverrideMap, resetImportMapOverrides } from './import-maps';

type WebpackShareScopes = Record<
  string,
  Record<string, { loaded?: 1; get: () => Promise<unknown>; from: string; eager: boolean }>
>;

/**
 * @internal
 *
 * Transforms an ESM module name to a valid JS identifier
 *
 * @param name the name of a module
 * @returns An opaque, equivalent JS identifier for the module
 */
export function slugify(name: string) {
  return name.replace(/[/\-@]/g, '_');
}

/**
 * Loads the named export from a named package. This might be used like:
 *
 * ```js
 * const { someComponent } = importDynamic("@openmrs/esm-template-app")
 * ```
 *
 * @param jsPackage The package to load the export from.
 * @param share Indicates the name of the shared module; this is an advanced feature if the package you are loading
 *   doesn't use the default OpenMRS shared module name "./start".
 * @param options Additional options to control loading this script.
 * @param options.importMap The import map to use to load the script. This is useful for situations where you're
 *   loading multiple scripts at a time, since it allows the calling code to supply an importMap, saving multiple
 *   calls to `getCurrentImportMap()`.
 * @param options.maxLoadingTime A positive integer representing the maximum number of milliseconds to wait for the
 *   script to load before the promise returned from this function will be rejected. Defaults to 600,000 milliseconds,
 *   i.e., 10 minutes.
 */
export async function importDynamic<T = any>(
  jsPackage: string,
  share: string = './start',
  options?: {
    importMap?: ImportMap;
    maxLoadingTime?: number;
  },
): Promise<T> {
  // default to 10 minutes
  const maxLoadingTime = !options?.maxLoadingTime || options.maxLoadingTime <= 0 ? 600_000 : options.maxLoadingTime;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    preloadImport(jsPackage, options?.importMap),
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(
          new Error(`Could not resolve requested script, ${jsPackage}, within ${humanReadableMs(maxLoadingTime)}.`),
        );
      }, maxLoadingTime);
    }),
  ]);

  if (timeout) {
    clearTimeout(timeout);
  }

  const jsPackageSlug = slugify(jsPackage);

  const container = (window as unknown as Record<string, unknown>)[jsPackageSlug] as unknown;
  if (!isFederatedModule(container)) {
    const error = `The global variable ${jsPackageSlug} does not refer to a federated module`;
    console.error(error);
    throw new Error(error);
  }

  container.init(getWebpackShareScopes().default);

  const factory = await container.get(share);
  const module = factory();

  if (!(typeof module === 'object') || module === null) {
    const error = `Container for ${jsPackage} did not return an ESM module as expected`;
    console.error(error);
    throw new Error(error);
  }

  return module as unknown as T;
}

/**
 * Utility function to convert milliseconds into human-readable strings with rather absurd
 * levels of precision.
 *
 * @param ms Number of milliseconds
 * @returns A human-readable string useful only for error logging, where we can assume English
 */
function humanReadableMs(ms: number) {
  if (ms < 1_000) {
    return `${ms} milliseconds`;
  } else if (ms < 60_000) {
    return `${Math.floor(ms / 1000)} seconds`;
  } else if (ms < 3_600_000) {
    return `${Math.floor(ms / 60_000)} minutes`;
  } else if (ms < 86_400_000) {
    return `${Math.floor(ms / 3_600_000)} hours`;
  } else {
    return `${Math.floor(ms / 86_400_000)} days`;
  }
}

/**
 * @internal
 *
 * This internal method is used to ensure that the script belonging
 * to the given package is loaded and added to the head.
 *
 * @param jsPackage The package to load
 * @param importMap The import map to use for loading this package.
 *  The main reason for specifying this is to avoid needing to call
 *  `getCurrentPageMap()` for every script when bulk loading.
 */
export async function preloadImport(jsPackage: string, importMap?: ImportMap) {
  if (typeof jsPackage !== 'string' || jsPackage.trim().length === 0) {
    const error = 'Attempted to call importDynamic() without supplying a package to load';
    console.error(error);
    throw new Error(error);
  }

  const jsPackageSlug = slugify(jsPackage);

  if (!(window as unknown as Record<string, unknown>)[jsPackageSlug]) {
    const activeImportMap = importMap ?? (await getCurrentImportMap());
    if (!Object.hasOwn(activeImportMap.imports, jsPackage)) {
      const error = `Could not find the package ${jsPackage} defined in the current importmap`;
      console.error(error);
      throw new Error(error);
    }

    let url = activeImportMap.imports[jsPackage];
    if (url.startsWith('./')) {
      url = window.spaBase + url.substring(1);
    }

    const isOverridden = jsPackage in getImportMapOverrideMap().imports;
    try {
      return await new Promise<null>((resolve, reject: (reason?: unknown) => void) => {
        loadScript(url, resolve, reject);
      });
    } catch (err: any) {
      if (isOverridden) {
        dispatchToastShown({
          kind: 'error',
          title: getCoreTranslation('scriptLoadingFailed', 'Error: Script failed to load'),
          description: getCoreTranslation(
            'scriptLoadingError',
            'Failed to load overridden script from {{- url}}. Please check that the bundled script is available at the expected URL. Click the button below to reset all import map overrides.',
            {
              url,
            },
          ),
          actionButtonLabel: getCoreTranslation('resetOverrides', 'Reset overrides'),
          onActionButtonClick() {
            resetImportMapOverrides();
            window.location.reload();
          },
        });
      }

      throw err;
    }
  }
}

/**
 * @internal
 *
 * Used to load the current import map.
 *
 * @returns The current import map.
 */
export async function getCurrentImportMap() {
  return getCurrentPageMap();
}

interface FederatedModule {
  init: (scope: WebpackShareScopes['default']) => void;
  get: (_export: string) => Promise<() => unknown>;
}

function getWebpackShareScopes() {
  return (globalThis as typeof globalThis & { __webpack_share_scopes__: WebpackShareScopes }).__webpack_share_scopes__;
}

function isFederatedModule(a: unknown): a is FederatedModule {
  return (
    typeof a === 'object' &&
    a !== null &&
    'init' in a &&
    typeof a['init'] === 'function' &&
    'get' in a &&
    typeof a['get'] === 'function'
  );
}

// internals to track script loading
// basically, if we're already loading a script, we should wait until the script is loaded
// we use a global to track this
const OPENMRS_SCRIPT_LOADING = Symbol('__openmrs_script_loading');

/**
 * Appends a `<script>` to the DOM with the given URL.
 */
function loadScript(
  url: string,
  resolve: (value: null | PromiseLike<null>) => void,
  reject: (reason?: unknown) => void,
) {
  const globalLoadingState = window as unknown as Record<PropertyKey, Set<string> | undefined>;
  const scriptElement = document.head.querySelector(`script[src="${url}"]`);
  let scriptLoading = globalLoadingState[OPENMRS_SCRIPT_LOADING];
  if (!scriptLoading) {
    scriptLoading = new Set<string>();
    globalLoadingState[OPENMRS_SCRIPT_LOADING] = scriptLoading;
  }

  if (!scriptElement) {
    scriptLoading.add(url);
    const element = document.createElement('script');
    element.src = url;
    element.type = 'text/javascript';
    element.async = true;

    // loadTime() displays an error if a script takes more than 5 seconds to load
    const loadTimeout = setTimeout(() => {
      console.error(
        `The script at ${url} did not load within 5 seconds. This may indicate an issue with the imports in the script's entry-point file or with the script's bundler configuration.`,
      );
    }, 5_000); // 5 seconds; this is arbitrary

    let loadFn: () => void, errFn: EventListener, finishScriptLoading: () => void;

    finishScriptLoading = () => {
      clearTimeout(loadTimeout);
      scriptLoading.delete(url);

      if (loadFn) {
        element.removeEventListener('load', loadFn);
      }

      if (errFn) {
        element.removeEventListener('error', errFn);
      }
    };

    loadFn = () => {
      finishScriptLoading();
      resolve(null);
    };

    errFn = (event: Event) => {
      const ev = event as ErrorEvent;
      finishScriptLoading();
      const msg = `Failed to load script from ${url}`;
      console.error(msg, ev);
      reject(ev.message ?? msg);
    };

    element.addEventListener('load', loadFn);
    element.addEventListener('error', errFn);

    document.head.appendChild(element);
  } else {
    if (scriptLoading.has(url)) {
      let loadFn: () => void, errFn: EventListener, finishScriptLoading: () => void;

      finishScriptLoading = () => {
        if (loadFn) {
          scriptElement.removeEventListener('load', loadFn);
        }

        if (errFn) {
          scriptElement.removeEventListener('error', errFn);
        }
      };

      loadFn = () => {
        finishScriptLoading();
        resolve(null);
      };

      // this errFn does not log anything
      errFn = (event: Event) => {
        const ev = event as ErrorEvent;
        finishScriptLoading();
        reject(ev.message);
      };

      scriptElement.addEventListener('load', loadFn);
      scriptElement.addEventListener('error', errFn);
    } else {
      console.warn(`Script at ${url} already loaded. Not loading it again.`);
      resolve(null);
    }
  }
}
