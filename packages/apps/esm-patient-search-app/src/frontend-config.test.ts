import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import frontendConfig from '../../../../config/frontend.json';
import { configSchema, type PatientSearchConfig } from './config-schema';

const neighborhoodAttributeTypeUuid = '4a182c6e-9a19-4db8-8042-4bbf3b4308c2';
const neighborhoodConceptSetUuid = '0fd3e744-6d2c-4cb3-9b7e-1f88899635d9';

describe('SIH Salus frontend configuration', () => {
  it('adds the coded Barrio filter without replacing existing search filters', () => {
    const defaults = getDefaultsFromConfigSchema<PatientSearchConfig>(configSchema);
    const configuredAttributes =
      frontendConfig['@sihsalus/esm-patient-search-app'].search.searchFilterFields.personAttributes;

    expect(configuredAttributes).toEqual([
      ...defaults.search.searchFilterFields.personAttributes,
      {
        attributeTypeUuid: neighborhoodAttributeTypeUuid,
        answerConceptSetUuid: neighborhoodConceptSetUuid,
        placeholder: 'Seleccione un barrio',
      },
    ]);
    expect(
      configuredAttributes.filter(({ attributeTypeUuid }) => attributeTypeUuid === neighborhoodAttributeTypeUuid),
    ).toHaveLength(1);
  });
});
