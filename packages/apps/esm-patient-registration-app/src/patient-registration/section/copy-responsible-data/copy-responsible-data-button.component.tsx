import { Button, InlineLoading, InlineNotification, Select, SelectItem } from '@carbon/react';
import { Copy } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { fetchPersonRegistrationCopyData } from '../../patient-registration.resource';
import {
  type AddressProperties,
  type PatientAddress,
  type PersonAttributeResponse,
  type RelationshipValue,
} from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { birthAddressMarker, birthAddressMarkerField } from '../../patient-registration-utils';
import {
  getEffectiveRegistrationConfig,
  peruEmailAttributeTypeUuid,
  peruFinancerDependentAttributeTypeUuids,
  peruInsuranceTypeAttributeTypeUuid,
  peruMobilePhoneAttributeTypeUuid,
  replacePeruInsuranceCoverageInForm,
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
    button: 'Copiar residencia como lugar de nacimiento',
    success: 'Lugar de nacimiento copiado desde la residencia del paciente',
    empty: 'Primero registre la residencia del paciente',
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

function getRelationshipSourceKey(relationship: RelationshipValue, index: number) {
  return relationship.relatedPersonUuid || relationship.clientId || `pending-responsible-${index}`;
}

function getPendingResponsibleAddress(relationship: RelationshipValue): PatientAddress | undefined {
  const address = relationship.newPerson?.address;
  if (typeof address === 'string') {
    return address.trim() ? { address1: address.trim() } : undefined;
  }
  return address;
}

export function CopyResponsibleDataButton({ mode }: CopyResponsibleDataButtonProps) {
  const { t } = useTranslation(moduleName);
  const configuredConfig = useConfig<RegistrationConfig>();
  const config = getEffectiveRegistrationConfig(configuredConfig);
  const registrationContext = useContext(PatientRegistrationContext);
  const [status, setStatus] = useState<'idle' | 'copying' | 'success' | 'warning' | 'error'>('idle');
  const [selectedResponsiblePersonUuid, setSelectedResponsiblePersonUuid] = useState('');
  const copyAbortControllerRef = useRef<AbortController | null>(null);
  const isMinor = registrationContext?.values ? isMinorPatient(registrationContext.values) : false;

  const responsibleSources = useMemo(() => {
    const relationships = registrationContext?.values?.relationships ?? [];
    const candidates = relationships
      .map((relationship, index) => ({ key: getRelationshipSourceKey(relationship, index), relationship }))
      .filter(
        ({ relationship }) =>
          relationship.action !== 'DELETE' &&
          (!!relationship.relatedPersonUuid || !!relationship.newPerson) &&
          (relationship.isCompanion ||
            config.relationshipOptions?.minorResponsibleRelationshipTypes?.includes(relationship.relationshipType)),
      );
    const primaryResponsibleSources = candidates.filter(({ relationship }) => relationship.isCompanion);
    return primaryResponsibleSources.length > 0 ? primaryResponsibleSources : candidates;
  }, [config.relationshipOptions?.minorResponsibleRelationshipTypes, registrationContext?.values?.relationships]);
  const responsibleSource =
    responsibleSources.length === 1
      ? responsibleSources[0]
      : responsibleSources.find(({ key }) => key === selectedResponsiblePersonUuid);
  const responsiblePersonUuid = responsibleSource?.relationship.relatedPersonUuid;

  const abortPendingCopy = useCallback(() => {
    copyAbortControllerRef.current?.abort();
    copyAbortControllerRef.current = null;
  }, []);

  useEffect(() => {
    setStatus('idle');
    if (mode === 'birthAddress' || responsibleSource) {
      return abortPendingCopy;
    }
  }, [abortPendingCopy, mode, responsibleSource]);

  const copyAddress = (
    fieldPrefix: 'address' | 'birthAddress',
    address?: PatientAddress,
    replaceEmptyFields = false,
  ) => {
    let copied = 0;
    const currentAddress = registrationContext?.values?.[fieldPrefix] ?? {};
    const copiedAddress: Partial<Record<AddressProperties, string>> = {};

    copyableAddressFields.forEach((field) => {
      const value = address?.[field]?.trim() ?? '';
      if (value || replaceEmptyFields) {
        copiedAddress[field] = value;
        if (value) {
          // Copying is a programmatic fill, not a user blur. Keeping these fields
          // untouched prevents stale required errors from being shown while the
          // complete address hierarchy is applied.
          registrationContext?.setFieldTouched(`${fieldPrefix}.${field}`, false, false);
        }
      }
      if (value) {
        copied += 1;
      }
    });

    if (copied > 0) {
      registrationContext?.setFieldValue(
        fieldPrefix,
        replaceEmptyFields ? copiedAddress : { ...currentAddress, ...copiedAddress },
        false,
      );
    }
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
    if (mode === 'birthAddress') {
      const copied = copyAddress('birthAddress', registrationContext?.values?.address, true);
      setStatus(copied > 0 ? 'success' : 'warning');
      return;
    }

    if (!responsibleSource) {
      setStatus('warning');
      return;
    }

    if (responsibleSource.relationship.newPerson && !responsiblePersonUuid) {
      const responsiblePerson = responsibleSource.relationship.newPerson;
      let copied = 0;
      if (mode === 'residenceContact') {
        copied += copyAddress('address', getPendingResponsibleAddress(responsibleSource.relationship));
        if (responsiblePerson.phone) {
          registrationContext?.setFieldValue(
            `attributes.${config.fieldConfigurations.phone.personAttributeUuid}`,
            responsiblePerson.phone,
            false,
          );
          registrationContext?.setFieldTouched(
            `attributes.${config.fieldConfigurations.phone.personAttributeUuid}`,
            true,
            false,
          );
          copied += 1;
        }
        if (responsiblePerson.mobilePhone) {
          registrationContext?.setFieldValue(
            `attributes.${peruMobilePhoneAttributeTypeUuid}`,
            responsiblePerson.mobilePhone,
            false,
          );
          registrationContext?.setFieldTouched(`attributes.${peruMobilePhoneAttributeTypeUuid}`, true, false);
          copied += 1;
        }
      }
      setStatus(copied > 0 ? 'success' : 'warning');
      return;
    }

    if (!responsiblePersonUuid) {
      setStatus('warning');
      return;
    }

    abortPendingCopy();
    const abortController = new AbortController();
    copyAbortControllerRef.current = abortController;
    setStatus('copying');
    try {
      const person = await fetchPersonRegistrationCopyData(responsiblePersonUuid, abortController.signal);
      if (abortController.signal.aborted || copyAbortControllerRef.current !== abortController) {
        return;
      }

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

      if (mode === 'insurance') {
        const insuranceAttributes = Object.fromEntries(
          [peruInsuranceTypeAttributeTypeUuid, ...peruFinancerDependentAttributeTypeUuids].map((attributeTypeUuid) => [
            attributeTypeUuid,
            getAttributeValue(attributes, attributeTypeUuid),
          ]),
        );
        if (registrationContext) {
          copied += replacePeruInsuranceCoverageInForm(
            insuranceAttributes,
            registrationContext.setFieldValue,
            registrationContext.setFieldTouched,
          );
        }
      }

      setStatus(copied > 0 ? 'success' : 'warning');
    } catch (error) {
      if (abortController.signal.aborted || copyAbortControllerRef.current !== abortController) {
        return;
      }

      console.error('Could not copy responsible person data', error);
      setStatus('error');
    } finally {
      if (copyAbortControllerRef.current === abortController) {
        copyAbortControllerRef.current = null;
      }
    }
  };

  const statusText = statusTextByMode[mode];
  const disabled = status === 'copying';

  if (!isMinor && mode !== 'birthAddress') {
    return null;
  }

  return (
    <div className={styles.copyAction}>
      {mode !== 'birthAddress' && responsibleSources.length > 1 ? (
        <Select
          id={`copy-responsible-source-${mode}`}
          labelText={t('copyResponsibleData.sourceLabel', 'Responsable de origen')}
          value={selectedResponsiblePersonUuid}
          onChange={(event) => {
            abortPendingCopy();
            setSelectedResponsiblePersonUuid(event.target.value);
            setStatus('idle');
          }}
        >
          <SelectItem value="" text={t('copyResponsibleData.sourcePlaceholder', 'Seleccione un responsable')} />
          {responsibleSources.map(({ key, relationship }) => (
            <SelectItem
              key={key}
              value={key}
              text={
                relationship.relatedPersonName ??
                relationship.newPerson?.givenName ??
                relationship.relatedPersonUuid ??
                key
              }
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
            mode === 'birthAddress' || responsibleSource
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
