import { buildPartographChartData, buildPartographRecords, normalizeDescentOfHead } from './partograph-utils';

const concepts = {
  timeRecordedUuid: 'time-recorded',
  fetalHeartRateUuid: 'fhr',
  cervicalDilationUuid: 'dilation',
  descentOfHeadUuid: 'descent',
  contractionFrequencyUuid: 'frequency',
  contractionDurationUuid: 'duration',
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
            { concept: { uuid: concepts.contractionDurationUuid }, value: 45 },
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
        contractionDuration: 45,
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
