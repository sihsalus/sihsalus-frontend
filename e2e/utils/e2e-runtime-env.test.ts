import { describe, expect, it } from 'vitest';
import { requireE2ERuntimeUuid, requireE2ERuntimeValue } from './e2e-runtime-env';

describe('E2E runtime environment', () => {
  it('reads values populated after test module collection', () => {
    const env = { E2E_DYNAMIC_VALUE: ' fixture ' };

    expect(requireE2ERuntimeValue('E2E_DYNAMIC_VALUE', env)).toBe('fixture');
  });

  it('rejects missing and malformed synthetic UUIDs', () => {
    expect(() => requireE2ERuntimeValue('E2E_DYNAMIC_VALUE', {})).toThrow(/before E2E tests run/);
    expect(() => requireE2ERuntimeUuid('E2E_PATIENT_UUID', { E2E_PATIENT_UUID: 'not-a-uuid' })).toThrow(/UUID/);
  });

  it('accepts a configured synthetic UUID', () => {
    const uuid = '35d2234e-129a-4c40-abb2-1ae0b72c1602';

    expect(requireE2ERuntimeUuid('E2E_PATIENT_UUID', { E2E_PATIENT_UUID: uuid })).toBe(uuid);
  });

  it('reads the current environment on each call and does not echo rejected values', () => {
    const env = { E2E_PATIENT_UUID: '11111111-1111-4111-8111-111111111111' };
    expect(requireE2ERuntimeUuid('E2E_PATIENT_UUID', env)).toBe(env.E2E_PATIENT_UUID);
    env.E2E_PATIENT_UUID = 'do-not-log-this-value';
    expect(() => requireE2ERuntimeUuid('E2E_PATIENT_UUID', env)).toThrow(/valid UUID/);
    expect(() => requireE2ERuntimeUuid('E2E_PATIENT_UUID', env)).not.toThrow(/do-not-log-this-value/);
  });

  it.each([
    '',
    '   ',
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-1111-111111111111',
  ])('rejects blank or noncanonical fixture UUIDs', (value) => {
    expect(() => requireE2ERuntimeUuid('E2E_PATIENT_UUID', { E2E_PATIENT_UUID: value })).toThrow();
  });
});
