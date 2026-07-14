import { Button, ButtonSet, Checkbox, RadioButton, RadioButtonGroup, Search } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { ResourcesContext } from '../../../offline.resources';
import {
  isUniqueIdentifierTypeForOffline,
  shouldBlockPatientIdentifierInOfflineMode,
} from '../../input/custom-input/identifier/utils';
import { type FormValues, type PatientIdentifierType, PatientIdentifierValue } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import {
  peruDniPatientIdentifierTypeUuid,
  peruForeignPatientIdentifierTypeUuids,
} from '../../peru-registration-config';
import Overlay from '../../ui-components/overlay/overlay.component';
import {
  countIdentityDocumentIdentifiers,
  initializeIdentifier,
  isIdentityDocumentIdentifier,
  setIdentifierSource,
} from './id-field.component';
import styles from './identifier-selection.scss';

interface PatientIdentifierOverlayProps {
  setFieldValue: (fieldName: string, value: FormValues['identifiers'] | PatientIdentifierValue) => void;
  closeOverlay: () => void;
}

const exclusiveIdentifierTypeUuids: Record<string, string | Array<string>> = {
  [peruDniPatientIdentifierTypeUuid]: peruForeignPatientIdentifierTypeUuids,
  ...Object.fromEntries(peruForeignPatientIdentifierTypeUuids.map((uuid) => [uuid, peruDniPatientIdentifierTypeUuid])),
};

