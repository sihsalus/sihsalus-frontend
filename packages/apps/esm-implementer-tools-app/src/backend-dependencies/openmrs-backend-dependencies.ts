/* eslint-disable @typescript-eslint/no-explicit-any */
import { isVersionSatisfied, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import difference from 'lodash-es/difference';

export type ResolvedBackendModuleType = 'missing' | 'version-mismatch' | 'okay';

export interface ResolvedBackendModule {
  name: string;
  requiredVersion: string;
  installedVersion?: string;
  type: ResolvedBackendModuleType;
}

export interface ResolvedDependenciesModule {
  name: string;
  dependencies: Array<ResolvedBackendModule>;
}

interface Module {
  moduleName: string;
  backendDependencies?: Record<string, string>;
  optionalBackendDependencies?: {
    [k: string]:
      | string
      | {
          version: string;
          feature?: string;
        };
  };
}

interface VersionCheckModule extends Omit<Module, 'optionalBackendDependencies'> {
  optionalBackendDependencies?: Record<string, string>;
}

interface BackendModule {
  uuid: string;
  version: string;
}

let cachedFrontendModules: Array<ResolvedDependenciesModule> | undefined;
let pendingFrontendModules: Promise<Array<ResolvedDependenciesModule>> | undefined;
let backendConnectionError: Error | null = null;
let frontendModulesGeneration = 0;

const MAX_PAGES = 50;
const TRANSIENT_GATEWAY_STATUSES = new Set([502, 503, 504]);
const TRANSIENT_RETRY_DELAYS_MS = [250, 750] as const;

function clearBackendConnectionError() {
  backendConnectionError = null;
}

function getHttpStatus(error: unknown, visited = new Set<unknown>()): number | null {
  if (!error || (typeof error !== 'object' && typeof error !== 'string') || visited.has(error)) {
    return null;
  }

  visited.add(error);

  if (typeof error === 'object') {
    const errorRecord = error as {
      cause?: unknown;
      response?: { status?: unknown };
      status?: unknown;
      statusCode?: unknown;
    };
    const statusCandidates = [errorRecord.response?.status, errorRecord.status, errorRecord.statusCode];

    for (const candidate of statusCandidates) {
      const status = typeof candidate === 'number' ? candidate : Number(candidate);
      if (Number.isInteger(status) && status >= 100 && status <= 599) {
        return status;
      }
    }

    const causeStatus = getHttpStatus(errorRecord.cause, visited);
    if (causeStatus) {
      return causeStatus;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/\b(?:responded with|status(?:\s+code)?\s*[:=]?)\s*(\d{3})\b/i);
  return statusMatch ? Number(statusMatch[1]) : null;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));
}

async function fetchBackendModulesPage(url: string) {
  for (let retryIndex = 0; ; retryIndex += 1) {
    try {
      return await openmrsFetch(url, { method: 'GET', rejectOnAuthFailure: true });
    } catch (error) {
      const status = getHttpStatus(error);
      const retryDelay = TRANSIENT_RETRY_DELAYS_MS[retryIndex];

      if (!status || !TRANSIENT_GATEWAY_STATUSES.has(status) || retryDelay === undefined) {
        throw error;
      }

      await wait(retryDelay);
    }
  }
}

function checkIfModulesAreInstalled(
  module: VersionCheckModule,
  installedBackendModules: Array<BackendModule>,
): ResolvedDependenciesModule {
  const dependencies: Array<ResolvedBackendModule> = [];

  const missingBackendModule = getMissingBackendModules(module.backendDependencies, installedBackendModules);

  const installedAndRequiredModules = getInstalledAndRequiredBackendModules(
    module.backendDependencies,
    module.optionalBackendDependencies,
    installedBackendModules,
  );

  dependencies.push(
    ...missingBackendModule.map((m) => ({
      name: m.uuid,
      requiredVersion: m.version,
      type: 'missing' as ResolvedBackendModuleType,
    })),
    ...installedAndRequiredModules.map((m) => {
      const requiredVersion = m.version;
      const installedVersion = getInstalledVersion(m, installedBackendModules);
      return {
        name: m.uuid,
        requiredVersion,
        installedVersion,
        type: getResolvedModuleType(requiredVersion, installedVersion),
      };
    }),
  );

  return {
    name: module.moduleName,
    dependencies,
  };
}

async function fetchInstalledBackendModules(): Promise<Array<BackendModule>> {
  const collected: Array<BackendModule> = [];
  let nextUrl: string | null = `${restBaseUrl}/module?v=custom:(uuid,version)`;
  let safetyCounter = 0;

  const resolveNext = (url?: string | null) => {
    if (!url) {
      return null;
    }
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    if (url.startsWith('/')) {
      return url;
    }
    return `${restBaseUrl}/${url.replace(/^\/?/, '')}`;
  };

  while (nextUrl && safetyCounter < MAX_PAGES) {
    try {
      const response = await fetchBackendModulesPage(nextUrl);
      const { data } = response;

      // Handle error responses (e.g., authentication failures)
      if (data?.error) {
        console.error(`Backend API error when fetching modules: ${data.error.message || 'Unknown error'}`, data.error);
        throw new Error(
          `Backend returned error: ${data.error.message || 'Unknown error when fetching backend modules'}`,
        );
      }

      const pageResults: Array<BackendModule> = Array.isArray(data?.results) ? data.results : [];

      collected.push(...pageResults);

      const links: Array<{ rel?: string; uri?: string }> = Array.isArray(data?.links) ? data.links : [];
      const nextLink = links.find((l) => (l.rel || '').toLowerCase() === 'next');

      nextUrl = resolveNext(nextLink?.uri ?? null);
      safetyCounter += 1;
    } catch (e) {
      console.error('Failed to fetch backend modules', {
        error: e,
        page: safetyCounter + 1,
        url: nextUrl,
      });
      throw new Error(`Failed to fetch backend modules: ${e instanceof Error ? e.message : 'Unknown error'}`, {
        cause: e,
      });
    }
  }

  if (nextUrl && safetyCounter >= MAX_PAGES) {
    console.warn(
      `Reached maximum page limit (${MAX_PAGES}) while fetching backend modules. There may be more data available at: ${nextUrl}`,
    );
  }

  return collected;
}

