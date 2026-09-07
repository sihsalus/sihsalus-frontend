import * as dotenv from 'dotenv';
import { loginToOpenmrsAndWriteStorageState } from './utils/e2e-api';
import { loadE2EGateConfig } from './utils/e2e-gate-config';
import { validateE2ERemotePreflight } from './utils/e2e-remote-preflight';

dotenv.config();

async function globalSetup() {
  if (process.env.E2E_SKIP_AUTH === 'true') {
    if (process.env.CI) {
      throw new Error('E2E_SKIP_AUTH=true is not allowed in CI.');
    }
    return;
  }

  const config = loadE2EGateConfig();
  await validateE2ERemotePreflight(config);
  await loginToOpenmrsAndWriteStorageState({ locale: 'es', storageStatePath: 'e2e/storage-state.json' });
}

export default globalSetup;
