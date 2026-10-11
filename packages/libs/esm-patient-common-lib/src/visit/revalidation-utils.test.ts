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

describe('invalidateVisitAndEncounterData', () => {
  it('limits clinical invalidation to the exact patient and supported resources', async () => {
    const { invalidateVisitAndEncounterData } = await import('./revalidation-utils');
    const mutate = vi.fn();
    invalidateVisitAndEncounterData(mutate, 'patient-a');
    expect(mutate).toHaveBeenCalledOnce();
    const predicate = mutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(predicate('/ws/rest/v1/visit?limit=1&patient=patient-a&includeInactive=true')).toBe(true);
    expect(predicate('/ws/rest/v1/visit?patient=patient-a&includeInactive=false')).toBe(false);
    expect(predicate('/ws/rest/v1/visit?patient=patient-a-other&limit=1')).toBe(false);
    expect(predicate('/ws/rest/v1/encounterType?patient=patient-a')).toBe(false);
    expect(predicate('/ws/rest/v1/obs?patient=patient-a&concept=weight')).toBe(true);
    expect(predicate('/ws/fhir2/R4/Observation?subject:Patient=patient-a')).toBe(true);
    expect(predicate('/ws/fhir2/R4/Observation?subject:Patient=patient-b')).toBe(false);
    expect(predicate({ patientUuid: 'patient-a', conceptUuids: 'weight', page: 0, pageSize: 100 })).toBe(true);
    expect(predicate({ patientUuid: 'patient-b', conceptUuids: 'weight', page: 0, pageSize: 100 })).toBe(false);
    expect(predicate({ patientUuid: 'patient-a', programUuid: 'program' })).toBe(false);
    expect(predicate('/ws/rest/v1/concept/weight')).toBe(false);
  });
  it('does not invalidate any cached data without a patient identity', async () => {
    const { invalidateVisitAndEncounterData } = await import('./revalidation-utils');
    const mutate = vi.fn();
    invalidateVisitAndEncounterData(mutate, '');
    expect(mutate).not.toHaveBeenCalled();
  });
});