function getMissingBackendModules(
  requiredBackendModules: Record<string, string> | undefined,
  installedBackendModules: Array<BackendModule>,
): Array<BackendModule> {
  if (!requiredBackendModules) {
    return [];
  }

  const requiredBackendModulesUuids = Object.keys(requiredBackendModules);
  const installedBackendModuleUuids = installedBackendModules.map((res) => res.uuid);

  const missingModules = difference(requiredBackendModulesUuids, installedBackendModuleUuids);

  return missingModules.map((key) => ({
    uuid: key,
    version: requiredBackendModules[key],
  }));
}

function getInstalledAndRequiredBackendModules(
  requiredBackendModules: Record<string, string> | undefined,
  optionalBackendModules: Record<string, string> | undefined,
  installedBackendModules: Array<BackendModule>,
): Array<BackendModule> {
  if (!requiredBackendModules) {
    return [];
  }

  const declaredBackendModules = { ...optionalBackendModules, ...requiredBackendModules };

  const requiredModules = Object.keys(declaredBackendModules).map((key) => ({
    uuid: key,
    version: declaredBackendModules[key],
  }));

  const installedUuids = new Set(installedBackendModules.map((module) => module.uuid));
  return requiredModules.filter((requiredModule) => installedUuids.has(requiredModule.uuid));
}

function getInstalledVersion(
  installedAndRequiredBackendModule: BackendModule,
  installedBackendModules: Array<BackendModule>,
) {
  const moduleName = installedAndRequiredBackendModule.uuid;
  return installedBackendModules.find((mod) => mod.uuid === moduleName)?.version ?? '';
}

function getResolvedModuleType(requiredVersion: string, installedVersion: string): ResolvedBackendModuleType {
  if (!isVersionSatisfied(requiredVersion, installedVersion)) {
    return 'version-mismatch';
  }

  return 'okay';
}

async function resolveFrontendModules(): Promise<Array<ResolvedDependenciesModule>> {
  const modules = (globalThis.installedModules ?? [])
    .filter((module) => Boolean(module[1]?.backendDependencies || module[1]?.optionalBackendDependencies))
    .map((module) => ({
      backendDependencies: module[1].backendDependencies,
      optionalBackendDependencies: Object.fromEntries(
        Object.entries(module[1].optionalBackendDependencies ?? {}).map(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'undefined' || value === null) {
            return [key, value];
          }

          const resolvedValue =
            typeof value === 'object' && 'version' in value && typeof value.version === 'string'
              ? value.version
              : undefined;

          return [key, resolvedValue];
        }),
      ),
      moduleName: module[0],
    }));

  const installedBackendModules = await fetchInstalledBackendModules();
  const resolvedFrontendModules = modules.map((module) => checkIfModulesAreInstalled(module, installedBackendModules));
  return resolvedFrontendModules;
}

export function checkModules({
  forceRefresh = false,
}: {
  forceRefresh?: boolean;
} = {}): Promise<Array<ResolvedDependenciesModule>> {
  if (forceRefresh) {
    frontendModulesGeneration += 1;
    cachedFrontendModules = undefined;
    pendingFrontendModules = undefined;
  }

  if (cachedFrontendModules) {
    return Promise.resolve(cachedFrontendModules);
  }

  if (!pendingFrontendModules) {
    const requestGeneration = frontendModulesGeneration;
    const request = resolveFrontendModules().then(
      (resolvedFrontendModules) => {
        if (requestGeneration === frontendModulesGeneration) {
          cachedFrontendModules = resolvedFrontendModules;
          clearBackendConnectionError();
        }
        return resolvedFrontendModules;
      },
      (error) => {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error fetching backend modules';
        const backendError = error instanceof Error ? error : new Error(errorMessage);
        console.error('Error initializing installed backend modules', error);
        if (requestGeneration === frontendModulesGeneration) {
          backendConnectionError = backendError;
        }
        throw backendError;
      },
    );
    const trackedRequest = request.finally(() => {
      if (pendingFrontendModules === trackedRequest) {
        pendingFrontendModules = undefined;
      }
    });
    pendingFrontendModules = trackedRequest;
  }

  return pendingFrontendModules;
}

export function hasInvalidDependencies(frontendModules: Array<ResolvedDependenciesModule>) {
  return frontendModules.some((m) => m.dependencies.some((n) => n.type !== 'okay'));
}

export function getBackendConnectionErrorMessage(): string | null {
  return backendConnectionError ? backendConnectionError.message : null;
}

export function getBackendConnectionErrorStatus(): number | null {
  return getHttpStatus(backendConnectionError);
}

// For use in tests
export function clearCache() {
  frontendModulesGeneration += 1;
  cachedFrontendModules = undefined;
  pendingFrontendModules = undefined;
  clearBackendConnectionError();
}
