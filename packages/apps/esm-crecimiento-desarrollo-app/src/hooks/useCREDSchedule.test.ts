import { groupCREDControlEncounters } from './useCREDSchedule';

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
