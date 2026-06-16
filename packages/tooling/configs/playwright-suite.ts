import path from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: path.resolve(process.cwd(), '.env') });
dotenvConfig();

type SuiteOptions = {
  testDir: string;
  globalSetup: string;
  baseURL: string;
  storageState?: string;
  timeout?: number;
  expectTimeout?: number;
  fullyParallel?: boolean;
  workers?: number;
  retries?: number;
  locale?: string;
  trace?: NonNullable<PlaywrightTestConfig['use']>['trace'];
  video?: NonNullable<PlaywrightTestConfig['use']>['video'];
  channel?: string;
  outputDir?: string;
  reporter?: PlaywrightTestConfig['reporter'];
};

export function defineAppE2ESuite(options: SuiteOptions) {
  return defineConfig({
    testDir: options.testDir,
    timeout: options.timeout ?? 3 * 60 * 1000,
    expect: {
      timeout: options.expectTimeout ?? 20 * 1000,
    },
    fullyParallel: options.fullyParallel ?? false,
    workers: options.workers,
    forbidOnly: !!process.env.CI,
    retries: options.retries ?? 0,
    outputDir: options.outputDir,
    reporter: options.reporter ?? (process.env.CI ? [['junit', { outputFile: 'results.xml' }], ['html']] : [['html']]),
    globalSetup: options.globalSetup,
    use: {
      baseURL: options.baseURL,
      locale: options.locale,
      storageState: options.storageState,
      trace: options.trace,
      video: options.video,
    },
    projects: [
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          ...(options.channel ? { channel: options.channel } : {}),
        },
      },
    ],
  });
}
