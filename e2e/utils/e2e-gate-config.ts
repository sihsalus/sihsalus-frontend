const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type E2EGateTarget = 'DEV' | 'QLTY';

const allowedBackendOrigins: Record<E2EGateTarget, string> = {
  DEV: 'https://gidis-hsc-dev.inf.pucp.edu.pe',
  QLTY: 'https://gidis-hsc-qlty.inf.pucp.edu.pe',
};

const loopbackHostnames = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface E2EGateConfig {
  apiBaseUrl: string;
  appointmentsPatientUuid: string;
  locationUuid: string;
  patientUuid: string;
  spaBaseUrl: string;
  target: E2EGateTarget;
}

export interface E2EPatientIdentity {
  display?: string;
  identifiers?: Array<{ identifier?: string; voided?: boolean }>;
  person?: {
    display?: string;
    names?: Array<{
      familyName?: string;
      givenName?: string;
      middleName?: string;
      voided?: boolean;
    }>;
  };
}

const syntheticPatientMarkerPattern = /(?:^|\W)(?:E2E|SYNTHETIC)(?:\W|$)/i;

export function isSyntheticE2EPatient(patient: E2EPatientIdentity): boolean {
  const markerValues = [
    patient.display,
    patient.person?.display,
    ...(patient.identifiers?.filter(({ voided }) => !voided).map(({ identifier }) => identifier) ?? []),
    ...(patient.person?.names
      ?.filter(({ voided }) => !voided)
      .flatMap(({ familyName, givenName, middleName }) => [familyName, givenName, middleName]) ?? []),
  ];

  return markerValues.some((value) => syntheticPatientMarkerPattern.test(value ?? ''));
}

function requireValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Clinical E2E preflight failed: ${name} is required.`);
  }

  return value;
}

function requireUuid(environment: NodeJS.ProcessEnv, name: string): string {
  const value = requireValue(environment, name);

  if (!uuidPattern.test(value)) {
    throw new Error(`Clinical E2E preflight failed: ${name} must be a canonical UUID.`);
  }

  return value;
}

function parseAbsoluteUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Clinical E2E preflight failed: ${name} must be an absolute URL.`);
  }

  if (url.username || url.password) {
    throw new Error(`Clinical E2E preflight failed: ${name} cannot contain embedded credentials.`);
  }
  if (url.search || url.hash) {
    throw new Error(`Clinical E2E preflight failed: ${name} cannot contain query or hash data.`);
  }

  return url;
}

function requireTarget(environment: NodeJS.ProcessEnv): E2EGateTarget {
  const value = requireValue(environment, 'E2E_GATE_TARGET').toUpperCase();

  if (value !== 'DEV' && value !== 'QLTY') {
    throw new Error('Clinical E2E preflight failed: E2E_GATE_TARGET must be DEV or QLTY.');
  }

  return value;
}

function normalizedPath(url: URL) {
  return url.pathname.replace(/\/+$/, '') || '/';
}

/**
 * Loads the browser gate configuration and rejects any backend outside the
 * explicit SIH Salus non-production allowlist. The SPA may be the deployed
 * target or a loopback dev server that proxies to that target.
 */
export function loadE2EGateConfig(environment: NodeJS.ProcessEnv = process.env): E2EGateConfig {
  const target = requireTarget(environment);
  const allowedBackendOrigin = allowedBackendOrigins[target];

  if (environment.E2E_SKIP_AUTH === 'true') {
    throw new Error('Clinical E2E preflight failed: E2E_SKIP_AUTH=true is not supported by the clinical gate.');
  }

  requireValue(environment, 'E2E_USER_ADMIN_USERNAME');
  requireValue(environment, 'E2E_USER_ADMIN_PASSWORD');

  const apiUrl = parseAbsoluteUrl(requireValue(environment, 'E2E_API_BASE_URL'), 'E2E_API_BASE_URL');
  const spaUrl = parseAbsoluteUrl(requireValue(environment, 'E2E_BASE_URL'), 'E2E_BASE_URL');

  if (apiUrl.protocol !== 'https:' || apiUrl.origin !== allowedBackendOrigin) {
    throw new Error(
      `Clinical E2E preflight failed: E2E_API_BASE_URL must use the ${target} origin ${allowedBackendOrigin}.`,
    );
  }
  if (normalizedPath(apiUrl) !== '/openmrs') {
    throw new Error('Clinical E2E preflight failed: E2E_API_BASE_URL must end at /openmrs.');
  }

  const spaIsLoopback = loopbackHostnames.has(spaUrl.hostname);
  if (!spaIsLoopback && (spaUrl.protocol !== 'https:' || spaUrl.origin !== allowedBackendOrigin)) {
    throw new Error(
      `Clinical E2E preflight failed: E2E_BASE_URL must use loopback or the ${target} origin ${allowedBackendOrigin}.`,
    );
  }
  if (spaIsLoopback && spaUrl.protocol !== 'http:' && spaUrl.protocol !== 'https:') {
    throw new Error('Clinical E2E preflight failed: a loopback E2E_BASE_URL must use HTTP or HTTPS.');
  }
  if (normalizedPath(spaUrl) !== '/openmrs/spa') {
    throw new Error('Clinical E2E preflight failed: E2E_BASE_URL must end at /openmrs/spa.');
  }

  return {
    apiBaseUrl: apiUrl.href.replace(/\/+$/, ''),
    appointmentsPatientUuid: requireUuid(environment, 'E2E_APPOINTMENTS_PATIENT_UUID'),
    locationUuid: requireUuid(environment, 'E2E_LOGIN_DEFAULT_LOCATION_UUID'),
    patientUuid: requireUuid(environment, 'E2E_PATIENT_UUID'),
    spaBaseUrl: spaUrl.href.replace(/\/+$/, ''),
    target,
  };
}
