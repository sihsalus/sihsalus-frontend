function normalizeDevBackendUrl(value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new Error('SIHSALUS_BACKEND_URL must be a valid HTTP(S) backend URL.');
  }
  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error('SIHSALUS_BACKEND_URL must use HTTP(S) without credentials, a query, or a fragment.');
  }

  // The CLI proxy forwards paths that already include the /openmrs context.
  // Accept the API base used by E2E without producing /openmrs/openmrs/...
  if (parsedUrl.pathname.replace(/\/+$/, '') === '/openmrs') {
    parsedUrl.pathname = '/';
  }
  return parsedUrl.toString().replace(/\/+$/, '');
}

module.exports = { normalizeDevBackendUrl };
