import {
  Button,
  ContentSwitcher,
  InlineLoading,
  InlineNotification,
  Layer,
  NotificationActionButton,
  Select,
  SelectItem,
  SkeletonText,
  Switch,
  TextInput,
} from '@carbon/react';
import { TrashCan } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { FieldArray } from 'formik';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { ResourcesContext } from '../../../offline.resources';
import { Autosuggest } from '../../input/custom-input/autosuggest/autosuggest.component';
import { fetchPerson, savePerson } from '../../patient-registration.resource';
import { type FormValues, type RelationshipValue } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { getEffectiveRegistrationConfig } from '../../peru-registration-config';
import { hasResponsibleRelationship, isMinorPatient } from '../../validation/patient-registration-validation';
import sectionStyles from '../section.scss';
import styles from './relationships.scss';
import {
  buildResponsiblePersonPayload,
  getResponsiblePersonDisplayName,
  hasResponsiblePersonFormErrors,
  type ResponsiblePersonFormValues,
  type ResponsiblePersonValidationErrors,
  validateResponsiblePersonForm,
} from './responsible-person.utils';

interface RelationshipType {
  display: string;
  uuid: string;
  direction: string;
}

interface RelationshipViewProps {
  relationship: RelationshipValue;
  index: number;
  displayRelationshipTypes: RelationshipType[];
  remove: <T>(index: number) => T;
}

type PersonEntryMode = 'create' | 'search';
type ResponsiblePersonField = keyof ResponsiblePersonFormValues;
type GenderOption = RegistrationConfig['fieldConfigurations']['gender'][number];

const defaultGenderOptions: Array<GenderOption> = [
  { value: 'male' },
  { value: 'female' },
  { value: 'other' },
  { value: 'unknown' },
];

const initialResponsiblePersonValues: ResponsiblePersonFormValues = {
  givenName: '',
  middleName: '',
  familyName: '',
  familyName2: '',
  gender: '',
  estimatedAge: '',
  relationshipType: '',
};

