import {
  ANTECEDENT_TYPE_SYSTEM,
  buildAntecedentTypeCategory,
  buildAntecedentTypeNote,
  getAntecedentTypeFromCategory,
  getAntecedentTypeFromCondition,
  getAntecedentTypeFromNote,
  getAntecedentTypeLabel,
  getConditionCategoryDisplay,
  getConditionNoteText,
  normalizeAntecedentTypeCode,
  OPENMRS_ANTECEDENT_CATEGORY_CODE,
  OPENMRS_ANTECEDENT_CATEGORY_DISPLAY,
  OPENMRS_CONDITION_CATEGORY_SYSTEM,
} from './antecedent-types';

describe('antecedent type helpers', () => {
  it('normalizes current and legacy antecedent type values', () => {
    expect(normalizeAntecedentTypeCode('pathological')).toBe('pathological');
    expect(normalizeAntecedentTypeCode('Patológico')).toBe('pathological');
    expect(normalizeAntecedentTypeCode('diagnosticos')).toBe('definitive-diagnosis');
    expect(normalizeAntecedentTypeCode('hospitalizaciones')).toBe('previous-hospitalization');
    expect(normalizeAntecedentTypeCode('otros')).toBe('other');
  });

  it('builds an OpenMRS-supported FHIR Condition category', () => {
    expect(buildAntecedentTypeCategory('surgical')).toEqual([
      {
        coding: [
          {
            system: OPENMRS_CONDITION_CATEGORY_SYSTEM,
            code: OPENMRS_ANTECEDENT_CATEGORY_CODE,
            display: OPENMRS_ANTECEDENT_CATEGORY_DISPLAY,
          },
        ],
      },
    ]);
  });

  it('stores antecedent type in a FHIR Condition note', () => {
    expect(buildAntecedentTypeNote('other', 'Free text')).toEqual([
      {
        text: '__sihsalus_antecedent_type:other\nFree text',
      },
    ]);
  });

  it('reads antecedent type from note, SIH Salus category, or legacy category values', () => {
    expect(getAntecedentTypeFromNote([{ text: '__sihsalus_antecedent_type:pathological' }])).toBe('pathological');
    expect(
      getAntecedentTypeFromCategory([
        {
          coding: [{ system: ANTECEDENT_TYPE_SYSTEM, code: 'family', display: 'Familiar' }],
        },
      ]),
    ).toBe('family');

    expect(getAntecedentTypeFromCategory([{ text: 'quirurgicos' }])).toBe('surgical');
    expect(
      getAntecedentTypeFromCondition(
        [{ coding: [{ system: OPENMRS_CONDITION_CATEGORY_SYSTEM, code: OPENMRS_ANTECEDENT_CATEGORY_CODE }] }],
        [{ text: '__sihsalus_antecedent_type:social' }],
      ),
    ).toBe('social');
  });

  it('hides internal antecedent type note marker from visible note text', () => {
    expect(getConditionNoteText([{ text: '__sihsalus_antecedent_type:other\nFree text' }])).toBe('Free text');
    expect(getConditionNoteText([{ text: '__sihsalus_antecedent_type:pathological' }])).toBeUndefined();
  });

  it('falls back to category display when the category is not a typed antecedent', () => {
    expect(getAntecedentTypeLabel('unknown')).toBe('--');
    expect(
      getConditionCategoryDisplay([{ coding: [{ code: 'encounter-diagnosis', display: 'Encounter Diagnosis' }] }]),
    ).toBe('Encounter Diagnosis');
  });
});
