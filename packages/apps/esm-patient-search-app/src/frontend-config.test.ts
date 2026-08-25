import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import frontendConfig from '../../../../config/frontend.json';
import { configSchema, type PatientSearchConfig } from './config-schema';

const neighborhoodAttributeTypeUuid = '4a182c6e-9a19-4db8-8042-4bbf3b4308c2';
const neighborhoodConceptSetUuid = '0fd3e744-6d2c-4cb3-9b7e-1f88899635d9';

describe('SIH Salus frontend configuration', () => {
  it('keeps built-in search defaults when only person attributes are configured', () => {
    const defaults = getDefaultsFromConfigSchema<PatientSearchConfig>(configSchema);

    expect(configSchema.search.searchFilterFields).not.toHaveProperty('_default');
    expect(configSchema.search.searchFilterFields.age).not.toHaveProperty('_type');
    expect(defaults.search.searchFilterFields).toMatchObject({
      activeVisit: { enabled: true },
      age: { enabled: true, min: 0, max: 140 },
      gender: { enabled: true },
      postcode: { enabled: false },
    });
  });

  it('adds the coded Barrio filter without replacing existing search filters', () => {
    const defaults = getDefaultsFromConfigSchema<PatientSearchConfig>(configSchema);
    const configuredAttributes =
      frontendConfig['@sihsalus/esm-patient-search-app'].search.searchFilterFields.personAttributes;

    expect(configuredAttributes).toEqual([
      ...defaults.search.searchFilterFields.personAttributes,
      {
        attributeTypeUuid: neighborhoodAttributeTypeUuid,
        answerConceptSetUuid: neighborhoodConceptSetUuid,
      },
    ]);
    expect(
      configuredAttributes.filter(({ attributeTypeUuid }) => attributeTypeUuid === neighborhoodAttributeTypeUuid),
    ).toHaveLength(1);
    expect(
      configuredAttributes.find(({ attributeTypeUuid }) => attributeTypeUuid === neighborhoodAttributeTypeUuid),
    ).not.toHaveProperty('placeholder');
  });
});
