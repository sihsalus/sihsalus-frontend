import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevelopmentSpa } from './e2e-spa-environment';

describe('effective SPA environment for RENIEC acceptance', () => {
  afterEach(() => vi.unstubAllGlobals());

  const page = { evaluate: vi.fn().mockImplementation((readEnvironment) => readEnvironment()) };

  it.each([
    'localhost',
    '127.0.0.1',
    'dev.example.test',
  ])('runs production safety acceptance for a production SPA on %s', async (hostname) => {
    vi.stubGlobal('location', { hostname });
    vi.stubGlobal('spaEnv', 'production');
    expect(await isDevelopmentSpa(page)).toBe(false);
  });

  it('allows the synthetic lookup only for the effective development SPA', async () => {
    vi.stubGlobal('spaEnv', 'development');
    expect(await isDevelopmentSpa(page)).toBe(true);
  });

  it.each([
    undefined,
    null,
    '',
    'test',
    'DEV',
  ])('rejects a missing or unsupported SPA environment (%s)', async (environment) => {
    vi.stubGlobal('spaEnv', environment);
    await expect(isDevelopmentSpa(page)).rejects.toThrow('effective E2E SPA environment');
  });
});
