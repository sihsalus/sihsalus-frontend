import * as dotenv from 'dotenv';
import { loginToOpenmrsAndWriteStorageState } from './utils/e2e-api';

dotenv.config();

async function globalSetup() {
  if (process.env.E2E_SKIP_AUTH === 'true') {
    return;
  }

  await loginToOpenmrsAndWriteStorageState({ locale: 'es', storageStatePath: 'e2e/storage-state.json' });
}

export default globalSetup;
