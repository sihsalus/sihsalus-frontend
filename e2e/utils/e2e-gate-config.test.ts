import { describe, expect, it } from 'vitest';
import { type E2EGateTarget, isSyntheticE2EPatient, loadE2EGateConfig } from './e2e-gate-config';

const targetOrigins: Record<E2EGateTarget, string> = {
  DEV: 'https://gidis-hsc-dev.inf.pucp.edu.pe',
  QLTY: 'https://gidis-hsc-qlty.inf.pucp.edu.pe',
};

function validEnvironment(target: E2EGateTarget = 'DEV'): NodeJS.ProcessEnv {
  const origin = targetOrigins[target];

  return {
    E2E_API_BASE_URL: `${origin}/openmrs`,
    E2E_APPOINTMENTS_PATIENT_UUID: '22222222-2222-4222-8222-222222222222',
    E2E_BASE_URL: 'http://127.0.0.1:8080/openmrs/spa',
    E2E_GATE_TARGET: target,
    E2E_LOGIN_DEFAULT_LOCATION_UUID: '33333333-3333-4333-8333-333333333333',
    E2E_PATIENT_UUID: '11111111-1111-4111-8111-111111111111',
    E2E_USER_ADMIN_PASSWORD: 'synthetic-password',
    E2E_USER_ADMIN_USERNAME: 'synthetic-user',
  };
}

describe('loadE2EGateConfig', () => {
  it.each(['DEV', 'QLTY'] as const)('accepts a loopback SPA backed by %s', (target) => {
    expect(loadE2EGateConfig(validEnvironment(target))).toMatchObject({
      apiBaseUrl: `${targetOrigins[target]}/openmrs`,
      spaBaseUrl: 'http://127.0.0.1:8080/openmrs/spa',
      target,
    });
  });

  it('accepts the SPA deployed on the selected non-production target', () => {
    const environment = validEnvironment('QLTY');
    environment.E2E_BASE_URL = `${targetOrigins.QLTY}/openmrs/spa`;

    expect(loadE2EGateConfig(environment).spaBaseUrl).toBe(`${targetOrigins.QLTY}/openmrs/spa`);
  });

  it('rejects production and deceptive target values before reading endpoints', () => {
    expect(() => loadE2EGateConfig({ ...validEnvironment(), E2E_GATE_TARGET: 'PROD' })).toThrow(/must be DEV or QLTY/);
  });

  it('rejects a target and backend origin mismatch', () => {
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment('DEV'),
        E2E_API_BASE_URL: `${targetOrigins.QLTY}/openmrs`,
      }),
    ).toThrow(/must use the DEV origin/);
  });

  it('rejects unapproved and lookalike backend hosts', () => {
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment(),
        E2E_API_BASE_URL: 'https://gidis-hsc-dev.example.test/openmrs',
      }),
    ).toThrow(/must use the DEV origin/);
  });

  it('rejects unsafe remote SPA origins', () => {
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment(),
        E2E_BASE_URL: 'https://example.test/openmrs/spa',
      }),
    ).toThrow(/must use loopback or the DEV origin/);
  });

  it('rejects embedded credentials, queries, and incorrect application paths', () => {
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment(),
        E2E_BASE_URL: 'http://user:secret@localhost:8080/openmrs/spa',
      }),
    ).toThrow(/cannot contain embedded credentials/);
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment(),
        E2E_API_BASE_URL: `${targetOrigins.DEV}/openmrs?patient=real`,
      }),
    ).toThrow(/cannot contain query or hash data/);
    expect(() =>
      loadE2EGateConfig({
        ...validEnvironment(),
        E2E_BASE_URL: 'http://localhost:8080/',
      }),
    ).toThrow(/must end at \/openmrs\/spa/);
  });

  it('requires canonical synthetic-patient and location UUIDs', () => {
    expect(() => loadE2EGateConfig({ ...validEnvironment(), E2E_PATIENT_UUID: 'not-a-uuid' })).toThrow(
      /E2E_PATIENT_UUID must be a canonical UUID/,
    );
  });

  it('does not allow the clinical gate to bypass authentication', () => {
    expect(() => loadE2EGateConfig({ ...validEnvironment(), E2E_SKIP_AUTH: 'true' })).toThrow(
      /E2E_SKIP_AUTH=true is not supported/,
    );
  });
});

describe('isSyntheticE2EPatient', () => {
  it('accepts an explicit marker in a name or identifier', () => {
    expect(isSyntheticE2EPatient({ person: { names: [{ givenName: 'SYNTHETIC', familyName: 'Consulta' }] } })).toBe(
      true,
    );
    expect(isSyntheticE2EPatient({ identifiers: [{ identifier: 'E2E-CE-001' }] })).toBe(true);
  });

  it('ignores voided markers', () => {
    expect(
      isSyntheticE2EPatient({
        identifiers: [{ identifier: 'E2E-OLD', voided: true }],
        person: { names: [{ givenName: 'Paciente', familyName: 'Prueba' }] },
      }),
    ).toBe(false);
  });

  it('rejects ordinary patient identities and marker lookalikes', () => {
    expect(isSyntheticE2EPatient({ display: 'Esteban Ezequiel' })).toBe(false);
    expect(isSyntheticE2EPatient({ identifiers: [{ identifier: 'NOTSYNTHETIC123' }] })).toBe(false);
  });
});
