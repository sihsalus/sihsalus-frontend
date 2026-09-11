import { type Page } from '@playwright/test';
import { getOpenmrsRestBaseUrl, getSpaBaseUrl } from './e2e-urls';

export const reniecContractDocument = '12345678';

export function classifyReniecContractRequest(rawUrl: string, method: string, restBaseUrls: readonly string[]) {
  let url: URL;
  let bases: URL[];
  try {
    url = new URL(rawUrl);
    bases = restBaseUrls.map((base) => new URL(base));
  } catch {
    return 'blocked';
  }
  if (
    url.username ||
    url.password ||
    /[%\\;]/.test(url.pathname) ||
    url.pathname.includes('//') ||
    bases.some((base) => base.username || base.password || !base.pathname.endsWith('/'))
  ) {
    return 'blocked';
  }
  if (method !== 'GET' || !bases.some((base) => base.origin === url.origin)) return 'blocked';
  // RENIEC currently resolves inside the SPA. A future external integration needs separate authorization.
  if (url.pathname.split('/').some((segment) => /^(?:reniec|identitylookup)$/i.test(segment))) return 'blocked';

  const base = bases.find(
    (candidate) => candidate.origin === url.origin && url.pathname.startsWith(candidate.pathname),
  );
  const resourcePath = base ? url.pathname.slice(base.pathname.length) : '';
  const resource = resourcePath.split('/')[0];
  if (resource !== 'patient' && resource !== 'person') {
    // No FHIR, alternate-context or direct patient/person read is part of this contract.
    return /\/(?:patient|person)(?:\/|$)/i.test(url.pathname) ? 'blocked' : 'continue';
  }
  if (
    resourcePath !== resource ||
    url.searchParams.getAll('q').length !== 1 ||
    url.searchParams.get('q') !== reniecContractDocument
  ) {
    return 'blocked';
  }
  return resource;
}

/** Isolates only the local searches; the SPA's RENIEC implementation and spaEnv remain real. */
export async function isolateReniecIdentitySearches(
  page: Page,
  restBaseUrls = [getOpenmrsRestBaseUrl(), new URL('../ws/rest/v1/', getSpaBaseUrl()).href],
) {
  const searches = new Set<string>();
  let blockedRequests = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    const decision = classifyReniecContractRequest(request.url(), request.method(), restBaseUrls);
    if (decision === 'blocked') {
      blockedRequests += 1;
      await route.abort();
    } else if (decision === 'patient' || decision === 'person') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
      searches.add(decision);
    } else {
      await route.continue();
    }
  });
  // Expose only fixed resource labels and a count; never request URLs, query values or response data.
  return () => ({ searches: [...searches].sort(), blockedRequests });
}
