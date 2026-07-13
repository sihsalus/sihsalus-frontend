import { Button, InlineLoading, InlineNotification, Select, SelectItem } from '@carbon/react';
import { Copy } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { fetchPersonRegistrationCopyData } from '../../patient-registration.resource';
import {
  type AddressProperties,
  type PatientAddress,
  type PersonAttributeResponse,
} from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { birthAddressMarker, birthAddressMarkerField } from '../../patient-registration-utils';
import {
  getEffectiveRegistrationConfig,
  peruEmailAttributeTypeUuid,
  peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
  peruInsuranceAccreditationStatusAttributeTypeUuid,
  peruInsuranceCodeAttributeTypeUuid,
  peruInsuranceTypeAttributeTypeUuid,
  peruMobilePhoneAttributeTypeUuid,
} from '../../peru-registration-config';
import { isMinorPatient } from '../../validation/patient-registration-validation';

import styles from './copy-responsible-data-button.scss';

type CopyResponsibleDataMode = 'residenceContact' | 'birthAddress' | 'insurance';

interface CopyResponsibleDataButtonProps {
  mode: CopyResponsibleDataMode;
}

const copyableAddressFields: Array<AddressProperties> = [
  'country',
  'stateProvince',
  'countyDistrict',
  'cityVillage',
  'address1',
  'address2',
  'address3',
  'address4',
  'address5',
  'address6',
  'address7',
  'address8',
  'address9',
  'address10',
  'address11',
  'address12',
  'address13',
  'address14',
  'postalCode',
];

const statusTextByMode: Record<CopyResponsibleDataMode, { button: string; success: string; empty: string }> = {
  residenceContact: {
    button: 'Copiar residencia y contacto del responsable',
    success: 'Residencia y contacto copiados del responsable',
    empty: 'El responsable no tiene residencia o contacto registrado',
  },
  birthAddress: {
    button: 'Copiar residencia del responsable como lugar de nacimiento',
    success: 'Lugar de nacimiento copiado desde la residencia del responsable',
    empty: 'El responsable no tiene residencia registrada',
  },
  insurance: {
    button: 'Copiar seguro del responsable',
    success: 'Seguro copiado del responsable',
    empty: 'El responsable no tiene seguro registrado',
  },
};

function getAttributeValue(attributes: Array<PersonAttributeResponse> = [], attributeTypeUuid: string) {
  const value = attributes.find((attribute) => attribute.attributeType?.uuid === attributeTypeUuid)?.value;
  return typeof value === 'string' ? value : (value?.uuid ?? value?.display ?? '');
}

function getResidenceAddress(addresses: Array<PatientAddress> = []) {
  const nonBirthAddresses = addresses.filter((address) => address[birthAddressMarkerField] !== birthAddressMarker);
  return nonBirthAddresses.find((address) => address.preferred) ?? nonBirthAddresses[0] ?? addresses[0];
}

