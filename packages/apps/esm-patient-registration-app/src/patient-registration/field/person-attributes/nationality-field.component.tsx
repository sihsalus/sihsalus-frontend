import { InlineNotification, TextInputSkeleton } from '@carbon/react';
import classNames from 'classnames';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type FieldDefinition } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { peruDniPattern } from '../../peru-identifier-validation';
import { peruDniPatientIdentifierTypeUuid, peruNationalityConceptUuid } from '../../peru-registration-config';
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
  const nationalityWasAutoAssigned = useRef(false);
  const personAttributeTypeUuid = personAttributeType?.uuid;
  const personAttributeTypeFormat = personAttributeType?.format;
  const fieldName = personAttributeTypeUuid ? `attributes.${personAttributeTypeUuid}` : null;
  const nationalityValue = personAttributeTypeUuid ? values.attributes?.[personAttributeTypeUuid] : undefined;
  const hasDniIdentifier = useMemo(
    () =>
      Object.values(values.identifiers ?? {}).some((identifier) => {
        const identifierValue = identifier.identifierValue?.trim();
        return (
          identifier.identifierTypeUuid === peruDniPatientIdentifierTypeUuid &&
          peruDniPattern.test(identifierValue ?? '')
        );
      }),
    [values.identifiers],
  );

  useEffect(() => {
    if (!fieldName || !personAttributeTypeUuid || personAttributeTypeFormat !== 'org.openmrs.Concept') {
      return;
    }

    if (hasDniIdentifier) {
      if (!nationalityValue && !nationalityWasAutoAssigned.current) {
        nationalityWasAutoAssigned.current = true;
        setFieldValue(fieldName, peruNationalityConceptUuid);
      }
      return;
    }

    if (nationalityWasAutoAssigned.current) {
      nationalityWasAutoAssigned.current = false;
      if (nationalityValue === peruNationalityConceptUuid) {
        setFieldValue(fieldName, '');
      }
    }
  }, [
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

  return (
    <CodedPersonAttributeField
      id={fieldDefinition.id}
      personAttributeType={personAttributeType}
      answerConceptSetUuid={fieldDefinition.answerConceptSetUuid}
      label={fieldDefinition.label}
      customConceptAnswers={fieldDefinition.customConceptAnswers ?? emptyConceptAnswers}
      required={fieldDefinition.validation?.required ?? false}
      searchable={fieldDefinition.searchable ?? true}
      readOnly={hasDniIdentifier && (!nationalityValue || nationalityValue === peruNationalityConceptUuid)}
      enforceAnswerSetMembership
    />
  );
}
