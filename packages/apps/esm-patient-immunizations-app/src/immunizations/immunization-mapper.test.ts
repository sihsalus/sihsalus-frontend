import type { FHIRImmunizationResource } from '../types/fhir-immunization-domain';
import { mapFromFHIRImmunizationBundle } from './immunization-mapper';

it.each([undefined, 'unknown'])('retains FHIR status %s as unverified instead of administered', (status) => {
  const resource: FHIRImmunizationResource = {
    resourceType: 'Immunization',
    status: 'completed',
    id: 'synthetic-unverified-dose',
    patient: null,
    encounter: null,
    vaccineCode: { coding: [{ code: 'synthetic-product', display: 'Synthetic product' }] },
    occurrenceDateTime: '2026-05-28T15:00:00Z',
  };
  Reflect.set(resource, 'status', status);
  const groups = mapFromFHIRImmunizationBundle([resource]);
  expect(groups[0].existingDoses).toEqual([
    expect.objectContaining({ immunizationObsUuid: resource.id, status: 'unverified' }),
  ]);
});

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

const immunization = (id: string, doseNumber: number, occurrenceDateTime: string): FHIRImmunizationResource =>
  ({
    resourceType: 'Immunization',
    id,
    status: 'completed',
    vaccineCode: { coding: [{ code: 'pentavalente-uuid', display: 'Pentavalente' }] },
    patient: { type: 'Patient', reference: 'Patient/patient-uuid' },
    encounter: { type: 'Encounter', reference: 'Encounter/visit-uuid' },
    occurrenceDateTime,
    protocolApplied: [{ doseNumberPositiveInt: doseNumber }],
  }) as unknown as FHIRImmunizationResource;

describe('mapFromFHIRImmunizationBundle', () => {
  it('lists the highest dose first when several doses share the same date', () => {
    const groups = mapFromFHIRImmunizationBundle([
      immunization('d1', 1, '2026-10-16T00:00:00+00:00'),
      immunization('d3', 3, '2026-10-16T00:00:00+00:00'),
      immunization('d2', 2, '2026-10-16T00:00:00+00:00'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].existingDoses.map((dose) => dose.doseNumber)).toEqual([3, 2, 1]);
  });

  it('still orders by date before dose number', () => {
    const groups = mapFromFHIRImmunizationBundle([
      immunization('d3', 3, '2026-06-16T00:00:00+00:00'),
      immunization('d1', 1, '2026-10-16T00:00:00+00:00'),
    ]);

    expect(groups[0].existingDoses.map((dose) => dose.immunizationObsUuid)).toEqual(['d1', 'd3']);
  });
});
