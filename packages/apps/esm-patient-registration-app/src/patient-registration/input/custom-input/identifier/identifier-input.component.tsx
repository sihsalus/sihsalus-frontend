import { Button } from '@carbon/react';
import { Edit, Reset, TrashCan } from '@carbon/react/icons';
import { showModal, UserHasAccess, useConfig } from '@openmrs/esm-framework';
import { useField } from 'formik';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RegistrationConfig } from '../../../../config-schema';
import { moduleName } from '../../../../constants';
import { ResourcesContext } from '../../../../offline.resources';
import {
  countIdentityDocumentIdentifiers,
  deleteIdentifierType,
  isIdentityDocumentIdentifier,
  setIdentifierSource,
} from '../../../field/id/id-field.component';
import { type PatientIdentifierValue } from '../../../patient-registration.types';
import { PatientRegistrationContext } from '../../../patient-registration-context';
import { getPeruIdentifierRule } from '../../../peru-identifier-validation';
import { getEffectiveRegistrationConfig } from '../../../peru-registration-config';
import { Input } from '../../basic-input/input/input.component';
import styles from '../../input.scss';
import { shouldBlockPatientIdentifierInOfflineMode } from './utils';

interface IdentifierInputProps {
  patientIdentifier: PatientIdentifierValue;
  fieldName: string;
}

