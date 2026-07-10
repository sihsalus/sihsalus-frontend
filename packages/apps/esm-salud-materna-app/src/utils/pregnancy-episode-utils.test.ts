import { encounterMatchesForm, flattenMaternalObservations, isWithinPregnancyEpisode } from './pregnancy-episode-utils';

describe('pregnancy episode utilities', () => {
  it('matches forms configured by name or uuid', () => {
    const encounter = {
      uuid: 'encounter-uuid',
      encounterDatetime: '2026-07-01',
      form: { uuid: 'form-uuid', name: 'OBST-002-EMBARAZO ACTUAL' },
    };

    expect(encounterMatchesForm(encounter, 'form-uuid')).toBe(true);
    expect(encounterMatchesForm(encounter, 'obst-002-embarazo actual')).toBe(true);
  });

  it('flattens observations nested in form groups', () => {
    const observations = flattenMaternalObservations([
      {
        concept: { uuid: 'group' },
        groupMembers: [{ concept: { uuid: 'fum' }, value: '2026-01-01' }],
      },
    ]);

    expect(observations.map((observation) => observation.concept?.uuid)).toEqual(['group', 'fum']);
  });

  it('excludes clinical data recorded before the latest pregnancy started', () => {
    expect(isWithinPregnancyEpisode('2025-10-01', '2026-01-01')).toBe(false);
    expect(isWithinPregnancyEpisode('2026-07-01', '2026-01-01')).toBe(true);
  });
});
