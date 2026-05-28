import {
  ANTECEDENT_TYPE_SYSTEM,
  buildAntecedentTypeCategory,
  getAntecedentTypeFromCategory,
  getAntecedentTypeLabel,
  getConditionCategoryDisplay,
  normalizeAntecedentTypeCode,
} from './antecedent-types';

describe('antecedent type helpers', () => {
  it('normalizes current and legacy antecedent type values', () => {
    expect(normalizeAntecedentTypeCode('pathological')).toBe('pathological');
    expect(normalizeAntecedentTypeCode('Patológico')).toBe('pathological');
    expect(normalizeAntecedentTypeCode('diagnosticos')).toBe('definitive-diagnosis');
    expect(normalizeAntecedentTypeCode('hospitalizaciones')).toBe('previous-hospitalization');
    expect(normalizeAntecedentTypeCode('otros')).toBe('other');
  });

  it('builds a FHIR Condition category using the SIH Salus antecedent type system', () => {
    expect(buildAntecedentTypeCategory('surgical')).toEqual([
      {
        coding: [
          {
            system: ANTECEDENT_TYPE_SYSTEM,
            code: 'surgical',
            display: 'Quirúrgico',
          },
        ],
        text: 'Quirúrgico',
      },
    ]);
  });

  it('reads antecedent type from SIH Salus or legacy FHIR category values', () => {
    expect(
      getAntecedentTypeFromCategory([
        {
          coding: [{ system: ANTECEDENT_TYPE_SYSTEM, code: 'family', display: 'Familiar' }],
        },
      ]),
    ).toBe('family');

    expect(getAntecedentTypeFromCategory([{ text: 'quirurgicos' }])).toBe('surgical');
  });

  it('falls back to category display when the category is not an antecedent type', () => {
    expect(getAntecedentTypeLabel('unknown')).toBe('--');
    expect(
      getConditionCategoryDisplay([{ coding: [{ code: 'encounter-diagnosis', display: 'Encounter Diagnosis' }] }]),
    ).toBe('Encounter Diagnosis');
  });
});
