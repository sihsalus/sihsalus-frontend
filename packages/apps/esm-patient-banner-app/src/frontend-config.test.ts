import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import frontendConfig from '../../../../config/frontend.json';
import { type ConfigObject, configSchema } from './config-schema';

const neighborhoodAttributeTypeUuid = '4a182c6e-9a19-4db8-8042-4bbf3b4308c2';

describe('SIH Salus frontend configuration', () => {
  it('adds Barrio to the banner without replacing existing attribute defaults', () => {
    const defaults = getDefaultsFromConfigSchema<ConfigObject>(configSchema);
    const configuredAttributeTypes = frontendConfig['@sihsalus/esm-patient-banner-app'].additionalAttributeTypes;

    expect(configuredAttributeTypes).toEqual([...defaults.additionalAttributeTypes, neighborhoodAttributeTypeUuid]);
    expect(configuredAttributeTypes.filter((uuid) => uuid === neighborhoodAttributeTypeUuid)).toHaveLength(1);
  });
});
