import { invalidatePatientEncounters } from './revalidation-utils';

describe('invalidatePatientEncounters', () => {
  it('invalidates string and structured encounter keys for the selected patient only', () => {
    const mutate = vi.fn();

    invalidatePatientEncounters(mutate, 'patient-a');

    expect(mutate).toHaveBeenCalledOnce();
    const predicate = mutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(predicate('/ws/rest/v1/encounter?patient=patient-a')).toBe(true);
    expect(
      predicate([
        {
          url: '/ws/rest/v1/encounter?patient=patient-a&encounterType=visit-note',
          expectedVisitTypeUuid: 'ambulatory',
        },
      ]),
    ).toBe(true);
    expect(predicate([{ url: '/ws/rest/v1/encounter?patient=patient-b' }])).toBe(false);
    expect(predicate('/ws/rest/v1/encounter?patient=patient-a-different')).toBe(false);
    expect(predicate('/ws/rest/v1/visit?patient=patient-a')).toBe(false);
  });
});
