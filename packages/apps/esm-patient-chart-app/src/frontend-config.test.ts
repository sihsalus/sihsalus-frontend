import frontendConfig from '../../../../config/frontend.json';

// Keep this set aligned with locations tagged `Care UPSS` in sihsalus-content.
const careUpssLocationUuids = [
  '35d2234e-129a-4c40-abb2-1ae0b2400001',
  '35d2234e-129a-4c40-abb2-1ae0b2400002',
  '35d2234e-129a-4c40-abb2-1ae0b2400003',
  '35d2234e-129a-4c40-abb2-1ae0b2400004',
  '35d2234e-129a-4c40-abb2-1ae0b2400005',
  '35d2234e-129a-4c40-abb2-1ae0b2400006',
  '35d2234e-129a-4c40-abb2-1ae0b2400007',
  '35d2234e-129a-4c40-abb2-1ae0b2400008',
  '35d2234e-129a-4c40-abb2-1ae0b2400010',
  '35d2234e-129a-4c40-abb2-1ae0b2400011',
  '35d2234e-129a-4c40-abb2-1ae0b2400013',
];

describe('SIH Salus frontend configuration', () => {
  it('restricts visit selection to the Care UPSS locations covered by eligibility rules', () => {
    const chartConfig = frontendConfig['@sihsalus/esm-patient-chart-app'];
    const eligibleLocationUuids = [
      ...new Set(chartConfig.visitTypeEligibilityRules.map(({ locationUuid }) => locationUuid)),
    ];

    expect(chartConfig.visitLocationTag).toBe('Care UPSS');
    expect(eligibleLocationUuids.sort()).toEqual(careUpssLocationUuids.sort());
  });
});
