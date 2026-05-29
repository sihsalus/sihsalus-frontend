import {
  calculateTestPeruanoResults,
  createEmptyTestPeruanoProfile,
  mapToTestPeruanoEncounterPayload,
  TEST_PERUANO_AGE_MONTHS,
  TEST_PERUANO_AREAS,
} from './test-peruano-form.utils';

describe('Test Peruano form utilities', () => {
  it('calculates the graphic profile result for expected milestones', () => {
    const profile = createEmptyTestPeruanoProfile();

    for (const area of TEST_PERUANO_AREAS) {
      for (const month of TEST_PERUANO_AGE_MONTHS.filter((value) => value <= 3)) {
        profile[area.id][month] = 'achieved';
      }
    }
    profile.motorPostural[3] = 'notAchieved';

    const results = calculateTestPeruanoResults(profile, 3);

    expect(results.total.expected).toBe(20);
    expect(results.total.achieved).toBe(19);
    expect(results.total.notAchieved).toBe(1);
    expect(results.total.classification).toBe('riesgo');
  });

  it('maps the graphic profile to the CRED-004 encounter payload', () => {
    const profile = createEmptyTestPeruanoProfile();
    profile.language[1] = 'achieved';
    const results = calculateTestPeruanoResults(profile, 1);

    const payload = mapToTestPeruanoEncounterPayload({
      data: {
        childAgeMonths: 1,
        evaluationDate: '2026-05-28',
        culturalContext: 'rural',
        primaryLanguage: 'quechua',
        observations: 'Seguimiento en una semana',
      },
      locationUuid: 'location-uuid',
      patientUuid: 'patient-uuid',
      profile,
      results,
    });

    expect(payload).toMatchObject({
      patient: 'patient-uuid',
      location: 'location-uuid',
      form: '6de41002-6b38-4fdc-9551-c78642256040',
      encounterType: 'a990eabc-3405-419f-bfb1-96ca2d8279b8',
    });
    expect(payload.obs).toEqual(
      expect.arrayContaining([
        { concept: 'c4010001-0000-4000-8000-000000000001', value: 'c4010013-0000-4000-8000-000000000013' },
        { concept: 'c4010003-0000-4000-8000-000000000003', value: results.total.scorePercent },
      ]),
    );

    const snapshotObs = payload.obs.find((obs) => obs.concept === 'c4010004-0000-4000-8000-000000000004');
    expect(JSON.parse(String(snapshotObs?.value))).toMatchObject({
      instrument: 'test-peruano-desarrollo-nino',
      data: { childAgeMonths: 1, culturalContext: 'rural', primaryLanguage: 'quechua' },
    });
  });
});
