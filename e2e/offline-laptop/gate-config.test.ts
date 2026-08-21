import { describe, expect, it } from 'vitest';
import { loadOfflineLaptopGateConfig, type OfflineLaptopGateTarget } from './gate-config';

const targetOrigins: Record<OfflineLaptopGateTarget, string> = {
  DEV: 'https://gidis-hsc-dev.inf.pucp.edu.pe',
  QLTY: 'https://gidis-hsc-qlty.inf.pucp.edu.pe',
};

function validEnvironment(target: OfflineLaptopGateTarget = 'DEV'): NodeJS.ProcessEnv {
  const origin = targetOrigins[target];

  return {
    E2E_API_BASE_URL: `${origin}/openmrs`,
    E2E_BASE_URL: `${origin}/openmrs/spa`,
    E2E_LOGIN_DEFAULT_LOCATION_UUID: '11111111-1111-4111-8111-111111111111',
    E2E_OFFLINE_GATE_ALLOWED_ORIGIN: origin,
    E2E_OFFLINE_GATE_ENABLED: 'true',
    E2E_OFFLINE_GATE_EXPECTED_SHA: '0123456789abcdef0123456789abcdef01234567',
    E2E_OFFLINE_GATE_TARGET: target,
    E2E_OFFLINE_IDENTIFIER_SOURCE_UUID: '22222222-2222-4222-8222-222222222222',
    E2E_OFFLINE_IDENTIFIER_TYPE_UUID: '33333333-3333-4333-8333-333333333333',
    E2E_OFFLINE_VISIT_TYPE_UUID: '44444444-4444-4444-8444-444444444444',
    E2E_SKIP_AUTH: 'false',
    E2E_USER_ADMIN_PASSWORD: 'synthetic-password',
    E2E_USER_ADMIN_USERNAME: 'synthetic-user',
  };
}

describe('loadOfflineLaptopGateConfig', () => {
  it.each(['DEV', 'QLTY'] as const)('accepts an explicitly configured %s target', (target) => {
    const config = loadOfflineLaptopGateConfig(validEnvironment(target));

    expect(config).toMatchObject({
      allowedOrigin: targetOrigins[target],
      apiBaseUrl: `${targetOrigins[target]}/openmrs`,
      spaBaseUrl: `${targetOrigins[target]}/openmrs/spa`,
      target,
    });
  });

  it('requires an explicit opt-in', () => {
    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment(),
        E2E_OFFLINE_GATE_ENABLED: 'false',
      }),
    ).toThrow(/E2E_OFFLINE_GATE_ENABLED=true/);
  });

  it('rejects production as a target before reading any endpoint', () => {
    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment(),
        E2E_OFFLINE_GATE_TARGET: 'PROD',
      }),
    ).toThrow(/must be DEV or QLTY/);
  });

  it('rejects a target and origin mismatch', () => {
    const qltyOrigin = targetOrigins.QLTY;

    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment('DEV'),
        E2E_API_BASE_URL: `${qltyOrigin}/openmrs`,
        E2E_BASE_URL: `${qltyOrigin}/openmrs/spa`,
        E2E_OFFLINE_GATE_ALLOWED_ORIGIN: qltyOrigin,
      }),
    ).toThrow(/must exactly match the DEV origin/);
  });

  it('rejects an unapproved host even when its name contains the target', () => {
    const deceptiveOrigin = 'https://gidis-hsc-dev.example.test';

    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment('DEV'),
        E2E_API_BASE_URL: `${deceptiveOrigin}/openmrs`,
        E2E_BASE_URL: `${deceptiveOrigin}/openmrs/spa`,
        E2E_OFFLINE_GATE_ALLOWED_ORIGIN: deceptiveOrigin,
      }),
    ).toThrow(/must exactly match the DEV origin/);
  });

  it('requires a full deployed SHA and canonical metadata UUIDs', () => {
    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment(),
        E2E_OFFLINE_GATE_EXPECTED_SHA: '0123456',
      }),
    ).toThrow(/full 40-character deployed SHA/);

    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment(),
        E2E_OFFLINE_VISIT_TYPE_UUID: 'not-a-uuid',
      }),
    ).toThrow(/E2E_OFFLINE_VISIT_TYPE_UUID must be a canonical UUID/);
  });

  it('rejects embedded URL credentials', () => {
    expect(() =>
      loadOfflineLaptopGateConfig({
        ...validEnvironment(),
        E2E_BASE_URL: 'https://user:secret@gidis-hsc-dev.inf.pucp.edu.pe/openmrs/spa',
      }),
    ).toThrow(/E2E_BASE_URL cannot contain embedded credentials/);
  });
});
