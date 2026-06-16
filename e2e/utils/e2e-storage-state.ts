import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { getOpenmrsBaseUrl, getSpaBaseUrl } from './e2e-urls';

export async function writeStorageStateForSpa(requestContext: APIRequestContext, storageStatePath: string) {
  const storageState = await requestContext.storageState();
  const spaUrl = new URL(getSpaBaseUrl());
  const apiUrl = new URL(getOpenmrsBaseUrl());

  if (spaUrl.host !== apiUrl.host) {
    const mirroredCookies = storageState.cookies
      .filter((cookie) => cookie.domain !== spaUrl.hostname)
      .map((cookie) => ({
        ...cookie,
        domain: spaUrl.hostname,
        secure: spaUrl.protocol === 'https:',
      }));

    storageState.cookies = [...storageState.cookies, ...mirroredCookies];
  }

  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await writeFile(storageStatePath, JSON.stringify(storageState, null, 2));
}
