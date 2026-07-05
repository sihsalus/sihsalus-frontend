import { useConfig } from '@openmrs/esm-framework';

import { type RegistrationConfig } from '../../../config-schema';
import { getEffectiveRegistrationConfig } from '../../peru-registration-config';
import { PersonAttributeField } from '../person-attributes/person-attribute-field.component';

export function PhoneField() {
  const config = getEffectiveRegistrationConfig(useConfig<RegistrationConfig>());

  const fieldDefinition = {
    id: 'phone',
    type: 'person attribute',
    uuid: config.fieldConfigurations.phone.personAttributeUuid,
    placeholder: config.fieldConfigurations.phone.placeholder,
    validation: config.fieldConfigurations.phone.validation,
    showHeading: false,
  };
  return <PersonAttributeField fieldDefinition={fieldDefinition} />;
}
