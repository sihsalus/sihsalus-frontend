function trimTrailingSlash(value) {
  return value.trim().replace(/\/+$/, '');
}

export function getOpenmrsBaseUrl(defaultSpaBaseUrl = 'http://localhost:8080/openmrs/spa') {
  if (process.env.E2E_API_BASE_URL) {
    return trimTrailingSlash(process.env.E2E_API_BASE_URL);
  }

  const configuredBaseUrl = trimTrailingSlash(process.env.E2E_BASE_URL ?? defaultSpaBaseUrl);
  return configuredBaseUrl.replace(/\/spa$/, '');
}

export function getSpaBaseUrl(defaultSpaBaseUrl = 'http://localhost:8080/openmrs/spa') {
  const configuredBaseUrl = trimTrailingSlash(process.env.E2E_BASE_URL ?? defaultSpaBaseUrl);

  if (configuredBaseUrl.endsWith('/spa')) {
    return configuredBaseUrl;
  }

  return `${configuredBaseUrl}/spa`;
}
