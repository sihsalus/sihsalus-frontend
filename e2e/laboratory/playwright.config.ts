import { defineAppE2ESuite } from '../../packages/tooling/configs/playwright-suite';
import { getSpaBaseUrl, getSpaUrl } from '../utils/e2e-urls';

const webServer =
  process.env.E2E_DISABLE_WEB_SERVER === 'true'
    ? undefined
    : {
        command: process.env.E2E_WEB_SERVER_COMMAND ?? 'yarn start',
        url: getSpaUrl('login'),
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      };

export default defineAppE2ESuite({
  testDir: './specs',
  globalSetup: require.resolve('./core/global-setup'),
  baseURL: getSpaBaseUrl(),
  storageState: './storageState.json',
  expectTimeout: 40 * 1000,
  fullyParallel: true,
  trace: 'retain-on-failure',
  video: 'retain-on-failure',
  channel: 'chromium',
  webServer,
});
