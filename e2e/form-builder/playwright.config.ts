import { defineAppE2ESuite } from '../../packages/tooling/configs/playwright-suite';
import { getSpaBaseUrl } from '../utils/e2e-urls';

export default defineAppE2ESuite({
  testDir: './specs',
  globalSetup: require.resolve('./core/global-setup'),
  baseURL: getSpaBaseUrl(),
  storageState: './storageState.json',
  workers: 1,
  trace: 'retain-on-failure',
  video: 'retain-on-failure',
  locale: 'en-US',
});
