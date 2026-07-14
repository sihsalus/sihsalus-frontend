import {
  getCREDControlsToSchedule,
  getCREDMinimumIntervalDays,
  getNextCREDControlRecommendation,
  getNextCREDMinimumDate,
} from './cred-control-intervals';

describe('getCREDMinimumIntervalDays', () => {
  const birthDate = '2026-01-01T09:00:00-05:00';

  it.each([
    [14, 7],
    [60, 30],
    [120, 60],
    [180, 30],
    [210, 60],
    [270, 90],
  ])('uses the NTS 238 minimum interval at day %s', (ageInDays, expectedInterval) => {
    const controlDate = new Date('2026-01-01T09:00:00-05:00');
    controlDate.setDate(controlDate.getDate() + ageInDays);

    expect(getCREDMinimumIntervalDays(birthDate, controlDate)).toBe(expectedInterval);
  });

  it.each([
    ['2027-01-01T09:00:00-05:00', 90],
    ['2028-01-01T09:00:00-05:00', 180],
    ['2031-01-01T09:00:00-05:00', 360],
  ])('uses the age-group interval at %s', (controlDate, expectedInterval) => {
    expect(getCREDMinimumIntervalDays(birthDate, controlDate)).toBe(expectedInterval);
  });
});

describe('getNextCREDControlRecommendation', () => {
  const birthDate = '2026-01-01T09:00:00-05:00';

  it('makes a late first consultation control 1 and due immediately', () => {
    const recommendation = getNextCREDControlRecommendation(birthDate, [], [], '2026-07-01T10:00:00-05:00');

    expect(recommendation).toEqual(
      expect.objectContaining({
        controlNumber: 1,
        targetDate: new Date('2026-07-01T10:00:00-05:00'),
        status: 'pending',
      }),
    );
  });

  it('calculates the next control from the last real six-month control', () => {
    const recommendation = getNextCREDControlRecommendation(
      birthDate,
      [{ encounterDatetime: '2026-07-01T09:00:00-05:00', controlNumber: 1 }],
      [],
      '2026-07-15T10:00:00-05:00',
    );

    expect(recommendation).toEqual(
      expect.objectContaining({
        controlNumber: 2,
        targetDate: new Date('2026-08-01T09:00:00-05:00'),
        status: 'future',
      }),
    );
  });

  it('marks only the next real control as overdue', () => {
    const recommendation = getNextCREDControlRecommendation(
      birthDate,
      [{ encounterDatetime: '2026-07-01T09:00:00-05:00', controlNumber: 1 }],
      [],
      '2026-08-15T10:00:00-05:00',
    );

    expect(recommendation?.status).toBe('overdue');
  });

  it('associates the earliest active appointment after the minimum interval', () => {
    const recommendation = getNextCREDControlRecommendation(
      birthDate,
      [{ encounterDatetime: '2026-07-01T09:00:00-05:00', controlNumber: 1 }],
      [
        { uuid: 'too-early', startDateTime: '2026-07-20T08:00:00-05:00', status: 'Scheduled' },
        { uuid: 'valid-later', startDateTime: '2026-08-03T08:00:00-05:00', status: 'Scheduled' },
      ],
      '2026-07-15T10:00:00-05:00',
    );

    expect(recommendation).toEqual(
      expect.objectContaining({
        status: 'scheduled',
        appointmentUuid: 'valid-later',
        appointmentDate: new Date('2026-08-03T08:00:00-05:00'),
      }),
    );
  });

  it('ignores appointments on or after the CRED age limit', () => {
    const recommendation = getNextCREDControlRecommendation(
      birthDate,
      [{ encounterDatetime: '2036-01-01T09:00:00-05:00', controlNumber: 26 }],
      [{ uuid: 'outside-age-limit', startDateTime: '2038-01-01T08:00:00-05:00', status: 'Scheduled' }],
      '2036-01-02T09:00:00-05:00',
    );

    expect(recommendation).toEqual(
      expect.objectContaining({
        controlNumber: 27,
        status: 'future',
      }),
    );
    expect(recommendation?.appointmentUuid).toBeUndefined();
  });

  it('does not recommend a second control inside the same annual age band', () => {
    const recommendation = getNextCREDControlRecommendation(
      birthDate,
      [{ encounterDatetime: '2031-01-01T09:00:00-05:00', controlNumber: 10 }],
      [],
      '2031-06-01T09:00:00-05:00',
    );

    expect(recommendation?.targetDate).toEqual(new Date('2032-01-01T09:00:00-05:00'));
  });

  it('stops recommendations after control 27 or the CRED age limit', () => {
    expect(
      getNextCREDControlRecommendation(
        birthDate,
        [{ encounterDatetime: '2037-01-01T09:00:00-05:00', controlNumber: 27 }],
        [],
        '2037-01-02T09:00:00-05:00',
      ),
    ).toBeNull();
    expect(getNextCREDControlRecommendation(birthDate, [], [], '2038-01-01T09:00:00-05:00')).toBeNull();
  });
});

describe('getNextCREDMinimumDate', () => {
  const birthDate = '2026-01-01T09:00:00-05:00';

  it('uses birth as the lower bound for the first real control', () => {
    expect(getNextCREDMinimumDate(birthDate, [])).toEqual(new Date(birthDate));
  });

  it('derives the minimum from the last real control and the next age band', () => {
    expect(
      getNextCREDMinimumDate(birthDate, [{ encounterDatetime: '2026-07-15T09:00:00-05:00', controlNumber: 1 }]),
    ).toEqual(new Date('2026-08-14T09:00:00-05:00'));
  });

  it('does not return a minimum after the normative control limit', () => {
    expect(
      getNextCREDMinimumDate(
        birthDate,
        Array.from({ length: 27 }, (_, index) => ({
          encounterDatetime: new Date(2026, 0, index + 1, 9).toISOString(),
          controlNumber: index + 1,
        })),
      ),
    ).toBeNull();
  });
});

describe('getCREDControlsToSchedule', () => {
  it('returns only the single future recommendation without an appointment', () => {
    const nextControl = { controlNumber: 2, status: 'future' };

    expect(getCREDControlsToSchedule(nextControl)).toEqual([nextControl]);
  });

  it.each([
    { status: 'pending' },
    { status: 'overdue' },
    { status: 'scheduled', appointmentUuid: 'appointment-1' },
    { status: 'future', appointmentUuid: 'appointment-1' },
  ])('does not auto-schedule an ineligible recommendation: %j', (nextControl) => {
    expect(getCREDControlsToSchedule(nextControl)).toEqual([]);
  });
});
