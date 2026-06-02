export type TestPeruanoAreaId = 'motorPostural' | 'visomotor' | 'language' | 'personalSocial' | 'intelligenceLearning';

export type TestPeruanoCellStatus = 'notEvaluated' | 'achieved' | 'notAchieved';
export type TestPeruanoClassification = 'normal' | 'riesgo' | 'retraso';

export interface TestPeruanoAreaDefinition {
  id: TestPeruanoAreaId;
  labelKey: string;
  labelDefault: string;
}

export interface TestPeruanoAreaResult {
  achieved: number;
  expected: number;
  notAchieved: number;
  pending: number;
  scorePercent: number;
  classification: TestPeruanoClassification;
}

export interface TestPeruanoResults {
  areas: Record<TestPeruanoAreaId, TestPeruanoAreaResult>;
  total: TestPeruanoAreaResult & {
    recommendationKey: string;
    recommendationDefault: string;
  };
}

export interface TestPeruanoPersistenceConcepts {
  ageMonthsUuid: string;
  instrumentUuid: string;
  instrumentTestPeruanoAnswerUuid: string;
  classificationUuid: string;
  classificationAnswers: Record<TestPeruanoClassification, string>;
  totalScoreUuid: string;
  snapshotUuid: string;
  referralUuid: string;
  referralAnswers: {
    yes: string;
    no: string;
  };
  planUuid: string;
  observationsUuid: string;
}

export interface TestPeruanoPersistenceConfig {
  encounterTypeUuid: string;
  formUuid: string;
  concepts: TestPeruanoPersistenceConcepts;
}

export interface TestPeruanoEncounterPayload {
  patient: string;
  location: string;
  encounterType: string;
  form: string;
  encounterDatetime: string;
  obs: Array<{
    concept: string;
    value: string | number;
  }>;
}

export interface TestPeruanoFormData {
  childAgeMonths: number;
  evaluationDate: string;
  culturalContext: 'urbano' | 'rural' | 'urbano_marginal';
  primaryLanguage: 'español' | 'quechua' | 'bilingue';
  observations?: string;
  culturalNotes?: string;
}

export type TestPeruanoProfile = Record<TestPeruanoAreaId, Record<number, TestPeruanoCellStatus>>;

export const TEST_PERUANO_AGE_MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 21, 24, 30] as const;

export const TEST_PERUANO_AREAS: Array<TestPeruanoAreaDefinition> = [
  {
    id: 'motorPostural',
    labelKey: 'tpAreaMotorPostural',
    labelDefault: 'Motor postural',
  },
  {
    id: 'visomotor',
    labelKey: 'tpAreaVisomotor',
    labelDefault: 'Coordinación visomotora',
  },
  {
    id: 'language',
    labelKey: 'tpAreaLanguage',
    labelDefault: 'Lenguaje',
  },
  {
    id: 'personalSocial',
    labelKey: 'tpAreaPersonalSocial',
    labelDefault: 'Personal social',
  },
  {
    id: 'intelligenceLearning',
    labelKey: 'tpAreaIntelligenceLearning',
    labelDefault: 'Inteligencia y aprendizaje',
  },
];

