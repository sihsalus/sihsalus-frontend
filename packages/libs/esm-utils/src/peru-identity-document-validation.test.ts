import { describe, expect, it } from 'vitest';

import { getPeruIdentityDocumentRule, type PeruIdentityDocumentKind } from './peru-identity-document-validation';

describe('Peru identity document validation', () => {
  it.each<[PeruIdentityDocumentKind, string, string]>([
    ['dni', '12-345-678', '12345678'],
    ['ce', 'ab-123456', 'AB123456'],
    ['passport', 'pa-1234567', 'PA1234567'],
    ['die', 'die-123456789012', 'DIE123456789012'],
    ['cnv', '1234-5678-9012', '123456789012'],
  ])('normalizes %s consistently', (kind, rawValue, normalizedValue) => {
    const rule = getPeruIdentityDocumentRule(kind);

    expect(rule?.sanitize(rawValue)).toBe(normalizedValue);
    expect(rule?.pattern.test(normalizedValue)).toBe(true);
  });

  it.each<[PeruIdentityDocumentKind, string]>([
    ['dni', '12A345678'],
    ['passport', 'PA123456789'],
    ['cnv', '1234567890123'],
  ])('does not silently truncate or discard invalid %s input', (kind, rawValue) => {
    const rule = getPeruIdentityDocumentRule(kind);
    const normalized = rule?.sanitize(rawValue) ?? '';

    expect(normalized).toBe(rawValue.toUpperCase());
    expect(rule?.pattern.test(normalized)).toBe(false);
  });

  it.each<[PeruIdentityDocumentKind, string]>([
    ['dni', '1234567'],
    ['ce', 'ABC12'],
    ['passport', 'ABC12'],
    ['die', 'ABC1234567890123'],
    ['cnv', '12345678901'],
  ])('rejects an invalid %s length', (kind, value) => {
    expect(getPeruIdentityDocumentRule(kind)?.pattern.test(value)).toBe(false);
  });
});
