import { mapFromFHIRImmunizationBundle } from './immunization-mapper';
import type { FHIRImmunizationResource } from '../types/fhir-immunization-domain';

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
