import {
  peruCarnetExtranjeriaPatientIdentifierTypeUuid,
  peruPassportPatientIdentifierTypeUuid,
} from './peru-registration-config';

import { getPeruIdentifierRule } from './peru-identifier-validation';

describe('Peru identifier validation', () => {
  it('aligns CE with the backend PatientIdentifierType format', () => {
    const rule = getPeruIdentifierRule({ uuid: peruCarnetExtranjeriaPatientIdentifierTypeUuid, name: 'CE' });

    expect(rule?.pattern.test('CE123ABC')).toBe(true);
    expect(rule?.pattern.test('12345')).toBe(false);
    expect(rule?.sanitize('ce-123 abc')).toBe('CE123ABC');
    expect(rule?.maxLength).toBe(12);
  });

  it('aligns CNV with the backend PatientIdentifierType format', () => {
    const rule = getPeruIdentifierRule({ uuid: '8d79403a-c2cc-11de-8d13-0010c6dffd0f', name: 'CNV' });

    expect(rule?.pattern.test('123456789012')).toBe(true);
    expect(rule?.pattern.test('1234567890')).toBe(false);
    expect(rule?.sanitize('1234-5678-9012-99')).toBe('123456789012');
    expect(rule?.maxLength).toBe(12);
  });

  it('aligns passport with the backend PatientIdentifierType format', () => {
    const rule = getPeruIdentifierRule({ uuid: peruPassportPatientIdentifierTypeUuid, name: 'PASS' });

    expect(rule?.pattern.test('AB1234')).toBe(true);
    expect(rule?.pattern.test('AB1234567')).toBe(true);
    expect(rule?.pattern.test('AB12345678')).toBe(false);
    expect(rule?.sanitize('ab-123456789')).toBe('AB1234567');
    expect(rule?.maxLength).toBe(9);
  });
});
