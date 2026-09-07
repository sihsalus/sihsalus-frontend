import path from 'node:path';
import * as dotenv from 'dotenv';
import { loginToOpenmrsAndWriteStorageState } from '../../utils/e2e-api';
import { loadE2EGateConfig } from '../../utils/e2e-gate-config';
import { validateE2ERemotePreflight } from '../../utils/e2e-remote-preflight';

dotenv.config();

/**
 * This configuration is to reuse the signed-in state in the tests
 * by log in only once using the API and then skip the log in step for all the tests.
 *
 * https://playwright.dev/docs/auth#reuse-signed-in-state
 */

async function globalSetup() {
  const config = loadE2EGateConfig();
  await validateE2ERemotePreflight(config, { requirePreparedOutpatientVisit: false });
  await loginToOpenmrsAndWriteStorageState({
    locale: 'en',
    storageStatePath: path.resolve(__dirname, '../storageState.json'),
  });
}

export default globalSetup;
