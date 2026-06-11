import { describe, expect, it } from 'vitest';
import { getPreferredIdentifier, preferredIdentifierNames } from './identifiers';

const dni = { identifier: '12345678', identifierType: { name: 'DNI', display: 'DNI' } };
const ce = { identifier: '000123', identifierType: { name: 'CE', display: 'CE' } };
const historia = {
  identifier: 'HC-001',
  identifierType: { name: 'N° Historia Clínica', display: 'N° Historia Clínica' },
};
const openmrsId = {
  identifier: '100A',
  preferred: true,
  identifierType: { name: 'OpenMRS ID', display: 'OpenMRS ID' },
};

describe('getPreferredIdentifier', () => {
  it('returns undefined for an empty list', () => {
    expect(getPreferredIdentifier([])).toBeUndefined();
    expect(getPreferredIdentifier()).toBeUndefined();
  });

  it('prefers DNI over other identifier types by default', () => {
    expect(getPreferredIdentifier([openmrsId, ce, dni])).toBe(dni);
  });

  it('falls back through the default priority list in order', () => {
    expect(getPreferredIdentifier([openmrsId, historia, ce])).toBe(ce);
    expect(getPreferredIdentifier([openmrsId, historia])).toBe(historia);
  });

  it('falls back to the OpenMRS preferred identifier when no priority matches', () => {
    expect(getPreferredIdentifier([{ identifier: 'X', identifierType: { name: 'Otro' } }, openmrsId])).toBe(openmrsId);
  });

  it('falls back to the first identifier when nothing else matches', () => {
    const other = { identifier: 'X', identifierType: { name: 'Otro' } };
    expect(getPreferredIdentifier([other], { useOpenmrsPreferred: false })).toBe(other);
  });

  it('honors a custom priority list, matching by uuid first', () => {
    const byUuid = { identifier: 'U-1', identifierType: { uuid: 'abc-123', name: 'Whatever' } };
    expect(getPreferredIdentifier([dni, byUuid], { priority: [{ uuid: 'abc-123' }] })).toBe(byUuid);
  });

  it('matches names case- and accent-insensitively', () => {
    const accented = { identifier: 'HC-2', identifierType: { name: 'n° historia clinica' } };
    expect(getPreferredIdentifier([accented])).toBe(accented);
  });

  it('exposes the Peru priority list', () => {
    expect(preferredIdentifierNames[0]).toBe('DNI');
  });
});
