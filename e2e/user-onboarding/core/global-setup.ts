import path from 'node:path';
import { request } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getOpenmrsRestUrl } from '../../utils/e2e-urls';

dotenv.config();

/**
 * This configuration is to reuse the signed-in state in the tests
 * by log in only once using the API and then skip the log in step for all the tests.
 *
 * https://playwright.dev/docs/auth#reuse-signed-in-state
 */

async function globalSetup() {
  const requestContext = await request.newContext();
  const token = Buffer.from(`${process.env.E2E_USER_ADMIN_USERNAME}:${process.env.E2E_USER_ADMIN_PASSWORD}`).toString(
    'base64',
  );
  await requestContext.post(getOpenmrsRestUrl('session'), {
    data: {
      sessionLocation: process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID,
      locale: 'en',
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${token}`,
    },
  });
  await requestContext.storageState({ path: path.resolve(__dirname, '../storageState.json') });
  await requestContext.dispose();
}

export default globalSetup;
