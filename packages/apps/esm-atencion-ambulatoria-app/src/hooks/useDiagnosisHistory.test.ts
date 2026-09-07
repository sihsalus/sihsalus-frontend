import { getCie10Code } from './useDiagnosisHistory';

describe('getCie10Code', () => {
  it('uses the MINSA catalog SHORT name when a concept has no mappings', () => {
    expect(
      getCie10Code({
        display: 'Enfermedad tóxica del hígado con colestasis',
        mappings: [],
        names: [{ display: 'K710', conceptNameType: 'SHORT' }],
      }),
    ).toBe('K710');
  });

  it('prefers a structured CIE-10 mapping', () => {
    expect(
      getCie10Code({
        display: 'Diabetes mellitus tipo 2',
        names: [{ display: 'OTRO', conceptNameType: 'SHORT' }],
        mappings: [
          {
            conceptReferenceTerm: {
              code: 'E11.9',
              conceptSource: { display: 'CIE-10' },
            },
          },
        ],
      }),
    ).toBe('E11.9');
  });

  it('supports legacy mapping displays without accepting unrelated mappings', () => {
    expect(
      getCie10Code({
        display: 'Trastorno',
        mappings: [{ display: 'ICD-10: F15.5' }],
      }),
    ).toBe('F15.5');
    expect(
      getCie10Code({
        display: 'Trastorno',
        mappings: [{ display: 'SNOMED CT: F15.5' }],
      }),
    ).toBeNull();
  });
});
