import esTranslations from '../../translations/es.json';
import {
  translateCredAgeGroupLabel,
  translateCredAgeGroupSublabel,
  translateCredControlLabel,
} from './cred-label-translations';

const translations = esTranslations as Record<string, string>;

function t(key: string, fallback: string, options?: Record<string, unknown>) {
  const count = typeof options?.count === 'number' ? options.count : undefined;

  if (count !== undefined) {
    const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
    return (translations[pluralKey] ?? translations[key] ?? fallback).replace('{{count}}', count.toString());
  }

  return translations[key] ?? fallback;
}

describe('cred-label-translations', () => {
  it('translates CRED age group labels to Spanish', () => {
    expect(translateCredAgeGroupLabel(t, 'RN - 3 a 6d')).toBe('Recién nacido - 3 a 6 días');
    expect(translateCredAgeGroupLabel(t, '0 AÑOS')).toBe('0 años');
    expect(translateCredAgeGroupLabel(t, '11 AÑOS')).toBe('11 años');
  });

  it('translates CRED age group sublabels to Spanish', () => {
    expect(translateCredAgeGroupSublabel(t, 'CONTROL 1 (3 A 6 DÍAS)')).toBe('Control 1 (3 a 6 días)');
    expect(translateCredAgeGroupSublabel(t, '1 A 11 MESES')).toBe('1 a 11 meses');
    expect(translateCredAgeGroupSublabel(t, undefined)).toBeUndefined();
  });

  it('translates generated CRED control labels to Spanish', () => {
    expect(translateCredControlLabel(t, 'RN - 7 a 14 días')).toBe('Recién nacido - 7 a 14 días');
    expect(translateCredControlLabel(t, '1 mes')).toBe('1 mes');
    expect(translateCredControlLabel(t, '5 años')).toBe('5 años');
  });

  it('keeps unknown labels unchanged', () => {
    expect(translateCredAgeGroupLabel(t, 'custom group')).toBe('custom group');
    expect(translateCredControlLabel(t, 'custom control')).toBe('custom control');
  });
});
