import { request } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const SPA_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080/openmrs/spa';
const API_BASE_URL = process.env.E2E_API_BASE_URL ?? SPA_BASE_URL.replace(/\/spa\/?$/, '').replace(/\/$/, '');

interface LocationResponse {
  uuid?: string;
  retired?: boolean;
}

interface LocationSearchResponse {
  results?: LocationResponse[];
}

async function getSessionLocation(apiBaseUrl: string, authorization: string, requestedUuid?: string) {
  const ctx = await request.newContext({
    extraHTTPHeaders: {
      Authorization: authorization,
    },
  });

  try {
    if (requestedUuid) {
      const locationRes = await ctx.get(`${apiBaseUrl}/ws/rest/v1/location/${requestedUuid}`);
      if (locationRes.ok()) {
        return requestedUuid;
      }

      console.warn('Configured E2E login location is not available; falling back to QLTY locations.');
    }

    const locationsRes = await ctx.get(`${apiBaseUrl}/ws/rest/v1/location?v=default&limit=50`);
    if (!locationsRes.ok()) {
      console.warn(`Could not load E2E login locations (${locationsRes.status()}).`);
      return undefined;
    }

    const locations = (await locationsRes.json()) as LocationSearchResponse;
    return (
      locations.results?.find((location) => location.uuid && !location.retired)?.uuid ?? locations.results?.[0]?.uuid
    );
  } finally {
    await ctx.dispose();
  }
}

async function globalSetup() {
  if (process.env.E2E_SKIP_AUTH === 'true') {
    return;
  }

  const username = process.env.E2E_USER_ADMIN_USERNAME ?? 'admin';
  const password = process.env.E2E_USER_ADMIN_PASSWORD ?? 'Admin123';
  const locationUuid = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;

  const ctx = await request.newContext();
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const sessionLocation = await getSessionLocation(API_BASE_URL, authorization, locationUuid);

  const res = await ctx.post(`${API_BASE_URL}/ws/rest/v1/session`, {
    data: {
      ...(sessionLocation ? { sessionLocation } : {}),
      locale: 'es',
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
  });

  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}).`);
  }

  await ctx.storageState({ path: 'e2e/storage-state.json' });
  await ctx.dispose();
}

export default globalSetup;
