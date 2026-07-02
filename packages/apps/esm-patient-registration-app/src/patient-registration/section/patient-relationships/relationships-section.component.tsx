import {
  Button,
  Checkbox,
  ContentSwitcher,
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
import { patientFamilyNameMaxLength, patientGivenNameMaxLength } from '../../patient-name-limits';
import { fetchPerson, type PersonSearchResult } from '../../patient-registration.resource';
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

const invalidMinorResponsibleRelationshipLabels = new Set(['child', 'grandchild', 'hijo', 'nieto']);

const initialResponsiblePersonValues: ResponsiblePersonFormValues = {
  givenName: '',
  middleName: '',
  familyName: '',
  familyName2: '',
  gender: '',
  estimatedAge: '',
  phone: '',
  address: '',
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

function normalizeRelationshipLabel(label: string) {
  return label
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getUniqueRelationshipTypes(relationshipTypes: Array<RelationshipType>) {
  const labels = new Set<string>();

  return relationshipTypes.filter((relationshipType) => {
    const normalizedLabel = normalizeRelationshipLabel(relationshipType.display);

    if (!normalizedLabel || labels.has(normalizedLabel)) {
      return false;
    }

    labels.add(normalizedLabel);
    return true;
  });
}

function getDisplayRelationshipTypes(relationshipTypes: Array<RelationshipType>, isMinor: boolean) {
  const uniqueRelationshipTypes = getUniqueRelationshipTypes(relationshipTypes);

  if (!isMinor) {
    return uniqueRelationshipTypes;
  }

  return uniqueRelationshipTypes.filter(
    (relationshipType) =>
      !invalidMinorResponsibleRelationshipLabels.has(normalizeRelationshipLabel(relationshipType.display)),
  );
}

function getAgeFromBirthdate(birthdate?: string) {
  if (!birthdate) {
    return undefined;
  }

  const birthdateValue = new Date(birthdate);
  if (Number.isNaN(birthdateValue.getTime())) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - birthdateValue.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthdateValue.getMonth() ||
    (today.getMonth() === birthdateValue.getMonth() && today.getDate() >= birthdateValue.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

function getPersonSearchResultAge(person?: PersonSearchResult | null) {
  if (!person) {
    return undefined;
  }

  return person.person?.age ?? person.age ?? getAgeFromBirthdate(person.person?.birthdate ?? person.birthdate);
}

function getPersonSearchResultDisplay(person?: PersonSearchResult | null) {
  return person?.person?.display ?? person?.display ?? '';
}

function isMinorPersonSearchResult(person?: PersonSearchResult | null) {
  const age = getPersonSearchResultAge(person);
  return typeof age === 'number' && age < 18;
}

function sanitizePhoneInput(value: string) {
  const startsWithPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');

  return `${startsWithPlus ? '+' : ''}${digits}`.slice(0, 20);
}

const RelationshipView: React.FC<RelationshipViewProps> = ({
  relationship,
  index,
  displayRelationshipTypes,
  remove,
}) => {
  const { t } = useTranslation(moduleName);
  const config = useConfig<RegistrationConfig>();
  const effectiveConfig = config?.sections ? getEffectiveRegistrationConfig(config) : config;
  const { setFieldValue, values } = React.useContext(PatientRegistrationContext);
  const [isInvalid, setIsInvalid] = useState(false);
  const [selectedExistingPerson, setSelectedExistingPerson] = useState<PersonSearchResult | null>(null);
  const [selectedPersonInvalidText, setSelectedPersonInvalidText] = useState<string | null>(null);
  const [personEntryMode, setPersonEntryMode] = useState<PersonEntryMode>('search');
  const [newPersonValues, setNewPersonValues] = useState<ResponsiblePersonFormValues>({
    ...initialResponsiblePersonValues,
    relationshipType: relationship.relationshipType ?? '',
  });
  const [touchedFields, setTouchedFields] = useState<Partial<Record<ResponsiblePersonField, boolean>>>({});
  const newRelationship = !relationship.uuid;
  const requiresRelatedPerson = newRelationship && !relationship.relatedPersonUuid && !relationship.newPerson;
  const isPendingNewPerson = !relationship.relatedPersonUuid && !!relationship.newPerson;
  const genderOptions = config?.fieldConfigurations?.gender ?? defaultGenderOptions;
  const minorResponsibleRelationshipTypes =
    effectiveConfig?.relationshipOptions?.minorResponsibleRelationshipTypes ?? [];
  const responsiblePersonPhoneAttributeUuid = effectiveConfig?.fieldConfigurations?.phone?.personAttributeUuid;

  const personFormValues = useMemo(
    () => ({
      ...newPersonValues,
      relationshipType: relationship.relationshipType ?? newPersonValues.relationshipType,
    }),
    [newPersonValues, relationship.relationshipType],
  );

  const requiresAdultResponsible = useMemo(
    () => isMinorPatient(values) && minorResponsibleRelationshipTypes.includes(personFormValues.relationshipType),
    [minorResponsibleRelationshipTypes, personFormValues.relationshipType, values],
  );

  const personFormErrors = useMemo(
    () => validateResponsiblePersonForm(personFormValues, { requireAdult: requiresAdultResponsible }),
    [personFormValues, requiresAdultResponsible],
  );

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
    (field: string, selectedSuggestion?: string, selectedPerson?: unknown) => {
      const selectedPersonResult = selectedPerson as PersonSearchResult | undefined;
      setSelectedExistingPerson(selectedPersonResult ?? null);
      const selectedPersonIsUnderage = requiresAdultResponsible && isMinorPersonSearchResult(selectedPersonResult);

      if (selectedPersonIsUnderage) {
        setIsInvalid(true);
        setSelectedPersonInvalidText(t('responsibleExistingPersonMustBeAdult', 'Responsible person must be an adult'));
        setFieldValue(field, '');
        setFieldValue(`relationships[${index}].relatedPersonName`, '');
        return;
      }

      setSelectedPersonInvalidText(null);
      setIsInvalid(!selectedSuggestion);
      setFieldValue(field, selectedSuggestion ?? '');
      setFieldValue(
        `relationships[${index}].relatedPersonName`,
        selectedSuggestion ? getPersonSearchResultDisplay(selectedPersonResult) : '',
      );
    },
    [index, requiresAdultResponsible, setFieldValue, t],
  );

  useEffect(() => {
    if (requiresAdultResponsible && isMinorPersonSearchResult(selectedExistingPerson)) {
      setIsInvalid(true);
      setSelectedPersonInvalidText(t('responsibleExistingPersonMustBeAdult', 'Responsible person must be an adult'));
      setFieldValue(`relationships[${index}].relatedPersonUuid`, '');
      setFieldValue(`relationships[${index}].relatedPersonName`, '');
    }
  }, [index, requiresAdultResponsible, selectedExistingPerson, setFieldValue, t]);

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
    setPersonEntryMode(event.name as PersonEntryMode);
  }, []);

  const handleNewPersonFieldChange = useCallback(
    (field: ResponsiblePersonField) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setNewPersonValues((currentValues) => ({
        ...currentValues,
        [field]: field === 'phone' ? sanitizePhoneInput(event.target.value) : event.target.value,
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
      phone: true,
      address: true,
      relationshipType: true,
    });
  }, []);

  const getFieldError = useCallback(
    (field: ResponsiblePersonField, errors: ResponsiblePersonValidationErrors) =>
      touchedFields[field] && errors[field] ? t(errors[field], errors[field]) : undefined,
    [t, touchedFields],
  );

  // The person is NOT created here: it is stored on the relationship row and persisted
  // at form submit, right before its relationship, so abandoning the registration never
  // leaves an orphaned person in the database.
  const handleConfirmNewPerson = useCallback(() => {
    const errors = validateResponsiblePersonForm(personFormValues, { requireAdult: requiresAdultResponsible });

    if (hasResponsiblePersonFormErrors(errors)) {
      markAllNewPersonFieldsTouched();
      return;
    }

    setFieldValue(`relationships[${index}].newPerson`, personFormValues);
    setFieldValue(`relationships[${index}].relatedPersonName`, getResponsiblePersonDisplayName(personFormValues));
    setFieldValue(`relationships[${index}].relationshipType`, personFormValues.relationshipType);
    setFieldValue(`relationships[${index}].action`, 'ADD');
  }, [index, markAllNewPersonFieldsTouched, personFormValues, requiresAdultResponsible, setFieldValue]);

  const handleEditPendingPerson = useCallback(() => {
    if (relationship.newPerson) {
      setNewPersonValues(relationship.newPerson);
    }
    setFieldValue(`relationships[${index}].newPerson`, undefined);
    setFieldValue(`relationships[${index}].relatedPersonName`, '');
    setPersonEntryMode('create');
  }, [index, relationship.newPerson, setFieldValue]);

  return relationship.action !== 'DELETE' ? (
    <div className={styles.relationship}>
      <div className={styles.relationshipHeader}>
        <h4 className={styles.productiveHeading}>{t('relationshipPlaceholder', 'Family member or companion')}</h4>
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
      <Checkbox
        id={`relationships[${index}].isCompanion`}
        labelText={t('isCompanionLabel', 'Is the patient companion')}
        checked={!!relationship.isCompanion}
        onChange={(_event, { checked }) => setFieldValue(`relationships[${index}].isCompanion`, checked)}
      />
      {requiresRelatedPerson ? (
        <div className={styles.personEntry}>
          <ContentSwitcher
            className={styles.personEntrySwitcher}
            size="sm"
            selectedIndex={personEntryMode === 'search' ? 0 : 1}
            onChange={handlePersonEntryModeChange}
          >
            <Switch name="search" text={t('searchExistingPerson', 'Search existing person')} />
            <Switch name="create" text={t('createResponsiblePerson', 'Register new person')} />
          </ContentSwitcher>
          {personEntryMode === 'search' ? (
            <div className={styles.searchBox}>
              <Autosuggest<PersonSearchResult>
                id={`relationships[${index}].relatedPersonUuid`}
                labelText={t('relativeFullNameLabelText', 'Full name')}
                placeholder={t('relativeNamePlaceholder', 'Firstname Familyname')}
                defaultValue={relationship.relatedPersonName}
                onSuggestionSelected={handleSuggestionSelected}
                invalid={isInvalid}
                invalidText={
                  selectedPersonInvalidText ??
                  t('relationshipPersonMustExist', 'Family member or companion must be an existing person')
                }
                getSearchResults={searchPerson}
                getDisplayValue={(item) => getPersonSearchResultDisplay(item)}
                getFieldValue={(item) => item.uuid}
              />
            </div>
          ) : (
            <div className={styles.responsiblePersonForm}>
              <div className={styles.responsiblePersonGrid}>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.givenName`}
                    labelText={t('responsibleGivenName', 'First name')}
                    value={newPersonValues.givenName}
                    maxLength={patientGivenNameMaxLength}
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
                    maxLength={patientGivenNameMaxLength}
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
                    maxLength={patientFamilyNameMaxLength}
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
                    maxLength={patientFamilyNameMaxLength}
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
                    labelText={
                      requiresAdultResponsible
                        ? t('responsibleEstimatedAgeRequiredLabel', 'Approximate age')
                        : t('responsibleEstimatedAge', 'Approximate age (optional)')
                    }
                    value={newPersonValues.estimatedAge}
                    inputMode="numeric"
                    maxLength={3}
                    onChange={handleNewPersonFieldChange('estimatedAge')}
                    onBlur={markNewPersonFieldTouched('estimatedAge')}
                    invalid={!!getFieldError('estimatedAge', personFormErrors)}
                    invalidText={getFieldError('estimatedAge', personFormErrors)}
                    required={requiresAdultResponsible}
                  />
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.phone`}
                    labelText={t('responsiblePhone', 'Phone or mobile phone (optional)')}
                    value={newPersonValues.phone}
                    inputMode="tel"
                    maxLength={20}
                    helperText={t('phoneHelperText', 'Enter digits only. Use +51 when including the country code.')}
                    onChange={handleNewPersonFieldChange('phone')}
                    onBlur={markNewPersonFieldTouched('phone')}
                    invalid={!!getFieldError('phone', personFormErrors)}
                    invalidText={getFieldError('phone', personFormErrors)}
                  />
                </Layer>
                <Layer>
                  <TextInput
                    id={`relationships[${index}].newPerson.address`}
                    labelText={t('responsibleAddress', 'Address (optional)')}
                    value={newPersonValues.address}
                    maxLength={255}
                    onChange={handleNewPersonFieldChange('address')}
                    onBlur={markNewPersonFieldTouched('address')}
                  />
                </Layer>
              </div>
              <div className={styles.createPersonActions}>
                <Button type="button" kind="tertiary" size="md" onClick={handleConfirmNewPerson}>
                  {t('confirmResponsiblePersonAction', 'Add person (saved on registration)')}
                </Button>
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
          {isPendingNewPerson ? (
            <>
              <p className={styles.labelText}>
                {t('pendingResponsiblePersonNote', 'New person. Will be created when the registration is saved.')}
              </p>
              <Button type="button" kind="ghost" size="sm" onClick={handleEditPendingPerson}>
                {t('editPendingResponsiblePerson', 'Edit person details')}
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  ) : (
    <InlineNotification kind="info" title={t('relationshipRemovedText', 'Family member or companion removed')}>
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
  const visibleRelationshipTypes = useMemo(
    () => getDisplayRelationshipTypes(displayRelationshipTypes, requiresResponsibleRelationship),
    [displayRelationshipTypes, requiresResponsibleRelationship],
  );

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
                title={t('responsibleRelationshipRequiredTitle', 'Responsible family member required')}
                subtitle={t(
                  'responsibleRelationshipRequiredForMinor',
                  'For minors, record a responsible family member, guardian, or legal representative.',
                )}
              />
            ) : null}
            {relationships && relationships.length > 0
              ? relationships.map((relationship: RelationshipValue, index) => (
                  <div key={getRelationshipKey(relationship)} className={sectionStyles.formSection}>
                    <RelationshipView
                      relationship={relationship}
                      index={index}
                      displayRelationshipTypes={visibleRelationshipTypes}
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
                {t('addRelationshipButtonText', 'Add family member or companion')}
              </Button>
            </div>
          </div>
        )}
      </FieldArray>
    </section>
  );
};
