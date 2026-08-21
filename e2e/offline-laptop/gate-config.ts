const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shaPattern = /^[0-9a-f]{40}$/i;

export type OfflineLaptopGateTarget = 'DEV' | 'QLTY';

const allowedTargetOrigins: Record<OfflineLaptopGateTarget, string> = {
  DEV: 'https://gidis-hsc-dev.inf.pucp.edu.pe',
  QLTY: 'https://gidis-hsc-qlty.inf.pucp.edu.pe',
};

export interface OfflineLaptopGateConfig {
  allowedOrigin: string;
  apiBaseUrl: string;
  expectedBuildSha: string;
  identifierSourceUuid: string;
  identifierTypeUuid: string;
  locationUuid: string;
  spaBaseUrl: string;
  target: OfflineLaptopGateTarget;
  visitTypeUuid: string;
}

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Offline laptop gate preflight failed: ${name} is required.`);
  }

  return value;
}

function parseAbsoluteUrl(value: string, name: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`Offline laptop gate preflight failed: ${name} must be an absolute URL.`);
  }
}

function requireUuid(environment: NodeJS.ProcessEnv, name: string): string {
  const value = requireValue(environment, name);

  if (!uuidPattern.test(value)) {
    throw new Error(`Offline laptop gate preflight failed: ${name} must be a canonical UUID.`);
  }

  return value;
}

function requireTarget(environment: NodeJS.ProcessEnv): OfflineLaptopGateTarget {
  const value = requireValue(environment, 'E2E_OFFLINE_GATE_TARGET').toUpperCase();

  if (value !== 'DEV' && value !== 'QLTY') {
    throw new Error('Offline laptop gate preflight failed: E2E_OFFLINE_GATE_TARGET must be DEV or QLTY.');
  }

  return value;
}

/**
 * Loads the state-changing gate configuration and rejects any target outside the
 * explicit SIH Salus DEV/QLTY allowlist.
 * This function deliberately has no defaults: invoking the dedicated suite must be an
 * explicit, reviewable choice.
 */
export function loadOfflineLaptopGateConfig(environment: NodeJS.ProcessEnv = process.env): OfflineLaptopGateConfig {
  if (environment.E2E_OFFLINE_GATE_ENABLED !== 'true') {
    throw new Error(
      'Offline laptop gate preflight failed: set E2E_OFFLINE_GATE_ENABLED=true only for a coordinated DEV/QLTY run.',
    );
  }

  const target = requireTarget(environment);
  const expectedOrigin = allowedTargetOrigins[target];

  if (environment.E2E_SKIP_AUTH === 'true') {
    throw new Error('Offline laptop gate preflight failed: E2E_SKIP_AUTH=true is not supported.');
  }

  requireValue(environment, 'E2E_USER_ADMIN_USERNAME');
  requireValue(environment, 'E2E_USER_ADMIN_PASSWORD');

  const configuredSpaUrl = parseAbsoluteUrl(requireValue(environment, 'E2E_BASE_URL'), 'E2E_BASE_URL');
  const configuredApiUrl = parseAbsoluteUrl(requireValue(environment, 'E2E_API_BASE_URL'), 'E2E_API_BASE_URL');
  const configuredAllowedOrigin = parseAbsoluteUrl(
    requireValue(environment, 'E2E_OFFLINE_GATE_ALLOWED_ORIGIN'),
    'E2E_OFFLINE_GATE_ALLOWED_ORIGIN',
  );

  for (const [name, url] of [
    ['E2E_BASE_URL', configuredSpaUrl],
    ['E2E_API_BASE_URL', configuredApiUrl],
    ['E2E_OFFLINE_GATE_ALLOWED_ORIGIN', configuredAllowedOrigin],
  ] as const) {
    if (url.protocol !== 'https:') {
      throw new Error(`Offline laptop gate preflight failed: ${name} must use HTTPS.`);
    }

    if (url.username || url.password) {
      throw new Error(`Offline laptop gate preflight failed: ${name} cannot contain embedded credentials.`);
    }

    if (url.origin !== expectedOrigin) {
      throw new Error(
        `Offline laptop gate preflight failed: ${name} must exactly match the ${target} origin ${expectedOrigin}.`,
      );
    }
  }

  if (configuredAllowedOrigin.pathname !== '/' || configuredAllowedOrigin.search || configuredAllowedOrigin.hash) {
    throw new Error(
      'Offline laptop gate preflight failed: E2E_OFFLINE_GATE_ALLOWED_ORIGIN must contain only scheme and host.',
    );
  }

  if (
    configuredSpaUrl.origin !== configuredApiUrl.origin ||
    configuredSpaUrl.origin !== configuredAllowedOrigin.origin
  ) {
    throw new Error(
      'Offline laptop gate preflight failed: SPA, API, and the explicit non-production allowlist must use the same origin.',
    );
  }

  const spaPath = configuredSpaUrl.pathname.replace(/\/+$/, '');
  const apiPath = configuredApiUrl.pathname.replace(/\/+$/, '');
  if (spaPath !== `${apiPath}/spa`) {
    throw new Error('Offline laptop gate preflight failed: E2E_BASE_URL must be the /spa child of E2E_API_BASE_URL.');
  }

  if (configuredSpaUrl.search || configuredSpaUrl.hash || configuredApiUrl.search || configuredApiUrl.hash) {
    throw new Error('Offline laptop gate preflight failed: SPA and API base URLs cannot contain query or hash data.');
  }

  const expectedBuildSha = requireValue(environment, 'E2E_OFFLINE_GATE_EXPECTED_SHA');
  if (!shaPattern.test(expectedBuildSha)) {
    throw new Error(
      'Offline laptop gate preflight failed: E2E_OFFLINE_GATE_EXPECTED_SHA must be the full 40-character deployed SHA.',
    );
  }

  return {
    allowedOrigin: configuredAllowedOrigin.origin,
    apiBaseUrl: configuredApiUrl.href.replace(/\/+$/, ''),
    expectedBuildSha: expectedBuildSha.toLowerCase(),
    identifierSourceUuid: requireUuid(environment, 'E2E_OFFLINE_IDENTIFIER_SOURCE_UUID'),
    identifierTypeUuid: requireUuid(environment, 'E2E_OFFLINE_IDENTIFIER_TYPE_UUID'),
    locationUuid: requireUuid(environment, 'E2E_LOGIN_DEFAULT_LOCATION_UUID'),
    spaBaseUrl: configuredSpaUrl.href.replace(/\/+$/, ''),
    target,
    visitTypeUuid: requireUuid(environment, 'E2E_OFFLINE_VISIT_TYPE_UUID'),
  };
}
