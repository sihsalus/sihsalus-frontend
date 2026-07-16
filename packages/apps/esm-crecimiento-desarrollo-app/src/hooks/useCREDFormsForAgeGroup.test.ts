import type { ConfigObject } from '../config-schema';
import {
  credCourseLifeEditPrivilege,
  credEarlyStimulationEditPrivilege,
  credNeonatalEditPrivilege,
  credNutritionEditPrivilege,
} from '../constants';
import { getCREDFormEditPrivilege, getCREDFormsForAgeGroup } from './useCREDFormsForAgeGroup';

const config = {
  formsList: {
    atencionImmediataNewborn: 'ATENCION-RN',
    newbornNeuroEval: 'EVAL-RN',
    nursingAssessment: 'VALORACION-ENFERMERIA',
    physicalExamForm: 'EXAMEN-FISICO',
    growthNutritionEvaluationForm: 'CRECIMIENTO-NUTRICION',
  },
  CREDFormsByAgeGroup: [
    {
      label: 'RN - 3 a 6 días (Control 1)',
      minDays: 0,
      maxDays: 6,
      forms: ['atencionImmediataNewborn', 'newbornNeuroEval'],
    },
    {
      label: '4 MESES',
      minMonths: 4,
      maxMonths: 6,
      forms: ['nursingAssessment', 'physicalExamForm', 'growthNutritionEvaluationForm'],
    },
  ],
} as unknown as ConfigObject;

describe('getCREDFormsForAgeGroup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the selected control target date when resolving forms for an overdue control', () => {
    const forms = getCREDFormsForAgeGroup(config, '2026-02-04T00:00:00.000Z', '2026-02-07T00:00:00.000Z');

    expect(forms.map(({ form }) => form.uuid)).toEqual(['ATENCION-RN', 'EVAL-RN']);
  });

  it('uses the current age group when no control target date is provided', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-09T00:00:00.000Z'));

    const forms = getCREDFormsForAgeGroup(config, '2026-02-04T00:00:00.000Z');

    expect(forms.map(({ form }) => form.uuid)).toEqual([
      'VALORACION-ENFERMERIA',
      'EXAMEN-FISICO',
      'CRECIMIENTO-NUTRICION',
    ]);
  });

  it('falls back to the schema default forms list when runtime config does not provide one', () => {
    const configWithoutFormsList = {
      CREDFormsByAgeGroup: [
        {
          label: '4 MESES',
          minMonths: 4,
          maxMonths: 6,
          forms: ['nursingAssessment'],
        },
      ],
    } as unknown as ConfigObject;

    const forms = getCREDFormsForAgeGroup(
      configWithoutFormsList,
      '2026-02-04T00:00:00.000Z',
      '2026-06-09T00:00:00.000Z',
    );

    expect(forms[0]?.form.uuid).toBe('(Página 11 y 12) Valoración de Enfermería');
  });

  it('falls back to the schema default form value when runtime forms list misses a specific key', () => {
    const configWithPartialFormsList = {
      formsList: {
        unrelatedForm: 'UNRELATED',
      },
      CREDFormsByAgeGroup: [
        {
          label: '4 MESES',
          minMonths: 4,
          maxMonths: 6,
          forms: ['nursingAssessment'],
        },
      ],
    } as unknown as ConfigObject;

    const forms = getCREDFormsForAgeGroup(
      configWithPartialFormsList,
      '2026-02-04T00:00:00.000Z',
      '2026-06-09T00:00:00.000Z',
    );

    expect(forms[0]?.form.uuid).toBe('(Página 11 y 12) Valoración de Enfermería');
  });

  it('falls back to the schema default age groups when runtime config groups do not include forms', () => {
    const configWithoutFormGroups = {
      formsList: {
        atencionImmediataNewborn: 'ATENCION-RN',
        newbornNeuroEval: 'EVAL-RN',
      },
      CREDFormsByAgeGroup: [{ label: 'RN - 3 a 6d', minDays: 0, maxDays: 6 }],
    } as unknown as ConfigObject;

    const forms = getCREDFormsForAgeGroup(configWithoutFormGroups, '2026-02-04', '2026-02-07T05:00:00.000Z');

    expect(forms.map(({ form }) => form.uuid)).toContain('EVAL-RN');
    expect(forms.map(({ form }) => form.uuid)).not.toContain('ATENCION-RN');
  });

  it('attaches the section edit privilege required to launch each form', () => {
    const forms = getCREDFormsForAgeGroup(config, '2026-02-04T00:00:00.000Z', '2026-02-07T00:00:00.000Z');

    expect(forms.map(({ requiredPrivilege }) => requiredPrivilege)).toEqual([
      credNeonatalEditPrivilege,
      credNeonatalEditPrivilege,
    ]);
  });

  it.each([
    ['2026-03-06', 'ediDevelopmentForm', 'huancaNeurodevelopmentForm'],
    ['2026-04-06', 'huancaNeurodevelopmentForm', 'ediDevelopmentForm'],
    ['2029-08-05', 'ediDevelopmentForm', 'huancaNeurodevelopmentForm'],
    ['2029-03-05', 'anemiaScreeningForm', 'huancaNeurodevelopmentForm'],
    ['2030-02-05', 'expectedSkillsBehaviorsForm', 'ediDevelopmentForm'],
    ['2030-08-05', 'vitaminAAdministrationForm', 'expectedSkillsBehaviorsForm'],
    ['2031-03-05', 'childMentalHealthForm', 'ediDevelopmentForm'],
  ])('uses the NTS 238 activity matrix at %s', (referenceDate, expectedForm, unexpectedForm) => {
    const defaultMatrixConfig = {
      formsList: {},
      CREDFormsByAgeGroup: [],
    } as unknown as ConfigObject;

    const formKeys = getCREDFormsForAgeGroup(defaultMatrixConfig, '2026-02-05', referenceDate).map(
      ({ formKey }) => formKey,
    );

    expect(formKeys).toContain(expectedForm);
    expect(formKeys).not.toContain(unexpectedForm);
  });

  it('uses day ranges before month ranges at the 59/60-day boundary', () => {
    const defaultMatrixConfig = {
      formsList: {},
      CREDFormsByAgeGroup: [],
    } as unknown as ConfigObject;

    const at59Days = getCREDFormsForAgeGroup(defaultMatrixConfig, '2026-02-05', '2026-04-05').map(
      ({ formKey }) => formKey,
    );
    const at60Days = getCREDFormsForAgeGroup(defaultMatrixConfig, '2026-02-05', '2026-04-06').map(
      ({ formKey }) => formKey,
    );

    expect(at59Days).toContain('ediDevelopmentForm');
    expect(at59Days).not.toContain('huancaNeurodevelopmentForm');
    expect(at60Days).toContain('huancaNeurodevelopmentForm');
    expect(at60Days).not.toContain('ediDevelopmentForm');
  });
});

describe('getCREDFormEditPrivilege', () => {
  it('maps forms to the edit privilege of their CRED section', () => {
    expect(getCREDFormEditPrivilege('atencionImmediataNewborn')).toBe(credNeonatalEditPrivilege);
    expect(getCREDFormEditPrivilege('anemiaScreeningForm')).toBe(credNutritionEditPrivilege);
    expect(getCREDFormEditPrivilege('stimulationSessionForm')).toBe(credEarlyStimulationEditPrivilege);
  });

  it('falls back to the course-of-life edit privilege for unmapped forms', () => {
    expect(getCREDFormEditPrivilege('childAbuseScreening')).toBe(credCourseLifeEditPrivilege);
  });
});
