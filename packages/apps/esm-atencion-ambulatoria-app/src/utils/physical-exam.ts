export const formEngineFieldPathPrefix = 'rfe-forms-';

export const physicalExamFields = [
  {
    key: 'generalState',
    questionId: 'estadoGeneral',
    translationKey: 'generalCondition',
    defaultLabel: 'Estado general',
  },
  {
    key: 'consciousness',
    questionId: 'estadoConciencia',
    translationKey: 'consciousnessStatus',
    defaultLabel: 'Conciencia y orientación',
  },
  {
    key: 'skinAndAppendages',
    questionId: 'pielAnexos',
    translationKey: 'skinAndAppendages',
    defaultLabel: 'Piel y faneras',
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
    defaultLabel: 'Abdomen',
  },
  {
    key: 'genitourinary',
    questionId: 'genitourinario',
    translationKey: 'genitourinarySystem',
    defaultLabel: 'Genito urinario',
  },
  {
    key: 'musculoskeletal',
    questionId: 'musculoesqueleticoExtremidades',
    translationKey: 'musculoskeletalAndExtremities',
    defaultLabel: 'Aparato locomotor y extremidades',
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
    defaultLabel: 'Resumen regional y otros hallazgos objetivos',
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