function normalizeSearchValue(value?: string) {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getIdentifierTypeDescription(identifierType: PatientIdentifierType) {
  const description = identifierType.description?.trim();
  if (!description) {
    return null;
  }

  const normalizedDescription = description.toLocaleLowerCase();
  const labels = [identifierType.name, identifierType.display]
    .filter(Boolean)
    .map((label) => label.trim().toLocaleLowerCase());

  return labels.includes(normalizedDescription) ? null : description;
}

function removeIdentifiersByTypeUuid(
  identifiers: FormValues['identifiers'],
  identifierTypeUuids: string | Array<string>,
) {
  const excludedIdentifierTypeUuids = new Set(
    Array.isArray(identifierTypeUuids) ? identifierTypeUuids : [identifierTypeUuids],
  );

  return Object.fromEntries(
    Object.entries(identifiers).filter(
      ([, identifier]) => !excludedIdentifierTypeUuids.has(identifier.identifierTypeUuid),
    ),
  );
}

const PatientIdentifierOverlay: React.FC<PatientIdentifierOverlayProps> = ({ closeOverlay, setFieldValue }) => {
  const layout = useLayoutType();
  const { identifierTypes = [] } = useContext(ResourcesContext);
  const { isOffline, values, initialFormValues } = useContext(PatientRegistrationContext);
  const [unsavedIdentifierTypes, setUnsavedIdentifierTypes] = useState<FormValues['identifiers']>(
    values.identifiers ?? {},
  );
  const [searchString, setSearchString] = useState('');
  const { t } = useTranslation(moduleName);

  useEffect(() => {
    setUnsavedIdentifierTypes(values.identifiers ?? {});
  }, [values.identifiers]);

  const handleSearch = useCallback((event) => setSearchString(event?.target?.value ?? ''), []);

  const filteredIdentifiers = useMemo(
    () =>
      identifierTypes.filter((identifier) =>
        normalizeSearchValue([identifier?.name, identifier?.display, identifier?.description].filter(Boolean).join(' ')).includes(
          normalizeSearchValue(searchString),
        ),
      ),
    [searchString, identifierTypes],
  );

  const handleCheckingIdentifier = useCallback(
    (identifierType: PatientIdentifierType, checked: boolean) =>
      setUnsavedIdentifierTypes((unsavedIdentifierTypes) => {
        if (checked) {
          const exclusiveIdentifierTypeUuid = exclusiveIdentifierTypeUuids[identifierType.uuid];
          const identifiersWithoutExclusiveType = exclusiveIdentifierTypeUuid
            ? removeIdentifiersByTypeUuid(unsavedIdentifierTypes, exclusiveIdentifierTypeUuid)
            : unsavedIdentifierTypes;

          return {
            ...identifiersWithoutExclusiveType,
            [identifierType.fieldName]: initializeIdentifier(
              identifierType,
              values.identifiers?.[identifierType.fieldName] ??
                initialFormValues.identifiers?.[identifierType.fieldName] ??
                {},
            ),
          };
        }
        if (unsavedIdentifierTypes[identifierType.fieldName]) {
          if (
            isIdentityDocumentIdentifier(unsavedIdentifierTypes, identifierType.fieldName, identifierTypes) &&
            countIdentityDocumentIdentifiers(unsavedIdentifierTypes, identifierTypes) <= 1
          ) {
            return unsavedIdentifierTypes;
          }

          return Object.fromEntries(
            Object.entries(unsavedIdentifierTypes).filter(([fieldName]) => fieldName !== identifierType.fieldName),
          );
        }
        return unsavedIdentifierTypes;
      }),
    [initialFormValues.identifiers, values.identifiers, identifierTypes],
  );

  const handleSelectingIdentifierSource = useCallback(
    (identifierType: PatientIdentifierType, sourceUuid) =>
      setUnsavedIdentifierTypes((unsavedIdentifierTypes) => ({
        ...unsavedIdentifierTypes,
        [identifierType.fieldName]: {
          ...unsavedIdentifierTypes[identifierType.fieldName],
          ...setIdentifierSource(
            identifierType.identifierSources.find((source) => source.uuid === sourceUuid),
            unsavedIdentifierTypes[identifierType.fieldName].identifierValue,
            unsavedIdentifierTypes[identifierType.fieldName].initialValue,
          ),
        },
      })),
    [],
  );

  const identifierTypeFields = useMemo(
    () =>
      filteredIdentifiers.map((identifierType) => {
        const patientIdentifier = unsavedIdentifierTypes[identifierType.fieldName];
        const selectedIdentityDocumentCount = countIdentityDocumentIdentifiers(unsavedIdentifierTypes, identifierTypes);
        const identifierTypeDescription = getIdentifierTypeDescription(identifierType);
        const isDisabled =
          identifierType.isPrimary ||
          identifierType.required ||
          (!!patientIdentifier &&
            isIdentityDocumentIdentifier(unsavedIdentifierTypes, identifierType.fieldName, identifierTypes) &&
            selectedIdentityDocumentCount <= 1);
        const isDisabledOffline = isOffline && shouldBlockPatientIdentifierInOfflineMode(identifierType);

        return (
          <div key={identifierType.uuid} className={styles.space05}>
            <Checkbox
              id={identifierType.uuid}
              value={identifierType.uuid}
              labelText={
                identifierTypeDescription ? (
                  <span className={styles.identifierLabel}>
                    <span>{identifierType.name}</span>
                    <span className={styles.identifierDescription} aria-hidden="true">
                      {identifierTypeDescription}
                    </span>
                  </span>
                ) : (
                  identifierType.name
                )
              }
              onChange={(_event, { checked }) => handleCheckingIdentifier(identifierType, checked)}
              checked={!!patientIdentifier}
              disabled={isDisabled || (isOffline && isDisabledOffline)}
            />
            {patientIdentifier &&
              identifierType?.identifierSources?.length > 0 &&
              /*
                This check are for the cases when there's an initialValue identifier is assigned
                to the patient
                The corresponding flow is like:
                1. If there's no change to the actual initial identifier, then the source remains null,
                hence the list of the identifier sources shouldn't be displayed.
                2. If user wants to edit the patient identifier's value, hence there will be an initialValue,
                along with a source assigned to itself(only if the identifierType has sources, else there's nothing to worry about), which by
                default is the first identifierSource
              */
              (!patientIdentifier.initialValue || patientIdentifier?.selectedSource) && (
                <div className={styles.radioGroup}>
                  <RadioButtonGroup
                    legendText={t('source', 'Source')}
                    name={`${identifierType?.fieldName}-identifier-sources`}
                    defaultSelected={patientIdentifier?.selectedSource?.uuid}
                    onChange={(sourceUuid: string) => handleSelectingIdentifierSource(identifierType, sourceUuid)}
                    orientation="vertical"
                  >
                    {identifierType?.identifierSources.map((source) => (
                      <RadioButton
                        key={source.uuid}
                        labelText={source.name}
                        name={source.uuid}
                        value={source.uuid}
                        className={styles.radioButton}
                        disabled={
                          isOffline &&
                          isUniqueIdentifierTypeForOffline(identifierType) &&
                          source.autoGenerationOption?.manualEntryEnabled
                        }
                      />
                    ))}
                  </RadioButtonGroup>
                </div>
              )}
          </div>
        );
      }),
    [
      filteredIdentifiers,
      identifierTypes,
      unsavedIdentifierTypes,
      isOffline,
      handleCheckingIdentifier,
      t,
      handleSelectingIdentifierSource,
    ],
  );

  const handleConfiguringIdentifiers = useCallback(() => {
    if (countIdentityDocumentIdentifiers(unsavedIdentifierTypes, identifierTypes) === 0) {
      return;
    }

    setFieldValue('identifiers', unsavedIdentifierTypes);
    closeOverlay();
  }, [identifierTypes, unsavedIdentifierTypes, setFieldValue, closeOverlay]);

  const hasIdentityDocument = countIdentityDocumentIdentifiers(unsavedIdentifierTypes, identifierTypes) > 0;

  return (
    <Overlay
      close={closeOverlay}
      header={t('configureIdentifiers', 'Configure identifiers')}
      buttonsGroup={
        <ButtonSet className={isDesktop(layout) ? styles.desktop : styles.tablet}>
          <Button className={styles.button} kind="secondary" type="button" onClick={closeOverlay}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            type="button"
            disabled={!hasIdentityDocument}
            onClick={handleConfiguringIdentifiers}
          >
            {t('configureIdentifiers', 'Configure identifiers')}
          </Button>
        </ButtonSet>
      }
    >
      <div>
        <p className={styles.bodyLong02}>
          {t('IDInstructions', "Select the identifiers you'd like to add for this patient:")}
        </p>
        {identifierTypes.length > 7 && (
          <div className={styles.space05}>
            <Search
              labelText={t('searchIdentifierPlaceholder', 'Search identifier')}
              placeholder={t('searchIdentifierPlaceholder', 'Search identifier')}
              onChange={handleSearch}
              value={searchString}
            />
          </div>
        )}
        {!hasIdentityDocument ? (
          <p className={styles.requirementMessage} role="alert">
            {t(
              'identifierSelectionRequiresIdentityDocument',
              'Select at least one identity document (DNI, CE, passport, DIE, or CNV).',
            )}
          </p>
        ) : null}
        <fieldset aria-label={t('availableIdentifierTypes', 'Available identification data')}>
          {identifierTypeFields.length ? (
            identifierTypeFields
          ) : (
            <p className={styles.emptyState} role="status">
              {t('identifierSearchNoResults', 'No matching identification data found')}
            </p>
          )}
        </fieldset>
      </div>
    </Overlay>
  );
};

export default PatientIdentifierOverlay;
