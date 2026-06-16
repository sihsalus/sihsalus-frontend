import { type APIRequestContext, type PlaywrightWorkerArgs, request, type WorkerFixture } from '@playwright/test';
import { writeStorageStateForSpa } from './e2e-storage-state';
import { getOpenmrsFhirBaseUrl, getOpenmrsRestBaseUrl, getOpenmrsRestUrl, shouldIgnoreHTTPSErrors } from './e2e-urls';

interface LocationResponse {
  uuid?: string;
  retired?: boolean;
}

interface LocationSearchResponse {
  results?: LocationResponse[];
}

type LoginOptions = {
  locale?: string;
  storageStatePath: string;
};

export function getE2ECredentials() {
  const username = process.env.E2E_USER_ADMIN_USERNAME ?? 'admin';
  const password = process.env.E2E_USER_ADMIN_PASSWORD ?? 'Admin123';

  return {
    username,
    password,
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
  };
}

async function getSessionLocation(requestContext: APIRequestContext, requestedUuid?: string) {
  if (requestedUuid) {
    const locationRes = await requestContext.get(getOpenmrsRestUrl(`location/${requestedUuid}`));
    if (locationRes.ok()) {
      return requestedUuid;
    }

    console.warn('Configured E2E login location is not available; falling back to QLTY locations.');
  }

  const locationsRes = await requestContext.get(getOpenmrsRestUrl('location?v=default&limit=50'));
  if (!locationsRes.ok()) {
    console.warn(`Could not load E2E login locations (${locationsRes.status()}).`);
    return undefined;
  }

  const locations = (await locationsRes.json()) as LocationSearchResponse;
  return (
    locations.results?.find((location) => location.uuid && !location.retired)?.uuid ?? locations.results?.[0]?.uuid
  );
}

export async function loginToOpenmrsAndWriteStorageState({ locale = 'en', storageStatePath }: LoginOptions) {
  const { authorization } = getE2ECredentials();
  const requestContext = await request.newContext({
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    extraHTTPHeaders: {
      Authorization: authorization,
    },
  });

  try {
    const sessionLocation = await getSessionLocation(requestContext, process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID);
    const response = await requestContext.post(getOpenmrsRestUrl('session'), {
      data: {
        ...(sessionLocation ? { sessionLocation } : {}),
        locale,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok()) {
      throw new Error(`Login failed (${response.status()}): ${await response.text()}`);
    }

    await writeStorageStateForSpa(requestContext, storageStatePath);
  } finally {
    await requestContext.dispose();
  }
}

export const openmrsRestApi: WorkerFixture<APIRequestContext, PlaywrightWorkerArgs> = async ({ playwright }, use) => {
  const { username, password } = getE2ECredentials();
  const context = await playwright.request.newContext({
    baseURL: getOpenmrsRestBaseUrl(),
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: {
      username,
      password,
    },
  });

  try {
    await use(context);
  } finally {
    await context.dispose();
  }
};

export const openmrsFhirApi: WorkerFixture<APIRequestContext, PlaywrightWorkerArgs> = async ({ playwright }, use) => {
  const { username, password } = getE2ECredentials();
  const context = await playwright.request.newContext({
    baseURL: getOpenmrsFhirBaseUrl(),
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: {
      username,
      password,
    },
  });

  try {
    await use(context);
  } finally {
    await context.dispose();
  }
};
