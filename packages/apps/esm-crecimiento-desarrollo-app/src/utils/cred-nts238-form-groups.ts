import type { AgeGroup } from './age-group-utils';

export interface CREDFormAgeGroup extends AgeGroup {
  neonatalControl?: number;
}

const EVERY_CONTROL_FORMS = [
  'physicalExamForm',
  'growthNutritionEvaluationForm',
  'oralHealthInspectionForm',
  'visualScreeningForm',
  'hearingScreeningForm',
  'cancerWarningSignsForm',
  'metalsExposureScreeningForm',
  'violenceDisciplineScreeningForm',
  'credCounselingAgreementForm',
  'homeVisitFollowupForm',
  'referralInterconsultationForm',
];

const INFANT_FORMS = ['childFeeding6to42', 'supplementationForm'];
const SCHOOL_FORMS = ['schoolHealthCounselingForm'];

function withCommon(...forms: string[]): string[] {
  return [...EVERY_CONTROL_FORMS, ...forms];
}

function withCommonUnder30Months(...forms: string[]): string[] {
  return ['riskInterview0to30', ...withCommon(...forms)];
}

/**
 * NTS 238-MINSA/DGIESP-2025, Anexo 18.
 *
 * Groups are selected from chronological age, never from an ideal control
 * number or scheduled date. Conditional forms remain available so identified
 * clinical risk does not block an indicated activity.
 */
export const CRED_NTS238_FORM_GROUPS: CREDFormAgeGroup[] = [
  {
    label: 'RN - 3 a 6 días',
    minDays: 0,
    maxDays: 6,
    neonatalControl: 1,
    forms: ['newbornNeuroEval', 'breastfeedingObservation', ...withCommonUnder30Months()],
  },
  {
    label: 'RN - 7 a 13 días',
    minDays: 7,
    maxDays: 13,
    neonatalControl: 2,
    forms: ['nursingAssessment', 'breastfeedingObservation', ...withCommonUnder30Months()],
  },
  {
    label: 'RN - 14 a 28 días',
    minDays: 14,
    maxDays: 28,
    neonatalControl: 3,
    forms: ['nursingAssessment', 'breastfeedingObservation', ...withCommonUnder30Months()],
  },
  {
    label: '1 MES',
    minDays: 29,
    maxDays: 59,
    forms: [
      'nursingAssessment',
      'breastfeedingObservation',
      'childMentalHealthForm',
      'ediDevelopmentForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '2 MESES',
    minDays: 60,
    maxDays: 89,
    forms: ['nursingAssessment', 'childFeeding0to5', 'huancaNeurodevelopmentForm', ...withCommonUnder30Months()],
  },
  {
    label: '3 MESES',
    minDays: 90,
    maxDays: 119,
    forms: ['nursingAssessment', 'childFeeding0to5', 'huancaNeurodevelopmentForm', ...withCommonUnder30Months()],
  },
  {
    label: '4 A 5 MESES',
    minDays: 120,
    maxDays: 179,
    forms: ['nursingAssessment', 'childFeeding0to5', 'huancaNeurodevelopmentForm', ...withCommonUnder30Months()],
  },
  {
    label: '6 MESES',
    minDays: 180,
    maxDays: 209,
    forms: [
      'nursingAssessment',
      ...INFANT_FORMS,
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      'vitaminAAdministrationForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '7 A 8 MESES',
    minDays: 210,
    maxDays: 269,
    forms: ['nursingAssessment', ...INFANT_FORMS, 'huancaNeurodevelopmentForm', ...withCommonUnder30Months()],
  },
  {
    label: '9 A 11 MESES',
    minDays: 270,
    maxDays: 359,
    forms: [
      'nursingAssessment',
      ...INFANT_FORMS,
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '12 A 14 MESES',
    minMonths: 12,
    maxMonths: 15,
    forms: [
      'nursingAssessment',
      ...INFANT_FORMS,
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      'vitaminAAdministrationForm',
      'huancaNeurodevelopmentForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '15 A 17 MESES',
    minMonths: 15,
    maxMonths: 18,
    forms: [
      'nursingAssessment',
      ...INFANT_FORMS,
      'anemiaScreeningForm',
      'huancaNeurodevelopmentForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '18 A 20 MESES',
    minMonths: 18,
    maxMonths: 21,
    forms: [
      'nursingAssessment',
      ...INFANT_FORMS,
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      'vitaminAAdministrationForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '21 A 23 MESES',
    minMonths: 21,
    maxMonths: 24,
    forms: ['nursingAssessment', ...INFANT_FORMS, 'huancaNeurodevelopmentForm', ...withCommonUnder30Months()],
  },
  {
    label: '24 A 29 MESES',
    minMonths: 24,
    maxMonths: 30,
    forms: [
      'nursingAssessment',
      'childFeeding6to42',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'autismScreeningForm',
      'parasitosisScreeningForm',
      'vitaminAAdministrationForm',
      'huancaNeurodevelopmentForm',
      ...withCommonUnder30Months(),
    ],
  },
  {
    label: '30 A 35 MESES',
    minMonths: 30,
    maxMonths: 36,
    forms: [
      'nursingAssessment',
      'childFeeding6to42',
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      'vitaminAAdministrationForm',
      ...withCommon(),
    ],
  },
  {
    label: '36 MESES',
    minMonths: 36,
    maxMonths: 37,
    forms: [
      'nursingAssessment',
      'childFeeding6to42',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      'vitaminAAdministrationForm',
      'huancaNeurodevelopmentForm',
      ...withCommon(),
    ],
  },
  {
    label: '37 A 41 MESES',
    minMonths: 37,
    maxMonths: 42,
    forms: [
      'nursingAssessment',
      'childFeeding6to42',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      'vitaminAAdministrationForm',
      ...withCommon(),
    ],
  },
  {
    label: '42 A 47 MESES',
    minMonths: 42,
    maxMonths: 48,
    forms: [
      'nursingAssessment',
      'childFeeding6to42',
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      'vitaminAAdministrationForm',
      ...withCommon(),
    ],
  },
  {
    label: '48 A 53 MESES',
    minMonths: 48,
    maxMonths: 54,
    forms: [
      'nursingAssessment',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      'vitaminAAdministrationForm',
      'expectedSkillsBehaviorsForm',
      ...withCommon(),
    ],
  },
  {
    label: '54 A 59 MESES',
    minMonths: 54,
    maxMonths: 60,
    forms: ['nursingAssessment', 'anemiaScreeningForm', 'vitaminAAdministrationForm', ...withCommon()],
  },
  {
    label: '60 MESES',
    minMonths: 60,
    maxMonths: 61,
    forms: [
      'nursingAssessment',
      'anemiaScreeningForm',
      'ediDevelopmentForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      ...SCHOOL_FORMS,
      ...withCommon(),
    ],
  },
  {
    label: '61 A 71 MESES',
    minMonths: 61,
    maxMonths: 72,
    forms: [
      'nursingAssessment',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      ...SCHOOL_FORMS,
      ...withCommon(),
    ],
  },
  {
    label: '6 A 11 AÑOS',
    minMonths: 72,
    maxMonths: 144,
    forms: [
      'nursingAssessment',
      'anemiaScreeningForm',
      'childMentalHealthForm',
      'parasitosisScreeningForm',
      'expectedSkillsBehaviorsForm',
      ...SCHOOL_FORMS,
      ...withCommon(),
    ],
  },
];