function getRelationshipClientId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `relationship-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getRelationshipKey(relationship: RelationshipValue) {
  return (
    relationship.uuid ??
    relationship.clientId ??
    relationship.relatedPersonUuid ??
    `${relationship.action ?? 'relationship'}-${relationship.relationshipType ?? 'pending'}`
  );
}

const RelationshipView: React.FC<RelationshipViewProps> = ({
  relationship,
  index,
  displayRelationshipTypes,
  remove,
}) => {
  const { t } = useTranslation(moduleName);
  const config = useConfig<RegistrationConfig>();
  const { setFieldValue } = React.useContext(PatientRegistrationContext);
  const [isInvalid, setIsInvalid] = useState(false);
  const [personEntryMode, setPersonEntryMode] = useState<PersonEntryMode>(
    relationship.relatedPersonUuid ? 'search' : 'create',
  );
  const [newPersonValues, setNewPersonValues] = useState<ResponsiblePersonFormValues>({
    ...initialResponsiblePersonValues,
    relationshipType: relationship.relationshipType ?? '',
  });
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ResponsiblePersonField, boolean>>>({});
  const [createPersonError, setCreatePersonError] = useState<string | null>(null);
  const [isSavingPerson, setIsSavingPerson] = useState(false);
  const newRelationship = !relationship.uuid;
  const requiresRelatedPerson = newRelationship && !relationship.relatedPersonUuid;
  const genderOptions = config?.fieldConfigurations?.gender ?? defaultGenderOptions;

  const personFormValues = useMemo(
    () => ({
      ...newPersonValues,
      relationshipType: relationship.relationshipType ?? newPersonValues.relationshipType,
    }),
    [newPersonValues, relationship.relationshipType],
  );

  const personFormErrors = useMemo(() => validateResponsiblePersonForm(personFormValues), [personFormValues]);

  const handleRelationshipTypeChange = useCallback(
    (event) => {
      const { target } = event;
      const field = target.name;
      const value = target.options[target.selectedIndex].value;
      setFieldValue(field, value);
      setNewPersonValues((currentValues) => ({ ...currentValues, relationshipType: value }));
      setTouchedFields((currentFields) => ({ ...currentFields, relationshipType: true }));
      if (!relationship?.action) {
        setFieldValue(`relationships[${index}].action`, 'UPDATE');
      }
    },
    [index, relationship?.action, setFieldValue],
  );

  const handleSuggestionSelected = useCallback(
    (field: string, selectedSuggestion: string) => {
      setIsInvalid(!selectedSuggestion);
      setFieldValue(field, selectedSuggestion);
      if (!selectedSuggestion) {
        setFieldValue(`relationships[${index}].relatedPersonName`, '');
      }
    },
    [index, setFieldValue],
  );

  const searchPerson = async (query: string) => {
    const abortController = new AbortController();
    return await fetchPerson(query, abortController);
  };

  const deleteRelationship = useCallback(() => {
    if (relationship.action === 'ADD') {
      remove(index);
    } else {
      setFieldValue(`relationships[${index}].action`, 'DELETE');
    }
  }, [relationship, index, remove, setFieldValue]);

  const restoreRelationship = useCallback(() => {
    setFieldValue(`relationships[${index}]`, {
      ...relationship,
      action: undefined,
      relationshipType: relationship.initialrelationshipTypeValue,
    });
  }, [index, setFieldValue, relationship]);

  const handlePersonEntryModeChange = useCallback((event) => {
    setCreatePersonError(null);
    setPersonEntryMode(event.name as PersonEntryMode);
  }, []);

  const handleNewPersonFieldChange = useCallback(
    (field: ResponsiblePersonField) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setNewPersonValues((currentValues) => ({
        ...currentValues,
        [field]: event.target.value,
      }));
    },
    [],
  );

  const markNewPersonFieldTouched = useCallback(
    (field: ResponsiblePersonField) => () => {
      setTouchedFields((currentFields) => ({
        ...currentFields,
        [field]: true,
      }));
    },
    [],
  );

  const markAllNewPersonFieldsTouched = useCallback(() => {
    setTouchedFields({
      givenName: true,
      middleName: true,
      familyName: true,
      familyName2: true,
      gender: true,
      estimatedAge: true,
      relationshipType: true,
    });
  }, []);

  const getFieldError = useCallback(
    (field: ResponsiblePersonField, errors: ResponsiblePersonValidationErrors) =>
      touchedFields[field] && errors[field] ? t(errors[field], errors[field]) : undefined,
    [t, touchedFields],
  );

  const handleCreatePerson = useCallback(async () => {
    setCreatePersonError(null);
    const errors = validateResponsiblePersonForm(personFormValues);

    if (hasResponsiblePersonFormErrors(errors)) {
      markAllNewPersonFieldsTouched();
      return;
    }

    setIsSavingPerson(true);
    try {
      const response = await savePerson(buildResponsiblePersonPayload(personFormValues));
      const personUuid = response?.data?.uuid;

      if (!personUuid) {
        throw new Error('The backend did not return a person UUID');
      }

      setFieldValue(`relationships[${index}].relatedPersonUuid`, personUuid);
      setFieldValue(
        `relationships[${index}].relatedPersonName`,
        response.data.display ?? getResponsiblePersonDisplayName(personFormValues),
      );
      setFieldValue(`relationships[${index}].relationshipType`, personFormValues.relationshipType);
      setFieldValue(`relationships[${index}].action`, 'ADD');
    } catch (error) {
      console.error('Error creating responsible person', error);
      setCreatePersonError(
        error instanceof Error
          ? error.message
          : t('createResponsiblePersonError', 'Could not create responsible person'),
      );
    } finally {
      setIsSavingPerson(false);
    }
  }, [index, markAllNewPersonFieldsTouched, personFormValues, setFieldValue, t]);

  return relationship.action !== 'DELETE' ? (
    <div className={styles.relationship}>
      <div className={styles.relationshipHeader}>
        <h4 className={styles.productiveHeading}>{t('relationshipPlaceholder', 'Relationship')}</h4>
        <Button
          kind="ghost"
          iconDescription={t('deleteRelationshipTooltipText', 'Delete')}
          hasIconOnly
          type="button"
          onClick={deleteRelationship}
        >
          <TrashCan size={16} className={styles.trashCan} />
        </Button>
      </div>
      <div className={styles.selectRelationshipType}>
        <Layer>
          <Select
            id={`relationships[${index}].relationshipType`}
            labelText={t('relationshipToPatient', 'Relationship to patient')}
            onChange={handleRelationshipTypeChange}
            onBlur={markNewPersonFieldTouched('relationshipType')}
            name={`relationships[${index}].relationshipType`}
            defaultValue={relationship?.relationshipType ?? 'placeholder-item'}
            invalid={!!getFieldError('relationshipType', personFormErrors)}
            invalidText={getFieldError('relationshipType', personFormErrors)}
          >
            <SelectItem disabled hidden value="placeholder-item" text={t('selectAnOption', 'Select an option')} />
            {displayRelationshipTypes.map((relationshipType) => (
              <SelectItem
                text={relationshipType.display}
                value={`${relationshipType.uuid}/${relationshipType.direction}`}
                key={`relationship-${relationshipType.uuid}-${relationshipType.direction}`}
              />
            ))}
          </Select>
        </Layer>
      </div>
      {requiresRelatedPerson ? (
        <div className={styles.personEntry}>
          <ContentSwitcher
            size="sm"
            selectedIndex={personEntryMode === 'create' ? 0 : 1}
            onChange={handlePersonEntryModeChange}
          >
            <Switch name="create" text={t('createResponsiblePerson', 'Register new person')} />
            <Switch name="search" text={t('searchExistingPerson', 'Search existing person')} />
          </ContentSwitcher>
          {personEntryMode === 'search' ? (
            <div className={styles.searchBox}>
              <Autosuggest
                id={`relationships[${index}].relatedPersonUuid`}
                labelText={t('relativeFullNameLabelText', 'Full name')}
                placeholder={t('relativeNamePlaceholder', 'Firstname Familyname')}
                defaultValue={relationship.relatedPersonName}
                onSuggestionSelected={handleSuggestionSelected}
                invalid={isInvalid}
                invalidText={t('relationshipPersonMustExist', 'Related person must be an existing person')}
                getSearchResults={searchPerson}
                getDisplayValue={(item) => item.display}
                getFieldValue={(item) => item.uuid}
              />
            </div>
          ) : (
            <div className={styles.responsiblePersonForm}>
              {createPersonError ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('createResponsiblePersonErrorTitle', 'Could not create responsible person')}
                  subtitle={createPersonError}
                />
              ) : null}
              <div className={styles.responsiblePersonGrid}>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.givenName`}
                    labelText={t('responsibleGivenName', 'First name')}
                    value={newPersonValues.givenName}
                    onChange={handleNewPersonFieldChange('givenName')}
                    onBlur={markNewPersonFieldTouched('givenName')}
                    invalid={!!getFieldError('givenName', personFormErrors)}
                    invalidText={getFieldError('givenName', personFormErrors)}
                    required
                  />
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.middleName`}
                    labelText={t('responsibleMiddleName', 'Middle name (optional)')}
                    value={newPersonValues.middleName}
                    onChange={handleNewPersonFieldChange('middleName')}
                    onBlur={markNewPersonFieldTouched('middleName')}
                    invalid={!!getFieldError('middleName', personFormErrors)}
                    invalidText={getFieldError('middleName', personFormErrors)}
                  />
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.familyName`}
                    labelText={t('responsibleFamilyName', 'Family name')}
                    value={newPersonValues.familyName}
                    onChange={handleNewPersonFieldChange('familyName')}
                    onBlur={markNewPersonFieldTouched('familyName')}
                    invalid={!!getFieldError('familyName', personFormErrors)}
                    invalidText={getFieldError('familyName', personFormErrors)}
                    required
                  />
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.familyName2`}
                    labelText={t('responsibleFamilyName2', 'Second family name (optional)')}
                    value={newPersonValues.familyName2}
                    onChange={handleNewPersonFieldChange('familyName2')}
                    onBlur={markNewPersonFieldTouched('familyName2')}
                    invalid={!!getFieldError('familyName2', personFormErrors)}
                    invalidText={getFieldError('familyName2', personFormErrors)}
                  />
                </Layer>
                <Layer>
                  <Select
                    id={`relationships[${index}].newPerson.gender`}
                    labelText={t('sexFieldLabelText', 'Sex')}
                    value={newPersonValues.gender}
                    onChange={handleNewPersonFieldChange('gender')}
                    onBlur={markNewPersonFieldTouched('gender')}
                    invalid={!!getFieldError('gender', personFormErrors)}
                    invalidText={getFieldError('gender', personFormErrors)}
                    required
                  >
                    <SelectItem disabled hidden value="" text={t('selectAnOption', 'Select an option')} />
                    {genderOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        text={t(option.label ?? option.value, option.label ?? option.value)}
                      />
                    ))}
                  </Select>
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.estimatedAge`}
                    labelText={t('responsibleEstimatedAge', 'Approximate age (optional)')}
                    value={newPersonValues.estimatedAge}
                    inputMode="numeric"
                    maxLength={3}
                    onChange={handleNewPersonFieldChange('estimatedAge')}
                    onBlur={markNewPersonFieldTouched('estimatedAge')}
                    invalid={!!getFieldError('estimatedAge', personFormErrors)}
                    invalidText={getFieldError('estimatedAge', personFormErrors)}
                  />
                </Layer>
              </div>
              <div className={styles.createPersonActions}>
                <Button type="button" kind="secondary" onClick={handleCreatePerson} disabled={isSavingPerson}>
                  {t('createResponsiblePersonAction', 'Register person and use as responsible party')}
                </Button>
                {isSavingPerson ? (
                  <InlineLoading description={t('creatingResponsiblePerson', 'Creating person...')} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.selectedPerson}>
          <span className={styles.labelText}>{t('relativeFullNameLabelText', 'Full name')}</span>
          <p className={styles.bodyShort02}>
            {relationship.relatedPersonName ?? t('selectedPerson', 'Selected person')}
          </p>
        </div>
      )}
    </div>
  ) : (
    <InlineNotification kind="info" title={t('relationshipRemovedText', 'Relationship removed')}>
      {
        <NotificationActionButton onClick={restoreRelationship}>
          {t('restoreRelationshipActionButton', 'Undo')}
        </NotificationActionButton>
      }
    </InlineNotification>
  );
};

