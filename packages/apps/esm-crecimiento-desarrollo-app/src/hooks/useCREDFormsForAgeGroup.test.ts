import type { ConfigObject } from '../config-schema';
import { getCREDFormsForAgeGroup } from './useCREDFormsForAgeGroup';

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

    expect(forms.map(({ form }) => form.uuid).slice(0, 2)).toEqual(['ATENCION-RN', 'EVAL-RN']);
  });
});
