import { mapFromFHIRImmunizationBundle } from './immunization-mapper';

it('excludes an invalidated FHIR event without treating a deferred event as administration', () => {
  const resource = {
    resourceType: 'Immunization' as const,
    patient: null,
    encounter: null,
    vaccineCode: { coding: [{ code: 'synthetic-product', display: 'Synthetic product' }] },
    occurrenceDateTime: '2026-05-28T15:00:00Z',
  };
  const groups = mapFromFHIRImmunizationBundle([
    { ...resource, id: 'invalidated-dose', status: 'entered-in-error' },
    { ...resource, id: 'deferred-dose', status: 'not-done' },
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].existingDoses).toHaveLength(1);
  expect(groups[0].existingDoses[0]).toMatchObject({ immunizationObsUuid: 'deferred-dose', status: 'not-done' });
});
