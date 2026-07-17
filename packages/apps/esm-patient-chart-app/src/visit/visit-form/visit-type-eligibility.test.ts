import { type VisitType } from '@openmrs/esm-framework';

import { type VisitTypeEligibilityRule } from '../../config-schema';

import { filterVisitTypesByEligibility } from './visit-type-eligibility';

const visitTypes = [
  { uuid: 'general', display: 'Consulta Ambulatoria - Medicina General' },
  { uuid: 'gynecology', display: 'Consulta Ambulatoria - Ginecología' },
  { uuid: 'emergency', display: 'Emergencia - Medicina' },
] as Array<VisitType>;

const rules: Array<VisitTypeEligibilityRule> = [
  { locationUuid: 'outpatient', visitTypeUuids: ['general'] },
  { locationUuid: 'outpatient', visitTypeUuids: ['gynecology'], allowedGenders: ['F'] },
  { locationUuid: 'emergency', visitTypeUuids: ['emergency'] },
];

describe('filterVisitTypesByEligibility', () => {
  it('only returns visit types configured for the selected location', () => {
    expect(filterVisitTypesByEligibility(visitTypes, rules, 'emergency', 'M').map(({ uuid }) => uuid)).toEqual([
      'emergency',
    ]);
  });

  it('excludes gender-restricted visit types for an incompatible patient', () => {
    expect(filterVisitTypesByEligibility(visitTypes, rules, 'outpatient', 'male').map(({ uuid }) => uuid)).toEqual([
      'general',
    ]);
  });

  it('includes gender-restricted visit types for a compatible patient', () => {
    expect(filterVisitTypesByEligibility(visitTypes, rules, 'outpatient', 'F').map(({ uuid }) => uuid)).toEqual([
      'general',
      'gynecology',
    ]);
  });

  it('does not restrict locations that have no configured rules', () => {
    expect(filterVisitTypesByEligibility(visitTypes, rules, 'new-location', 'M')).toEqual(visitTypes);
  });
});