interface RelationshipsSectionProps {
  defaultNewRelationship?: boolean;
}

export const RelationshipsSection: React.FC<RelationshipsSectionProps> = ({ defaultNewRelationship = false }) => {
  const { relationshipTypes, relationshipTypesError, isLoadingRelationshipTypes } = useContext(ResourcesContext);
  const relationshipTypeResults = Array.isArray(relationshipTypes) ? [] : relationshipTypes?.results;
  const registrationContext = useContext(PatientRegistrationContext);
  const values = registrationContext?.values ?? ({} as FormValues);
  const { setFieldValue } = registrationContext ?? {};
  const configuredConfig = useConfig() as RegistrationConfig;
  const config = configuredConfig?.sections ? getEffectiveRegistrationConfig(configuredConfig) : configuredConfig;
  const [displayRelationshipTypes, setDisplayRelationshipTypes] = useState<RelationshipType[]>([]);
  const [hasSeededDefaultRelationship, setHasSeededDefaultRelationship] = useState(false);
  const { t } = useTranslation(moduleName);
  const requiresResponsibleRelationship = isMinorPatient(values);
  const minorResponsibleRelationshipTypes = config?.relationshipOptions?.minorResponsibleRelationshipTypes ?? [];
  const hasRelationshipTypes = !!relationshipTypeResults?.length;

  useEffect(() => {
    if (hasRelationshipTypes) {
      const tmp: RelationshipType[] = [];
      relationshipTypeResults.forEach((type) => {
        const aIsToB = {
          display: type.displayAIsToB ? type.displayAIsToB : type.displayBIsToA,
          uuid: type.uuid,
          direction: 'aIsToB',
        };
        const bIsToA = {
          display: type.displayBIsToA ? type.displayBIsToA : type.displayAIsToB,
          uuid: type.uuid,
          direction: 'bIsToA',
        };
        aIsToB.display === bIsToA.display
          ? tmp.push(aIsToB)
          : bIsToA.display === 'Patient'
            ? tmp.push(aIsToB, { display: `Patient (${aIsToB.display})`, uuid: type.uuid, direction: 'bIsToA' })
            : tmp.push(aIsToB, bIsToA);
      });
      setDisplayRelationshipTypes(tmp);
    }
  }, [hasRelationshipTypes, relationshipTypeResults]);

  useEffect(() => {
    if (
      defaultNewRelationship &&
      hasRelationshipTypes &&
      !hasSeededDefaultRelationship &&
      setFieldValue &&
      !values.relationships?.length
    ) {
      setFieldValue('relationships', [
        {
          clientId: getRelationshipClientId(),
          relatedPersonUuid: '',
          action: 'ADD',
        },
      ]);
      setHasSeededDefaultRelationship(true);
    }
  }, [
    defaultNewRelationship,
    hasRelationshipTypes,
    hasSeededDefaultRelationship,
    setFieldValue,
    values.relationships?.length,
  ]);

  if (isLoadingRelationshipTypes && !hasRelationshipTypes) {
    return (
      <section aria-label="Loading relationships section">
        <div role="progressbar">
          <SkeletonText />
        </div>
      </section>
    );
  }

  if (!hasRelationshipTypes) {
    return (
      <section aria-label="Relationships section">
        <InlineNotification
          kind={relationshipTypesError ? 'error' : 'warning'}
          lowContrast
          title={t('relationshipTypesUnavailableTitle', 'Relationship types unavailable')}
          subtitle={t(
            'relationshipTypesUnavailableSubtitle',
            'Refresh the page. If the problem continues, check that relationship types are configured and that your session is active.',
          )}
        />
      </section>
    );
  }

  return (
    <section aria-label="Relationships section">
      <FieldArray name="relationships">
        {({
          push,
          remove,
          form: {
            values: { relationships },
          },
        }) => (
          <div>
            {requiresResponsibleRelationship &&
            !hasResponsibleRelationship(relationships, minorResponsibleRelationshipTypes) ? (
              <InlineNotification
                kind="warning"
                lowContrast
                title={t('responsibleRelationshipRequiredTitle', 'Responsible relationship required')}
                subtitle={t(
                  'responsibleRelationshipRequiredForMinor',
                  'A responsible family member or guardian relationship is required for minors',
                )}
              />
            ) : null}
            {relationships && relationships.length > 0
              ? relationships.map((relationship: RelationshipValue, index) => (
                  <div key={getRelationshipKey(relationship)} className={sectionStyles.formSection}>
                    <RelationshipView
                      relationship={relationship}
                      index={index}
                      displayRelationshipTypes={displayRelationshipTypes}
                      remove={remove}
                    />
                  </div>
                ))
              : null}
            <div className={styles.actions}>
              <Button
                kind="ghost"
                onClick={() =>
                  push({
                    clientId: getRelationshipClientId(),
                    relatedPersonUuid: '',
                    action: 'ADD',
                  })
                }
              >
                {t('addRelationshipButtonText', 'Add Relationship')}
              </Button>
            </div>
          </div>
        )}
      </FieldArray>
    </section>
  );
};