export const defaultTestPeruanoPersistence: TestPeruanoPersistenceConfig = {
  encounterTypeUuid: 'a990eabc-3405-419f-bfb1-96ca2d8279b8',
  formUuid: '6de41002-6b38-4fdc-9551-c78642256040',
  concepts: {
    ageMonthsUuid: '1410AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    instrumentUuid: 'c4010001-0000-4000-8000-000000000001',
    instrumentTestPeruanoAnswerUuid: 'c4010013-0000-4000-8000-000000000013',
    classificationUuid: 'c4010002-0000-4000-8000-000000000002',
    classificationAnswers: {
      normal: '1115AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      riesgo: 'c4010021-0000-4000-8000-000000000021',
      retraso: 'c4010022-0000-4000-8000-000000000022',
    },
    totalScoreUuid: 'c4010003-0000-4000-8000-000000000003',
    snapshotUuid: 'c4010004-0000-4000-8000-000000000004',
    referralUuid: 'c4010005-0000-4000-8000-000000000005',
    referralAnswers: {
      yes: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      no: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
    planUuid: 'c4010006-0000-4000-8000-000000000006',
    observationsUuid: '161011AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  },
};

export function resolveTestPeruanoPersistence(
  configured?: Partial<TestPeruanoPersistenceConfig>,
): TestPeruanoPersistenceConfig {
  return {
    ...defaultTestPeruanoPersistence,
    ...(configured ?? {}),
    concepts: {
      ...defaultTestPeruanoPersistence.concepts,
      ...(configured?.concepts ?? {}),
      classificationAnswers: {
        ...defaultTestPeruanoPersistence.concepts.classificationAnswers,
        ...(configured?.concepts?.classificationAnswers ?? {}),
      },
      referralAnswers: {
        ...defaultTestPeruanoPersistence.concepts.referralAnswers,
        ...(configured?.concepts?.referralAnswers ?? {}),
      },
    },
  };
}

export function createEmptyTestPeruanoProfile(): TestPeruanoProfile {
  return TEST_PERUANO_AREAS.reduce((profile, area) => {
    profile[area.id] = TEST_PERUANO_AGE_MONTHS.reduce<Record<number, TestPeruanoCellStatus>>((months, month) => {
      months[month] = 'notEvaluated';
      return months;
    }, {});
    return profile;
  }, {} as TestPeruanoProfile);
}

export function getNextTestPeruanoCellStatus(status: TestPeruanoCellStatus): TestPeruanoCellStatus {
  if (status === 'notEvaluated') {
    return 'achieved';
  }

  return status === 'achieved' ? 'notAchieved' : 'notEvaluated';
}

function calculateClassification(scorePercent: number, notAchieved: number): TestPeruanoClassification {
  if (notAchieved >= 3 || scorePercent < 70) {
    return 'retraso';
  }

  if (notAchieved > 0 || scorePercent < 85) {
    return 'riesgo';
  }

  return 'normal';
}

export function calculateTestPeruanoResults(profile: TestPeruanoProfile, childAgeMonths: number): TestPeruanoResults {
  const expectedMonths = TEST_PERUANO_AGE_MONTHS.filter((month) => month <= childAgeMonths);

  const areas = TEST_PERUANO_AREAS.reduce<Record<TestPeruanoAreaId, TestPeruanoAreaResult>>(
    (acc, area) => {
      const statuses = expectedMonths.map((month) => profile[area.id]?.[month] ?? 'notEvaluated');
      const achieved = statuses.filter((status) => status === 'achieved').length;
      const notAchieved = statuses.filter((status) => status === 'notAchieved').length;
      const pending = statuses.filter((status) => status === 'notEvaluated').length;
      const expected = statuses.length;
      const scorePercent = expected > 0 ? Math.round((achieved / expected) * 100) : 0;

      acc[area.id] = {
        achieved,
        expected,
        notAchieved,
        pending,
        scorePercent,
        classification: calculateClassification(scorePercent, notAchieved),
      };

      return acc;
    },
    {} as Record<TestPeruanoAreaId, TestPeruanoAreaResult>,
  );

  const total = Object.values(areas).reduce(
    (acc, area) => ({
      achieved: acc.achieved + area.achieved,
      expected: acc.expected + area.expected,
      notAchieved: acc.notAchieved + area.notAchieved,
      pending: acc.pending + area.pending,
    }),
    { achieved: 0, expected: 0, notAchieved: 0, pending: 0 },
  );
  const scorePercent = total.expected > 0 ? Math.round((total.achieved / total.expected) * 100) : 0;
  const classification = calculateClassification(scorePercent, total.notAchieved);
  const recommendation =
    classification === 'retraso'
      ? {
          recommendationKey: 'tpRecommendationDelay',
          recommendationDefault: 'Referir para evaluación especializada y plan de intervención temprana.',
        }
      : classification === 'riesgo'
        ? {
            recommendationKey: 'tpRecommendationRisk',
            recommendationDefault: 'Programar reevaluación y reforzar consejería de estimulación temprana.',
          }
        : {
            recommendationKey: 'tpRecommendationNormal',
            recommendationDefault: 'Continuar controles CRED y actividades de estimulación según edad.',
          };

  return {
    areas,
    total: {
      ...total,
      scorePercent,
      classification,
      ...recommendation,
    },
  };
}

export function mapTestPeruanoClassificationToConcept(
  classification: TestPeruanoClassification,
  persistence: TestPeruanoPersistenceConfig,
) {
  return persistence.concepts.classificationAnswers[classification];
}

export function mapToTestPeruanoEncounterPayload({
  config,
  data,
  locationUuid,
  patientUuid,
  profile,
  results,
}: {
  config?: Partial<TestPeruanoPersistenceConfig>;
  data: TestPeruanoFormData;
  locationUuid: string;
  patientUuid: string;
  profile: TestPeruanoProfile;
  results: TestPeruanoResults;
}): TestPeruanoEncounterPayload {
  const persistence = resolveTestPeruanoPersistence(config);
  const snapshot = {
    version: '1.0.0',
    instrument: 'test-peruano-desarrollo-nino',
    data,
    profile,
    results,
  };
  const requiresReferral = results.total.classification !== 'normal';
  const observations = [data.observations, data.culturalNotes].filter(Boolean).join('\n\n');

  const obs: TestPeruanoEncounterPayload['obs'] = [
    { concept: persistence.concepts.ageMonthsUuid, value: data.childAgeMonths },
    { concept: persistence.concepts.instrumentUuid, value: persistence.concepts.instrumentTestPeruanoAnswerUuid },
    {
      concept: persistence.concepts.classificationUuid,
      value: mapTestPeruanoClassificationToConcept(results.total.classification, persistence),
    },
    { concept: persistence.concepts.totalScoreUuid, value: results.total.scorePercent },
    { concept: persistence.concepts.snapshotUuid, value: JSON.stringify(snapshot) },
    {
      concept: persistence.concepts.referralUuid,
      value: requiresReferral ? persistence.concepts.referralAnswers.yes : persistence.concepts.referralAnswers.no,
    },
    {
      concept: persistence.concepts.planUuid,
      value: results.total.recommendationDefault,
    },
  ];

  if (observations) {
    obs.push({ concept: persistence.concepts.observationsUuid, value: observations });
  }

  return {
    patient: patientUuid,
    location: locationUuid,
    encounterType: persistence.encounterTypeUuid,
    form: persistence.formUuid,
    encounterDatetime: new Date(`${data.evaluationDate}T00:00:00`).toISOString(),
    obs,
  };
}
