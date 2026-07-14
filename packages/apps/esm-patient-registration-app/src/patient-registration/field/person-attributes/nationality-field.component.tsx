import { InlineLoading, InlineNotification, TextInputSkeleton } from '@carbon/react';
import { userHasAccess, useConfig, useSession } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type FieldDefinition, type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { peruDniPattern } from '../../peru-identifier-validation';
import {
  getEffectiveRegistrationConfig,
  peruDniPatientIdentifierTypeUuid,
  peruNationalityConceptUuid,
} from '../../peru-registration-config';
import { useConceptAnswers } from '../field.resource';
import styles from '../field.scss';
import { CodedPersonAttributeField } from './coded-person-attribute-field.component';
import { usePersonAttributeType } from './person-attributes.resource';

interface NationalityFieldProps {
  fieldDefinition: FieldDefinition;
}

const emptyConceptAnswers: Array<{ uuid: string; label?: string }> = [];

export function NationalityField({ fieldDefinition }: NationalityFieldProps) {
  const { data: personAttributeType, isLoading, error } = usePersonAttributeType(fieldDefinition.uuid);
  const { setFieldValue, values } = useContext(PatientRegistrationContext);
  const { t } = useTranslation(moduleName);
  const { user } = useSession();
  const unidentifiedPatientAttributeTypeUuid = getEffectiveRegistrationConfig(useConfig<RegistrationConfig>())
    .fieldConfigurations.name.unidentifiedPatientAttributeTypeUuid;
  const isUnidentifiedPatient =
    Boolean(unidentifiedPatientAttributeTypeUuid) &&
    values.attributes?.[unidentifiedPatientAttributeTypeUuid] === 'true';
  const nationalityWasAutoAssigned = useRef(false);
  const personAttributeTypeUuid = personAttributeType?.uuid;
  const personAttributeTypeFormat = personAttributeType?.format;
  const fieldName = personAttributeTypeUuid ? `attributes.${personAttributeTypeUuid}` : null;
  const nationalityValue = personAttributeTypeUuid ? values.attributes?.[personAttributeTypeUuid] : undefined;
  const hasDniIdentifier = useMemo(
    () =>
      !isUnidentifiedPatient &&
      Object.values(values.identifiers ?? {}).some((identifier) => {
        const identifierValue = identifier.identifierValue?.trim();
        return (
          identifier.identifierTypeUuid === peruDniPatientIdentifierTypeUuid &&
          peruDniPattern.test(identifierValue ?? '')
        );
      }),
    [isUnidentifiedPatient, values.identifiers],
  );
  const customConceptAnswers = fieldDefinition.customConceptAnswers ?? emptyConceptAnswers;
  const canGetConcepts = userHasAccess('Get Concepts', user);
  const shouldLoadNationalityAnswers =
    customConceptAnswers.length === 0 && canGetConcepts && Boolean(fieldDefinition.answerConceptSetUuid);
  const nationalityAnswersResponse = useConceptAnswers(
    shouldLoadNationalityAnswers ? fieldDefinition.answerConceptSetUuid : '',
  );
  const {
    data: nationalityAnswers,
    isLoading: isLoadingNationalityAnswers,
    error: nationalityAnswersError,
  } = nationalityAnswersResponse ?? {};
  const canAutoAssignPeru =
    !isLoadingNationalityAnswers &&
    !nationalityAnswersError &&
    (customConceptAnswers.length > 0 ? customConceptAnswers : (nationalityAnswers ?? [])).some(
      (answer) => answer.uuid === peruNationalityConceptUuid,
    );

  useEffect(() => {
    if (!fieldName || !personAttributeTypeUuid || personAttributeTypeFormat !== 'org.openmrs.Concept') {
      return;
    }

    if (hasDniIdentifier) {
      if (canAutoAssignPeru && !nationalityValue && !nationalityWasAutoAssigned.current) {
        nationalityWasAutoAssigned.current = true;
        setFieldValue(fieldName, peruNationalityConceptUuid, false);
      }
      return;
    }

    if (nationalityWasAutoAssigned.current) {
      nationalityWasAutoAssigned.current = false;
      if (nationalityValue === peruNationalityConceptUuid) {
        setFieldValue(fieldName, '', false);
      }
    }
  }, [
    canAutoAssignPeru,
    fieldName,
    hasDniIdentifier,
    nationalityValue,
    personAttributeTypeFormat,
    personAttributeTypeUuid,
    setFieldValue,
  ]);

  if (isLoading) {
    return (
      <div className={classNames(styles.customField, styles.halfWidthInDesktopView)}>
        <TextInputSkeleton />
      </div>
    );
  }

  if (error || !personAttributeType || !fieldName) {
    return (
      <InlineNotification kind="error" title={t('error', 'Error')}>
        {t('unableToFetch', 'Unable to fetch person attribute type - {{personattributetype}}', {
          personattributetype: fieldDefinition?.label ?? fieldDefinition?.id,
        })}
      </InlineNotification>
    );
  }

  if (personAttributeType.format !== 'org.openmrs.Concept') {
    return (
      <InlineNotification kind="error" title={t('invalidConfiguration', 'Invalid configuration')}>
        {t(
          'nationalityAttributeMustBeCoded',
          'The nationality person attribute must use the org.openmrs.Concept format.',
        )}
      </InlineNotification>
    );
  }

  if (hasDniIdentifier && !nationalityValue && isLoadingNationalityAnswers) {
    return <InlineLoading description={t('nationalityVerificationPending', 'Validating nationality catalog...')} />;
  }

  if (hasDniIdentifier && !nationalityValue && !canAutoAssignPeru) {
    return (
      <InlineNotification
        hideCloseButton
        kind="error"
        lowContrast
        title={t('nationalityVerificationUnavailableTitle', 'No se pudo validar la nacionalidad')}
        subtitle={t(
          'nationalityVerificationUnavailableSubtitle',
          'No se puede registrar un paciente con DNI hasta verificar el concepto Perú en el catálogo. Contacte al administrador.',
        )}
      />
    );
  }

  return (
    <CodedPersonAttributeField
      id={fieldDefinition.id}
      personAttributeType={personAttributeType}
      answerConceptSetUuid={fieldDefinition.answerConceptSetUuid}
      label={fieldDefinition.label}
      customConceptAnswers={fieldDefinition.customConceptAnswers ?? emptyConceptAnswers}
      required={fieldDefinition.validation?.required ?? false}
      searchable={fieldDefinition.searchable ?? true}
      readOnly={
        canAutoAssignPeru && hasDniIdentifier && (!nationalityValue || nationalityValue === peruNationalityConceptUuid)
      }
      enforceAnswerSetMembership
    />
  );
}
