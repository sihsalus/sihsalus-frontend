const { normalizeDevBackendUrl } = require('./dev-backend-url');

// Gateway protocol endpoint; it is intentionally outside the OpenMRS context.
const clinicalActivityPath = '/_sihsalus/clinical-activity';
const clinicalActivityTimeoutMs = 3000;

function createClinicalActivityHandler({
  backend,
  getBackendFetchDispatcher = () => undefined,
  fetchImpl = fetch,
  timeoutMs = clinicalActivityTimeoutMs,
}) {
  const endpoint = new URL(clinicalActivityPath, normalizeDevBackendUrl(backend));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > clinicalActivityTimeoutMs) {
    throw new Error('Invalid clinical activity timeout configuration.');
  }

  return async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    if (req.method !== 'POST') {
      res.status(405).end();
      return;
    }
    if (
      (req.originalUrl || req.url) !== clinicalActivityPath ||
      (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0') ||
      req.headers['transfer-encoding'] !== undefined ||
      ['authorization', 'proxy-authorization', 'cookie', 'referer'].some((header) => req.headers[header] !== undefined)
    ) {
      res.status(400).end();
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const dispatcher = getBackendFetchDispatcher();
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        body: null,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      });
      const status =
        response.status === 204 || (response.status >= 400 && response.status <= 599) ? response.status : 502;
      res.status(status).end();
    } catch {
      res.status(controller.signal.aborted ? 504 : 502).end();
    } finally {
      clearTimeout(timeout);
      // Release any upstream body without reading or forwarding clinical/error content.
      controller.abort();
    }
  };
}

module.exports = { clinicalActivityPath, clinicalActivityTimeoutMs, createClinicalActivityHandler };
