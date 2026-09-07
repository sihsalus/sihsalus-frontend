import path from 'node:path';
import * as dotenv from 'dotenv';
import { loginToOpenmrsAndWriteStorageState } from '../../utils/e2e-api';
import { loadE2EBaseConfig } from '../../utils/e2e-gate-config';
import { validateE2EBaseRemotePreflight } from '../../utils/e2e-remote-preflight';

dotenv.config();

/**
 * This configuration is to reuse the signed-in state in the tests
 * by log in only once using the API and then skip the log in step for all the tests.
 *
 * https://playwright.dev/docs/auth#reuse-signed-in-state
 */

async function globalSetup() {
  const config = loadE2EBaseConfig();
  await validateE2EBaseRemotePreflight(config);
  await loginToOpenmrsAndWriteStorageState({
    locale: 'en',
    storageStatePath: path.resolve(__dirname, '../storageState.json'),
  });
}

export default globalSetup;
