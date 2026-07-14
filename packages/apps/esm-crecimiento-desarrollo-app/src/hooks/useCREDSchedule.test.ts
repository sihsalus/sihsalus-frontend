import { generateCREDSchedule } from '../utils/cred-schedule-rules';

import { groupCREDControlEncounters, matchAppointmentsToControls, matchEncountersToControls } from './useCREDSchedule';

describe('groupCREDControlEncounters', () => {
  it('counts several CRED forms in the same visit and day as one control', () => {
    const controls = groupCREDControlEncounters([
      {
        uuid: 'encounter-1',
        encounterDatetime: '2026-07-09T09:00:00-05:00',
        visit: { uuid: 'visit-1' },
      },
      {
        uuid: 'encounter-2',
        encounterDatetime: '2026-07-09T09:05:00-05:00',
        visit: { uuid: 'visit-1' },
      },
      {
        uuid: 'encounter-3',
        encounterDatetime: '2026-07-10T09:00:00-05:00',
        visit: { uuid: 'visit-2' },
      },
    ]);

    expect(controls.map((encounter) => encounter.uuid)).toEqual(['encounter-1', 'encounter-3']);
  });

  it('does not merge controls from different visits on the same day', () => {
    const controls = groupCREDControlEncounters([
      {
        uuid: 'encounter-1',
        encounterDatetime: '2026-07-09T09:00:00-05:00',
        visit: { uuid: 'visit-1' },
      },
      {
        uuid: 'encounter-2',
        encounterDatetime: '2026-07-09T15:00:00-05:00',
        visit: { uuid: 'visit-2' },
      },
    ]);

    expect(controls).toHaveLength(2);
  });
});

describe('matchEncountersToControls', () => {
  const schedule = generateCREDSchedule('2026-05-10T00:00:00.000Z');

  it('matches a late first encounter to the age window in which it occurred', () => {
    const matches = matchEncountersToControls(schedule, [
      {
        uuid: 'first-cred-encounter',
        encounterDatetime: '2026-11-30T15:00:00.000Z',
        visit: { uuid: 'visit-1' },
      },
    ]);

    expect([...matches.keys()]).toEqual([8]);
    expect(matches.get(8)?.uuid).toBe('first-cred-encounter');
  });

  it('does not spill a second encounter in the same age window into a future control', () => {
    const matches = matchEncountersToControls(schedule, [
      {
        uuid: 'encounter-1',
        encounterDatetime: '2026-07-14T15:00:00.000Z',
        visit: { uuid: 'visit-1' },
      },
      {
        uuid: 'encounter-2',
        encounterDatetime: '2026-07-15T15:00:00.000Z',
        visit: { uuid: 'visit-2' },
      },
    ]);

    expect([...matches.keys()]).toEqual([5]);
    expect(matches.has(6)).toBe(false);
  });

  it('ignores encounters outside the CRED age range', () => {
    const matches = matchEncountersToControls(schedule, [
      {
        uuid: 'before-birth',
        encounterDatetime: '2026-05-01T15:00:00.000Z',
        visit: { uuid: 'visit-1' },
      },
      {
        uuid: 'after-cred-age',
        encounterDatetime: '2038-06-01T15:00:00.000Z',
        visit: { uuid: 'visit-2' },
      },
    ]);

    expect(matches.size).toBe(0);
  });
});

describe('matchAppointmentsToControls', () => {
  const schedule = generateCREDSchedule('2026-05-10T00:00:00.000Z');

  it('does not assign duplicate appointments in one age window to later controls', () => {
    const matches = matchAppointmentsToControls(
      schedule,
      [
        { uuid: 'appointment-1', startDateTime: '2026-07-14T15:00:00.000Z' },
        { uuid: 'appointment-2', startDateTime: '2026-07-15T15:00:00.000Z' },
      ],
      new Set(),
    );

    expect([...matches.keys()]).toEqual([5]);
    expect(matches.has(6)).toBe(false);
  });

  it('does not replace a completed control with an appointment from the same age window', () => {
    const matches = matchAppointmentsToControls(
      schedule,
      [{ uuid: 'appointment-1', startDateTime: '2026-07-14T15:00:00.000Z' }],
      new Set([5]),
    );

    expect(matches.size).toBe(0);
  });
});
