import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clinicalRecoveryQuarantineMessage } from '../clinical-recovery/quarantine.mjs';

const registration = vi.hoisted(() => {
  const hooks: Array<() => unknown> = [];
  const bodies: Array<() => unknown> = [];
  return {
    hooks,
    bodies,
    test: Object.assign(
      vi.fn((_name: string, body: () => unknown) => bodies.push(body)),
      { beforeAll: vi.fn((hook: () => unknown) => hooks.push(hook)) },
    ),
  };
});

const sideEffects = vi.hoisted(() => {
  const forbidden = () => {
    throw new Error('Discovery and quarantined entry points must not execute clinical code.');
  };
  return {
    loadConfig: vi.fn(forbidden),
    notificationSmoke: vi.fn(forbidden),
    clinicalAssertion: vi.fn(forbidden),
    fetch: vi.fn(forbidden),
  };
});

// Capture registrations only: no Playwright runner, fixtures, browser or backend.
// Keep the real quarantine module so each entry point must enforce its own guard.
vi.mock('@playwright/test', () => ({
  test: registration.test,
  expect: sideEffects.clinicalAssertion,
  defineConfig: (config: unknown) => config,
}));
vi.mock('../clinical-recovery/config-schema', () => ({ loadRecoveryConfig: sideEffects.loadConfig }));
vi.mock('../clinical-recovery/runtime-notifications-dev-smoke.mjs', () => ({
  runRecoveredNotificationSmoke: sideEffects.notificationSmoke,
}));

beforeEach(() => {
  vi.resetModules();
  registration.hooks.length = 0;
  registration.bodies.length = 0;
  vi.stubGlobal('fetch', sideEffects.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function expectNoClinicalExecution() {
  for (const effect of Object.values(sideEffects)) {
    expect(effect).not.toHaveBeenCalled();
  }
}

describe('recovered proposal entry points', () => {
  it.each([
    ['signed orders', () => import('../clinical-recovery/specs/signed-orders.spec.js')],
    ['notifications', () => import('../clinical-recovery/specs/runtime-notifications.spec.js')],
  ] as const)('registers %s without side effects and rejects its hook before configuration', async (_name, loadSpec) => {
    await loadSpec();

    expect(registration.test).toHaveBeenCalledOnce();
    expect(registration.hooks).toHaveLength(1);
    expect(registration.bodies).toHaveLength(1);
    expectNoClinicalExecution();

    const [hook] = registration.hooks;
    if (!hook) throw new Error('The proposal must register its quarantine hook.');
    expect(() => hook()).toThrow(clinicalRecoveryQuarantineMessage);
    expectNoClinicalExecution();
  });

  it('blocks the notification test body independently of runner setup and hooks', async () => {
    await import('../clinical-recovery/specs/runtime-notifications.spec.js');

    expect(registration.bodies).toHaveLength(1);
    const [body] = registration.bodies;
    if (!body) throw new Error('The notification proposal must register its test body.');
    await expect(body()).rejects.toThrow(clinicalRecoveryQuarantineMessage);
    expectNoClinicalExecution();
  });

  it('keeps direct Playwright configuration bound to quarantine with artifacts and authentication disabled', async () => {
    const { default: config } = await import('../clinical-recovery/playwright.config.js');

    expect(config).toMatchObject({
      testDir: './specs',
      globalSetup: resolve('e2e/clinical-recovery/global-setup.ts'),
      workers: 1,
      retries: 0,
      reporter: 'list',
      use: { serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' },
    });
    expect(config).toHaveProperty('projects', [{ name: 'desktop' }]);
    expect(config).not.toHaveProperty('webServer');
    expect(config).not.toHaveProperty('globalTeardown');
    expect(config).not.toHaveProperty('use.storageState');
    expectNoClinicalExecution();
  });
});
