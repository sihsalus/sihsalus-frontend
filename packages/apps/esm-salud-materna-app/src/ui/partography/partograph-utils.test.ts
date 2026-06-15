import { buildPartographChartData, buildPartographRecords, normalizeDescentOfHead } from './partograph-utils';

const concepts = {
  timeRecordedUuid: 'time-recorded',
  fetalHeartRateUuid: 'fhr',
  cervicalDilationUuid: 'dilation',
  descentOfHeadUuid: 'descent',
  contractionFrequencyUuid: 'frequency',
  contractionIntensityUuid: 'intensity',
  contractionDurationUuid: 'duration',
  maternalSystolicBloodPressureUuid: 'systolic',
  maternalDiastolicBloodPressureUuid: 'diastolic',
  maternalPulseUuid: 'pulse',
  maternalTemperatureUuid: 'temperature',
  maternalRespiratoryRateUuid: 'respiratory-rate',
  urineOutputUuid: 'urine-output',
  fetalDeathUuid: 'fetal-death',
  observationsUuid: 'observations',
};

const descentLabels = {
  'one-fifth': '1/5',
  'three-fifths': '3/5',
};

describe('partograph-utils', () => {
  it('normalizes progress observations into chronological records', () => {
    const records = buildPartographRecords(
      [
        {
          uuid: 'progress-2',
          obsDatetime: '2026-01-01T12:00:00.000Z',
          groupMembers: [
            { concept: { uuid: concepts.timeRecordedUuid }, value: '2026-01-01T12:05:00.000Z' },
            { concept: { uuid: concepts.fetalHeartRateUuid }, value: 145 },
            { concept: { uuid: concepts.cervicalDilationUuid }, value: 6 },
            { concept: { uuid: concepts.descentOfHeadUuid }, value: { uuid: 'three-fifths' } },
            { concept: { uuid: concepts.contractionFrequencyUuid }, value: 4 },
            { concept: { uuid: concepts.contractionIntensityUuid }, value: { display: 'Moderado' } },
            { concept: { uuid: concepts.contractionDurationUuid }, value: 45 },
            { concept: { uuid: concepts.maternalSystolicBloodPressureUuid }, value: 118 },
            { concept: { uuid: concepts.maternalDiastolicBloodPressureUuid }, value: 74 },
            { concept: { uuid: concepts.maternalPulseUuid }, value: 86 },
            { concept: { uuid: concepts.maternalTemperatureUuid }, value: 36.7 },
            { concept: { uuid: concepts.maternalRespiratoryRateUuid }, value: 18 },
            { concept: { uuid: concepts.urineOutputUuid }, value: '300 ml' },
            { concept: { uuid: concepts.observationsUuid }, value: 'Evolución favorable' },
          ],
        },
        {
          uuid: 'progress-1',
          obsDatetime: '2026-01-01T10:00:00.000Z',
          groupMembers: [
            { concept: { uuid: concepts.timeRecordedUuid }, value: '2026-01-01T10:00:00.000Z' },
            { concept: { uuid: concepts.fetalHeartRateUuid }, value: '138' },
            { concept: { uuid: concepts.cervicalDilationUuid }, value: 4 },
            { concept: { uuid: concepts.descentOfHeadUuid }, value: { uuid: 'one-fifth' } },
          ],
        },
      ],
      concepts,
      descentLabels,
    );

    expect(records.map((record) => record.id)).toEqual(['progress-1', 'progress-2']);
    expect(records[0]).toEqual(
      expect.objectContaining({
        fetalHeartRate: 138,
        cervicalDilation: 4,
        descentOfHead: '1/5',
        descentOfHeadValue: 1,
      }),
    );
    expect(records[1]).toEqual(
      expect.objectContaining({
        fetalHeartRate: 145,
        cervicalDilation: 6,
        descentOfHead: '3/5',
        descentOfHeadValue: 3,
        contractionFrequency: 4,
        contractionIntensity: 'Moderado',
        contractionDuration: 45,
        maternalSystolicBloodPressure: 118,
        maternalDiastolicBloodPressure: 74,
        maternalPulse: 86,
        maternalTemperature: 36.7,
        maternalRespiratoryRate: 18,
        urineOutput: '300 ml',
        observations: 'Evolución favorable',
      }),
    );
  });

  it('normalizes the configured obstetric monitoring form concepts', () => {
    const monitoringConcepts = {
      timeRecordedUuid: '2c67cd3d-407c-4f4d-bdf7-0f32b42ccfb4',
      fetalHeartRateUuid: 'b1fb2d14-92ec-4fda-90e5-40f3227c9c65',
      cervicalDilationUuid: '',
      descentOfHeadUuid: '',
      contractionFrequencyUuid: '20eb9478-2ab2-48bd-8dca-3b563b0c7c47',
      contractionIntensityUuid: 'ba6099d8-f7ce-41de-b9ec-6e8b42252911',
      contractionDurationUuid: '9641ed77-354a-4a10-b16e-85b8f934031d',
      maternalSystolicBloodPressureUuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      maternalDiastolicBloodPressureUuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      maternalPulseUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      maternalTemperatureUuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      maternalRespiratoryRateUuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      urineOutputUuid: 'e204d05c-f4f2-4935-88a2-c6ebcded999f',
      fetalDeathUuid: '9e77be6d-6659-4cf3-bb27-8956ce6dcb67',
      observationsUuid: 'f947a4ad-3d8d-4516-8e6b-67b3dca4e227',
    };

    const records = buildPartographRecords(
      [
        {
          uuid: 'monitoring-row',
          obsDatetime: '2026-01-01T10:00:00.000Z',
          groupMembers: [
            { concept: { uuid: monitoringConcepts.timeRecordedUuid }, value: '2026-01-01T10:30:00.000Z' },
            { concept: { uuid: monitoringConcepts.fetalHeartRateUuid }, value: 142 },
            { concept: { uuid: monitoringConcepts.contractionFrequencyUuid }, value: '4' },
            { concept: { uuid: monitoringConcepts.contractionIntensityUuid }, value: { display: 'Fuerte' } },
            { concept: { uuid: monitoringConcepts.contractionDurationUuid }, value: 60 },
            { concept: { uuid: monitoringConcepts.maternalSystolicBloodPressureUuid }, value: 120 },
            { concept: { uuid: monitoringConcepts.maternalDiastolicBloodPressureUuid }, value: 80 },
            { concept: { uuid: monitoringConcepts.maternalPulseUuid }, value: 90 },
            { concept: { uuid: monitoringConcepts.maternalTemperatureUuid }, value: 37.1 },
            { concept: { uuid: monitoringConcepts.maternalRespiratoryRateUuid }, value: 20 },
            { concept: { uuid: monitoringConcepts.urineOutputUuid }, value: 'Diuresis espontánea' },
            { concept: { uuid: monitoringConcepts.fetalDeathUuid }, value: 'No' },
            { concept: { uuid: monitoringConcepts.observationsUuid }, value: 'Sin signos de alarma' },
          ],
        },
      ],
      monitoringConcepts,
      {},
    );

    expect(records[0]).toEqual(
      expect.objectContaining({
        fetalHeartRate: 142,
        contractionFrequency: 4,
        contractionIntensity: 'Fuerte',
        contractionDuration: 60,
        maternalSystolicBloodPressure: 120,
        maternalDiastolicBloodPressure: 80,
        maternalPulse: 90,
        maternalTemperature: 37.1,
        maternalRespiratoryRate: 20,
        urineOutput: 'Diuresis espontánea',
        fetalDeath: 'No',
        observations: 'Sin signos de alarma',
      }),
    );
  });

  it('keeps zero values when building chart points', () => {
    const chartData = buildPartographChartData(
      [
        {
          id: 'progress-1',
          date: '2026-01-01T10:00:00.000Z',
          cervicalDilation: 0,
        },
      ],
      'cervicalDilation',
      'Dilatación cervical',
    );

    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toEqual(
      expect.objectContaining({
        group: 'Dilatación cervical',
        value: 0,
        displayValue: '0',
      }),
    );
  });

  it('ignores invalid dates and non-numeric metric values', () => {
    expect(
      buildPartographRecords(
        [
          {
            uuid: 'invalid-date',
            obsDatetime: 'not-a-date',
            groupMembers: [{ concept: { uuid: concepts.fetalHeartRateUuid }, value: 140 }],
          },
        ],
        concepts,
        descentLabels,
      ),
    ).toEqual([]);

    expect(
      buildPartographChartData(
        [
          {
            id: 'invalid-value',
            date: '2026-01-01T10:00:00.000Z',
            fetalHeartRate: undefined,
          },
        ],
        'fetalHeartRate',
        'Frecuencia cardíaca fetal',
      ),
    ).toEqual([]);
  });

  it('parses descent of head labels as fifths', () => {
    expect(normalizeDescentOfHead('3/5')).toBe(3);
    expect(normalizeDescentOfHead('invalid')).toBeUndefined();
    expect(normalizeDescentOfHead(undefined)).toBeUndefined();
  });
});