const IdentifierInput: React.FC<IdentifierInputProps> = ({ patientIdentifier, fieldName }) => {
  const { t } = useTranslation(moduleName);
  const { defaultPatientIdentifierTypes } = getEffectiveRegistrationConfig(useConfig() as RegistrationConfig);
  const { identifierTypes } = useContext(ResourcesContext);
  const { isOffline, values, setFieldValue } = useContext(PatientRegistrationContext);
  const identifierType = useMemo(
    () => identifierTypes.find((identifierType) => identifierType.uuid === patientIdentifier.identifierTypeUuid),
    [patientIdentifier, identifierTypes],
  );
  const { autoGeneration, initialValue, identifierValue, identifierName, required, selectedSource } = patientIdentifier;
  const manualEntryEnabled = selectedSource?.autoGenerationOption?.manualEntryEnabled;
  const requiredForRegistration =
    required || defaultPatientIdentifierTypes?.includes(patientIdentifier.identifierTypeUuid);
  const [hideInputField, setHideInputField] = useState(
    autoGeneration || (!requiredForRegistration && initialValue === identifierValue),
  );
  const name = `identifiers.${fieldName}.identifierValue`;
  const [identifierField, identifierFieldMeta] = useField(name);
  const identifierRule = getPeruIdentifierRule(identifierType, patientIdentifier);

  const disabled = isOffline && shouldBlockPatientIdentifierInOfflineMode(identifierType);

  const defaultPatientIdentifierTypesMap = useMemo(() => {
    const map = {};
    defaultPatientIdentifierTypes?.forEach((typeUuid) => {
      map[typeUuid] = true;
    });
    return map;
  }, [defaultPatientIdentifierTypes]);

  const handleReset = useCallback(() => {
    setHideInputField(true);
    setFieldValue(`identifiers.${fieldName}`, {
      ...patientIdentifier,
      identifierValue: initialValue,
      selectedSource,
      autoGeneration,
    } as PatientIdentifierValue);
  }, [fieldName, initialValue, patientIdentifier, selectedSource, autoGeneration, setFieldValue]);

  const handleEdit = () => {
    setHideInputField(false);
    setFieldValue(`identifiers.${fieldName}`, {
      ...patientIdentifier,
      ...setIdentifierSource(identifierType?.identifierSources?.[0], initialValue, initialValue),
      ...(autoGeneration && manualEntryEnabled && { identifierValue: initialValue ?? '' }),
    });
  };

  const handleIdentifierChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = identifierRule ? identifierRule.sanitize(event.target.value) : event.target.value;
      setFieldValue(name, value);
    },
    [identifierRule, name, setFieldValue],
  );
  const handleIdentifierKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!identifierRule || event.key.length !== 1) {
        return;
      }

      const isValidKey =
        identifierRule.inputMode === 'numeric' ? /^\d$/.test(event.key) : /^[a-zA-Z0-9]$/.test(event.key);

      if (!isValidKey) {
        event.preventDefault();
      }
    },
    [identifierRule],
  );

  const handleDelete = () => {
    /*
    If there is an initialValue to the identifier, a confirmation modal seeking
    confirmation to delete the identifier should be shown, else in the other case,
    we can directly delete the identifier.
    */

    if (initialValue) {
      const confirmDeleteIdentifierModal = showModal('delete-identifier-confirmation-modal', {
        deleteIdentifier: (deleteIdentifier) => {
          if (deleteIdentifier) {
            setFieldValue('identifiers', deleteIdentifierType(values.identifiers, fieldName, identifierTypes));
          }
          confirmDeleteIdentifierModal();
        },
        identifierName,
        initialValue,
      });
    } else {
      setFieldValue('identifiers', deleteIdentifierType(values.identifiers, fieldName, identifierTypes));
    }
  };

  const showEditButton = !requiredForRegistration && hideInputField && (!!initialValue || manualEntryEnabled);
  const showResetButton =
    (!!initialValue && initialValue !== identifierValue) || (!hideInputField && manualEntryEnabled);
  return (
    <div className={styles.IDInput}>
      {!hideInputField ? (
        <Input
          id={name}
          labelText={identifierName}
          name={name}
          disabled={disabled}
          required={requiredForRegistration}
          helperText={identifierRule ? t(identifierRule.helperKey, identifierRule.helper) : undefined}
          inputMode={identifierRule?.inputMode}
          maxLength={identifierRule?.maxLength}
          invalid={!!(identifierFieldMeta.touched && identifierFieldMeta.error)}
          invalidText={identifierFieldMeta.error && t(identifierFieldMeta.error)}
          // t('identifierValueRequired', 'Identifier value is required')
          {...identifierField}
          onChange={handleIdentifierChange}
          onKeyDown={handleIdentifierKeyDown}
        />
      ) : (
        <div className={styles.textID}>
          <p
            data-testid="identifier-label"
            className={`${styles.label} ${requiredForRegistration ? styles.requiredInlineLabel : ''}`}
          >
            {requiredForRegistration ? identifierName : `${t('optionalIdentifierLabel', { identifierName })}`}
          </p>
          <p data-testid="identifier-placeholder" className={styles.bodyShort02}>
            {autoGeneration ? t('autoGeneratedPlaceholderText', 'Auto-generated') : identifierValue}
          </p>
          <input data-testid="identifier-input" type="hidden" {...identifierField} disabled />
          {/* This is added for any error descriptions */}
          {!!(identifierFieldMeta.touched && identifierFieldMeta.error) && (
            <span className={styles.dangerLabel01}>{identifierFieldMeta.error && t(identifierFieldMeta.error)}</span>
          )}
        </div>
      )}
      <div className={styles.actionButtonContainer}>
        {showEditButton && (
          <UserHasAccess privilege="Edit Patient Identifiers">
            <Button
              data-testid="edit-button"
              size="md"
              kind="ghost"
              onClick={handleEdit}
              iconDescription={t('editIdentifierTooltip', 'Edit')}
              disabled={disabled}
              hasIconOnly
            >
              <Edit size={16} />
            </Button>
          </UserHasAccess>
        )}
        {showResetButton && (
          <UserHasAccess privilege="Edit Patient Identifiers">
            <Button
              size="md"
              kind="ghost"
              onClick={handleReset}
              iconDescription={t('resetIdentifierTooltip', 'Reset')}
              disabled={disabled}
              hasIconOnly
            >
              <Reset size={16} />
            </Button>
          </UserHasAccess>
        )}
        {!patientIdentifier.required &&
          !defaultPatientIdentifierTypesMap[patientIdentifier.identifierTypeUuid] &&
          (!isIdentityDocumentIdentifier(values.identifiers, fieldName, identifierTypes) ||
            countIdentityDocumentIdentifiers(values.identifiers, identifierTypes) > 1) && (
            <UserHasAccess privilege="Delete Patient Identifiers">
              <Button
                size="md"
                kind="ghost"
                onClick={handleDelete}
                iconDescription={t('deleteIdentifierTooltip', 'Delete')}
                disabled={disabled}
                hasIconOnly
              >
                <TrashCan size={16} />
              </Button>
            </UserHasAccess>
          )}
      </div>
    </div>
  );
};

export default IdentifierInput;