export function CopyResponsibleDataButton({ mode }: CopyResponsibleDataButtonProps) {
  const { t } = useTranslation(moduleName);
  const configuredConfig = useConfig<RegistrationConfig>();
  const config = getEffectiveRegistrationConfig(configuredConfig);
  const registrationContext = useContext(PatientRegistrationContext);
  const [status, setStatus] = useState<'idle' | 'copying' | 'success' | 'warning' | 'error'>('idle');
  const [selectedResponsiblePersonUuid, setSelectedResponsiblePersonUuid] = useState('');
  const isMinor = registrationContext?.values ? isMinorPatient(registrationContext.values) : false;

  const responsibleRelationships = useMemo(() => {
    const relationships = registrationContext?.values?.relationships ?? [];
    return relationships.filter(
      (relationship) =>
        relationship.action !== 'DELETE' &&
        !!relationship.relatedPersonUuid &&
        config.relationshipOptions?.minorResponsibleRelationshipTypes?.includes(relationship.relationshipType),
    );
  }, [config.relationshipOptions?.minorResponsibleRelationshipTypes, registrationContext?.values?.relationships]);
  const responsiblePersonUuid =
    responsibleRelationships.length === 1
      ? responsibleRelationships[0].relatedPersonUuid
      : responsibleRelationships.some(
            (relationship) => relationship.relatedPersonUuid === selectedResponsiblePersonUuid,
          )
        ? selectedResponsiblePersonUuid
        : '';

  const copyAddress = (fieldPrefix: 'address' | 'birthAddress', address?: PatientAddress) => {
    let copied = 0;
    copyableAddressFields.forEach((field) => {
      const value = address?.[field]?.trim();
      if (value) {
        registrationContext?.setFieldValue(`${fieldPrefix}.${field}`, value, false);
        registrationContext?.setFieldTouched(`${fieldPrefix}.${field}`, true, false);
        copied += 1;
      }
    });
    return copied;
  };

  const copyAttributes = (attributes: Array<PersonAttributeResponse>, attributeTypeUuids: Array<string>) => {
    let copied = 0;
    attributeTypeUuids.forEach((attributeTypeUuid) => {
      const value = getAttributeValue(attributes, attributeTypeUuid);
      if (value) {
        registrationContext?.setFieldValue(`attributes.${attributeTypeUuid}`, value, false);
        registrationContext?.setFieldTouched(`attributes.${attributeTypeUuid}`, true, false);
        copied += 1;
      }
    });
    return copied;
  };

  const handleCopy = async () => {
    if (!responsiblePersonUuid) {
      setStatus('warning');
      return;
    }

    setStatus('copying');
    try {
      const person = await fetchPersonRegistrationCopyData(responsiblePersonUuid);
      const residenceAddress = getResidenceAddress(person.addresses);
      const attributes = person.attributes ?? [];
      let copied = 0;

      if (mode === 'residenceContact') {
        copied += copyAddress('address', residenceAddress);
        copied += copyAttributes(attributes, [
          config.fieldConfigurations.phone.personAttributeUuid,
          peruMobilePhoneAttributeTypeUuid,
          peruEmailAttributeTypeUuid,
        ]);
      }

      if (mode === 'birthAddress') {
        copied += copyAddress('birthAddress', residenceAddress);
      }

      if (mode === 'insurance') {
        copied += copyAttributes(attributes, [
          peruInsuranceTypeAttributeTypeUuid,
          peruInsuranceCodeAttributeTypeUuid,
          peruInsuranceAccreditationStatusAttributeTypeUuid,
          peruInsuranceAccreditationCheckedAtAttributeTypeUuid,
        ]);
      }

      setStatus(copied > 0 ? 'success' : 'warning');
    } catch (error) {
      console.error('Could not copy responsible person data', error);
      setStatus('error');
    }
  };

  const statusText = statusTextByMode[mode];
  const disabled = status === 'copying';

  if (!isMinor) {
    return null;
  }

  return (
    <div className={styles.copyAction}>
      {responsibleRelationships.length > 1 ? (
        <Select
          id={`copy-responsible-source-${mode}`}
          labelText={t('copyResponsibleData.sourceLabel', 'Responsable de origen')}
          value={selectedResponsiblePersonUuid}
          onChange={(event) => {
            setSelectedResponsiblePersonUuid(event.target.value);
            setStatus('idle');
          }}
        >
          <SelectItem value="" text={t('copyResponsibleData.sourcePlaceholder', 'Seleccione un responsable')} />
          {responsibleRelationships.map((relationship) => (
            <SelectItem
              key={relationship.relatedPersonUuid}
              value={relationship.relatedPersonUuid}
              text={relationship.relatedPersonName ?? relationship.relatedPersonUuid}
            />
          ))}
        </Select>
      ) : null}
      <Button type="button" kind="tertiary" size="sm" renderIcon={Copy} onClick={handleCopy} disabled={disabled}>
        {t(`copyResponsibleData.${mode}.button`, statusText.button)}
      </Button>
      {status === 'copying' ? (
        <InlineLoading description={t('copyingResponsibleData', 'Copiando datos del responsable...')} />
      ) : null}
      {status === 'success' ? (
        <InlineNotification
          className={styles.copyFeedback}
          kind="success"
          lowContrast
          title={t(`copyResponsibleData.${mode}.success`, statusText.success)}
        />
      ) : null}
      {status === 'warning' ? (
        <InlineNotification
          className={styles.copyFeedback}
          kind="warning"
          lowContrast
          title={
            responsiblePersonUuid
              ? t(`copyResponsibleData.${mode}.empty`, statusText.empty)
              : t('copyResponsibleData.noResponsible', 'Seleccione un responsable antes de copiar datos')
          }
        />
      ) : null}
      {status === 'error' ? (
        <InlineNotification
          className={styles.copyFeedback}
          kind="error"
          lowContrast
          title={t('copyResponsibleData.error', 'No se pudieron copiar los datos del responsable')}
        />
      ) : null}
    </div>
  );
}
