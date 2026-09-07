import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRecoveryConfig } from '../clinical-recovery/config-schema';
import globalSetup from '../clinical-recovery/global-setup';
import { blockClinicalRecovery, clinicalRecoveryQuarantineMessage } from '../clinical-recovery/quarantine.mjs';
import { runRecoveredNotificationSmoke } from '../clinical-recovery/runtime-notifications-dev-smoke.mjs';

const browser = vi.hoisted(() => ({ launch: vi.fn(), newContext: vi.fn() }));
vi.mock('@playwright/test', () => ({
  chromium: { launch: browser.launch },
  request: { newContext: browser.newContext },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('clinical recovery hard quarantine', () => {
  it('rejects before configuration is inspected', () => {
    const environment = new Proxy<NodeJS.ProcessEnv>(
      {},
      {
        get() {
          throw new Error('Configuration must not be read before quarantine.');
        },
      },
    );
    expect(() => loadRecoveryConfig(environment)).toThrow(clinicalRecoveryQuarantineMessage);
  });

  it('blocks global setup as well as the shared entry point', () => {
    expect(() => blockClinicalRecovery()).toThrow(clinicalRecoveryQuarantineMessage);
    expect(() => globalSetup()).toThrow(clinicalRecoveryQuarantineMessage);
  });

  it.each(['DEV', 'QLTY', 'PROD'])('cannot be enabled with a %s target or bypass-looking flags', async (target) => {
    vi.stubEnv('E2E_GATE_TARGET', target);
    vi.stubEnv('SIHSALUS_E2E_TARGET', target);
    vi.stubEnv('E2E_SKIP_AUTH', 'true');
    vi.stubEnv('E2E_ALLOW_QUARANTINED', 'true');
    await expect(runRecoveredNotificationSmoke()).rejects.toThrow(clinicalRecoveryQuarantineMessage);
    expect(browser.launch).not.toHaveBeenCalled();
    expect(browser.newContext).not.toHaveBeenCalled();
  });

  it('rejects direct CLI invocation without exposing configured values', () => {
    const result = spawnSync(process.execPath, [resolve('e2e/clinical-recovery/runtime-notifications-dev-smoke.mjs')], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', SIHSALUS_E2E_PASSWORD: 'quarantine-unit-sentinel' },
      timeout: 15_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('Clinical recovery is quarantined; no notification smoke was executed.\n');
    expect(result.stderr).not.toContain('quarantine-unit-sentinel');
  });
});
