import { describe, expect, it } from 'vitest';
import { formatPersonName, formatSentenceCase } from './display-text';

describe('formatPersonName', () => {
  it.each([
    ['MARÍA DEL CARMEN PÉREZ', 'María del Carmen Pérez'],
    ["JOSÉ O'CONNOR-LÓPEZ", "José O'Connor-López"],
    ['MUÑOZ, ANA SOFÍA', 'Muñoz, Ana Sofía'],
    ['  JUAN   DE LA CRUZ  ', 'Juan de la Cruz'],
    ['ÉLODIE D’ANGELO', 'Élodie D’Angelo'],
  ])('formats %s as a proper name', (value, expected) => {
    expect(formatPersonName(value)).toBe(expected);
  });

  it('returns an empty value safely', () => {
    expect(formatPersonName(undefined)).toBe('');
    expect(formatPersonName('   ')).toBe('');
  });
});

describe('formatSentenceCase', () => {
  it('uses sentence case and preserves healthcare acronyms', () => {
    expect(formatSentenceCase('CONSULTAS ACTIVAS')).toBe('Consultas activas');
    expect(formatSentenceCase('ESTADO DE ACREDITACIÓN SIS')).toBe('Estado de acreditación SIS');
    expect(formatSentenceCase('UPSS DE LA COLA')).toBe('UPSS de la cola');
  });
});
