export const formEngineFieldPathPrefix = 'rfe-forms-';

export const physicalExamFields = [
  {
    key: 'generalState',
    questionId: 'estadoGeneral',
    translationKey: 'generalCondition',
    defaultLabel: 'Estado general',
  },
  {
    key: 'hydration',
    questionId: 'estadoHidratacion',
    translationKey: 'hydrationStatus',
    defaultLabel: 'Estado de hidratación',
  },
  {
    key: 'nutrition',
    questionId: 'estadoNutricion',
    translationKey: 'nutritionStatus',
    defaultLabel: 'Estado de nutrición',
  },
  {
    key: 'consciousness',
    questionId: 'estadoConciencia',
    translationKey: 'consciousnessStatus',
    defaultLabel: 'Estado de conciencia',
  },
  {
    key: 'skinAndAppendages',
    questionId: 'pielAnexos',
    translationKey: 'skinAndAppendages',
    defaultLabel: 'Piel y anexos',
  },
  {
    key: 'regionalSummary',
    questionId: 'resumenExamenRegional',
    translationKey: 'regionalExamSummary',
    defaultLabel: 'Resumen del examen regional',
  },
  {
    key: 'headAndNeck',
    questionId: 'cabezaCuello',
    translationKey: 'headAndNeck',
    defaultLabel: 'Cabeza y cuello',
  },
  {
    key: 'respiratory',
    questionId: 'aparatoRespiratorio',
    translationKey: 'respiratorySystem',
    defaultLabel: 'Aparato respiratorio',
  },
  {
    key: 'cardiovascular',
    questionId: 'aparatoCardiovascular',
    translationKey: 'cardiovascularSystem',
    defaultLabel: 'Aparato cardiovascular',
  },
  {
    key: 'abdomenAndDigestive',
    questionId: 'abdomenDigestivo',
    translationKey: 'abdomenAndDigestiveSystem',
    defaultLabel: 'Abdomen y aparato digestivo',
  },
  {
    key: 'genitourinary',
    questionId: 'genitourinario',
    translationKey: 'genitourinarySystem',
    defaultLabel: 'Genitourinario',
  },
  {
    key: 'musculoskeletal',
    questionId: 'musculoesqueleticoExtremidades',
    translationKey: 'musculoskeletalAndExtremities',
    defaultLabel: 'Musculoesquelético y extremidades',
  },
  {
    key: 'neurological',
    questionId: 'neurologico',
    translationKey: 'neurologicalExam',
    defaultLabel: 'Neurológico',
  },
  {
    key: 'otherFindings',
    questionId: 'soapObjetivo',
    translationKey: 'otherObjectiveFindings',
    defaultLabel: 'Otros hallazgos objetivos',
  },
] as const;

export type PhysicalExamFieldKey = (typeof physicalExamFields)[number]['key'];
export type PhysicalExamValues = Record<PhysicalExamFieldKey, string | null>;

export function getFormEngineFieldPath(questionId: string): string {
  return `${formEngineFieldPathPrefix}${questionId}`;
}

export function hasSegmentedPhysicalExam(values: PhysicalExamValues): boolean {
  return physicalExamFields.some(({ key }) => key !== 'otherFindings' && Boolean(values[key]));
}
