import path from 'node:path';
import * as dotenv from 'dotenv';
import { loginToOpenmrsAndWriteStorageState } from '../../utils/e2e-api';
import { validateE2ELaboratoryRemotePreflight } from '../../utils/e2e-remote-preflight';
import { loadLaboratoryFixtureEnvironment } from './synthetic-fixtures';

dotenv.config();

/**
 * This configuration is to reuse the signed-in state in the tests
 * by log in only once using the API and then skip the log in step for all the tests.
 *
 * https://playwright.dev/docs/auth#reuse-signed-in-state
 */

async function globalSetup() {
  const { config } = loadLaboratoryFixtureEnvironment(process.env);
  await validateE2ELaboratoryRemotePreflight(config);
  await loginToOpenmrsAndWriteStorageState({
    locale: 'en',
    storageStatePath: path.resolve(__dirname, '../storageState.json'),
  });
}

export default globalSetup;
