import { useConfig } from '@openmrs/esm-framework';
import { useContext, useMemo } from 'react';

import { type RegistrationConfig } from '../../config-schema';
import { ResourcesContext } from '../../offline.resources';
import { PatientRegistrationContext } from '../patient-registration-context';
import { getEffectiveRegistrationConfig, peruForeignPatientIdentifierTypeUuids } from '../peru-registration-config';

import { AddressField } from './address/custom-address-field.component';
import { ObsField } from './obs/obs-field.component';
import { NationalityField } from './person-attributes/nationality-field.component';
import { PersonAttributeField } from './person-attributes/person-attribute-field.component';

export interface CustomFieldProps {
  name: string;
}

export function CustomField({ name }: CustomFieldProps) {
  const config = getEffectiveRegistrationConfig(useConfig() as RegistrationConfig);
  const fieldDefinition = config.fieldDefinitions.filter((def) => def.id === name)[0];
  const { identifierTypes = [] } = useContext(ResourcesContext);
  const { values } = useContext(PatientRegistrationContext);
  const hasForeignIdentifier = useMemo(() => {
    const foreignIdentifierTypeUuids = new Set(peruForeignPatientIdentifierTypeUuids);

    return Object.values(values.identifiers ?? {}).some((identifier) => {
      const hasIdentifierValue = !!identifier.identifierValue && identifier.identifierValue !== 'auto-generated';
      if (!hasIdentifierValue) {
        return false;
      }

      if (foreignIdentifierTypeUuids.has(identifier.identifierTypeUuid)) {
        return true;
      }
      const identifierType = identifierTypes.find((type) => type.fieldName === identifier.identifierName);
      return !!identifierType && foreignIdentifierTypeUuids.has(identifierType.uuid);
    });
  }, [identifierTypes, values.identifiers]);

  if (name === 'nationality') {
    return <NationalityField fieldDefinition={fieldDefinition} />;
  }

  if (fieldDefinition.showIf?.foreignIdentifierPresent && !hasForeignIdentifier) {
    return null;
  }

  if (fieldDefinition.type === 'person attribute') {
    return <PersonAttributeField fieldDefinition={fieldDefinition} />;
  } else if (fieldDefinition.type === 'obs') {
    return <ObsField fieldDefinition={fieldDefinition} />;
  } else if (fieldDefinition.type === 'address') {
    return <AddressField fieldDefinition={fieldDefinition} />;
  } else {
    return <div>Error: Unknown field type {fieldDefinition.type}</div>;
  }
}
