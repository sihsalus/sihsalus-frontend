import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';

import frontendConfig from '../../../../config/frontend.json';
import { esmPatientRegistrationSchema, type RegistrationConfig } from './config-schema';
import { getEffectiveRegistrationConfig } from './patient-registration/peru-registration-config';

const neighborhoodAttributeTypeUuid = '4a182c6e-9a19-4db8-8042-4bbf3b4308c2';
const neighborhoodConceptSetUuid = '0fd3e744-6d2c-4cb3-9b7e-1f88899635d9';

describe('SIH Salus frontend configuration', () => {
  it('adds the coded Barrio field to contact without carrying unrelated content overrides', () => {
    const runtimeOverride = frontendConfig['@sihsalus/esm-patient-registration-app'];
    const effectiveConfig = getEffectiveRegistrationConfig({
      ...getDefaultsFromConfigSchema<RegistrationConfig>(esmPatientRegistrationSchema),
      ...runtimeOverride,
    } as RegistrationConfig);

    expect(runtimeOverride).not.toHaveProperty('hiddenPatientIdentifierTypeUuids');
    expect(effectiveConfig.sectionDefinitions.find(({ id }) => id === 'contact')?.fields).toEqual([
      'address',
      'birthAddress',
      'phone',
      'mobilePhone',
      'email',
      'neighborhood',
    ]);
    expect(effectiveConfig.fieldDefinitions.find(({ id }) => id === 'neighborhood')).toMatchObject({
      type: 'person attribute',
      uuid: neighborhoodAttributeTypeUuid,
      answerConceptSetUuid: neighborhoodConceptSetUuid,
      codedInputType: 'select',
      searchable: true,
      validation: { required: false },
    });
    expect(effectiveConfig.fieldDefinitions.find(({ id }) => id === 'neighborhood')).not.toHaveProperty('label');
  });
});
