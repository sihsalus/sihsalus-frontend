import { defineAppE2ESuite } from '../../packages/tooling/configs/playwright-suite';
import { getSpaBaseUrl } from '../utils/e2e-urls';

export default defineAppE2ESuite({
  testDir: './specs',
  globalSetup: require.resolve('./core/global-setup'),
  baseURL: getSpaBaseUrl(),
  storageState: './storageState.json',
  expectTimeout: 40 * 1000,
  fullyParallel: true,
  trace: 'retain-on-failure',
  video: 'on',
  outputDir: './test-results/results',
  reporter: process.env.CI
    ? [['junit', { outputFile: 'results.xml' }], ['html']]
    : [['html', { outputFolder: './test-results/report' }]],
});
