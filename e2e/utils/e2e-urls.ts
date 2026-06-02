const DEFAULT_SPA_BASE_URL = 'http://localhost:8080/openmrs/spa';

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path = '') {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = path.replace(/^\/+/, '');

  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

export function getOpenmrsBaseUrl() {
  const configuredApiBaseUrl = process.env.E2E_API_BASE_URL;
  if (configuredApiBaseUrl) {
    return trimTrailingSlash(configuredApiBaseUrl);
  }

  const configuredBaseUrl = trimTrailingSlash(process.env.E2E_BASE_URL ?? DEFAULT_SPA_BASE_URL);
  return configuredBaseUrl.replace(/\/spa$/, '');
}

export function getSpaBaseUrl() {
  const configuredBaseUrl = trimTrailingSlash(process.env.E2E_BASE_URL ?? DEFAULT_SPA_BASE_URL);

  if (configuredBaseUrl.endsWith('/spa')) {
    return `${configuredBaseUrl}/`;
  }

  return `${configuredBaseUrl}/spa/`;
}

export function getSpaUrl(path = '') {
  return joinUrl(getSpaBaseUrl(), path);
}

export function getOpenmrsRestBaseUrl() {
  return `${joinUrl(getOpenmrsBaseUrl(), 'ws/rest/v1')}/`;
}

export function getOpenmrsRestUrl(path = '') {
  return joinUrl(getOpenmrsRestBaseUrl(), path);
}

export function getOpenmrsFhirBaseUrl() {
  return `${joinUrl(getOpenmrsBaseUrl(), 'ws/fhir2/R4')}/`;
}

export function getOpenmrsFhirUrl(path = '') {
  return joinUrl(getOpenmrsFhirBaseUrl(), path);
}

export function shouldIgnoreHTTPSErrors() {
  return process.env.SIHSALUS_ALLOW_SELF_SIGNED_TLS === 'true' || process.env.E2E_IGNORE_HTTPS_ERRORS === 'true';
}
