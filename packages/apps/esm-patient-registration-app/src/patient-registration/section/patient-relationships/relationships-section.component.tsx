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
import {
  calculatePatientAge,
  MAX_PATIENT_AGE_YEARS,
  parsePatientBirthdate,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
} from '@openmrs/esm-utils';
import { FieldArray, useField } from 'formik';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { ResourcesContext } from '../../../offline.resources';
import fieldStyles from '../../field/field.scss';
import { Autosuggest } from '../../input/custom-input/autosuggest/autosuggest.component';
import { patientFamilyNameMaxLength, patientGivenNameMaxLength } from '../../patient-name-limits';
import { fetchPerson, type PersonSearchResult } from '../../patient-registration.resource';
import { type FormValues, type RelationshipValue } from '../../patient-registration.types';
import { PatientRegistrationContext } from '../../patient-registration-context';
import { getEffectiveRegistrationConfig } from '../../peru-registration-config';
import {
  hasMultipleFatherRelationships,
  hasMultiplePrimaryResponsiblePersons,
  hasRelatedPerson,
  hasResponsibleRelationship,
  hasResponsibleRelationshipWithUnknownAge,
  hasUnderageResponsibleRelationship,
  isMinorPatient,
} from '../../validation/patient-registration-validation';
import sectionStyles from '../section.scss';
import styles from './relationships.scss';
import {
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
  weight?: number;
}

interface RelationshipViewProps {
  relationship: RelationshipValue;
  index: number;
  displayRelationshipTypes: RelationshipType[];
  showValidationErrors?: boolean;
  showMissingPersonSelectionError?: boolean;
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
const nonFamilyRelationshipLabels = new Set([
  'acompanado',
  'acompanante',
  'accompanied person',
  'companion',
  'doctor',
  'paciente',
  'patient',
  'promotor de salud',
  'comunidad',
  'agente comunitario',
  'apu',
]);

const relationshipPriority: Record<string, number> = {
  madre: 10,
  mother: 10,
  padre: 20,
  father: 20,
  apoderado: 30,
  guardian: 30,
  esposa: 40,
  wife: 40,
  esposo: 41,
  husband: 41,
  pareja: 42,
  partner: 42,
  hija: 50,
  daughter: 50,
  hijo: 51,
  son: 51,
  hermana: 60,
  sister: 60,
  hermano: 61,
  brother: 61,
  abuela: 70,
  grandmother: 70,
  abuelo: 71,
  grandfather: 71,
  'aunt/uncle': 80,
  tia: 80,
  tio: 80,
  'niece/nephew': 90,
  sobrina: 90,
  sobrino: 90,
  otro: 1000,
  other: 1000,
};

const responsibleAgeInputConstraints = {
  integer: true,
  max: MAX_PATIENT_AGE_YEARS,
  min: 0,
  nonNegative: true,
};

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

function hasIncompleteRelationship(relationships: Array<RelationshipValue> | undefined) {
  return (
    relationships?.some(
      (relationship) =>
        relationship.action !== 'DELETE' && (!relationship.relationshipType || !hasRelatedPerson(relationship)),
    ) ?? false
  );
}

function isEmptyNewRelationship(relationship: RelationshipValue) {
  return (
    !relationship.uuid &&
    relationship.action === 'ADD' &&
    !relationship.relationshipType &&
    !relationship.relatedPersonUuid &&
    !relationship.newPerson
  );
}

function normalizeRelationshipLabel(label: string) {
  return label
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function getRelationshipLabelKey(label: string) {
  const normalizedLabel = normalizeRelationshipLabel(label);

  if (['aunt/uncle', 'aunt / uncle', 'aunt or uncle', 'tia', 'tio', 'tio/a'].includes(normalizedLabel)) {
    return 'aunt-uncle';
  }

  if (
    ['niece', 'nephew', 'niece/nephew', 'nephew/niece', 'nephew / niece', 'sobrina', 'sobrino', 'sobrino/a'].includes(
      normalizedLabel,
    )
  ) {
    return 'niece-nephew';
  }

  return normalizedLabel;
}

function getUniqueRelationshipTypes(relationshipTypes: Array<RelationshipType>) {
  const labels = new Set<string>();

  return relationshipTypes.filter((relationshipType) => {
    const normalizedLabel = getRelationshipLabelKey(relationshipType.display);

    if (!normalizedLabel || labels.has(normalizedLabel)) {
      return false;
    }

    labels.add(normalizedLabel);
    return true;
  });
}

function getRelationshipPriority(relationshipType: RelationshipType) {
  if (typeof relationshipType.weight === 'number' && relationshipType.weight > 0) {
    return relationshipType.weight;
  }

  return relationshipPriority[normalizeRelationshipLabel(relationshipType.display)] ?? 500;
}

function getDisplayRelationshipTypes(
  relationshipTypes: Array<RelationshipType>,
  isMinor: boolean,
  companionRelationshipTypeUuid?: string,
) {
  const uniqueRelationshipTypes = getUniqueRelationshipTypes(relationshipTypes)
    .filter((relationshipType) => {
      const normalizedLabel = normalizeRelationshipLabel(relationshipType.display);
      return (
        relationshipType.uuid !== companionRelationshipTypeUuid &&
        !nonFamilyRelationshipLabels.has(normalizedLabel) &&
        !normalizedLabel.startsWith('patient (')
      );
    })
    .sort((first, second) => {
      const priorityDifference = getRelationshipPriority(first) - getRelationshipPriority(second);
      return priorityDifference || first.display.localeCompare(second.display, 'es');
    });

  if (!isMinor) {
    return uniqueRelationshipTypes;
  }

  return uniqueRelationshipTypes.filter(
    (relationshipType) =>
      !invalidMinorResponsibleRelationshipLabels.has(normalizeRelationshipLabel(relationshipType.display)),
  );
}

function getLocalizedRelationshipLabel(label: string, t: ReturnType<typeof useTranslation>['t']) {
  const normalizedLabel = normalizeRelationshipLabel(label);

  if (['aunt/uncle', 'aunt / uncle', 'aunt or uncle'].includes(normalizedLabel)) {
    return t('relationshipAuntUncleLabel', 'Aunt/Uncle');
  }

  if (['niece', 'nephew', 'niece/nephew', 'nephew/niece', 'nephew / niece'].includes(normalizedLabel)) {
    return t('relationshipNephewNieceLabel', 'Niece/Nephew');
  }

  return label;
}

function getAgeFromBirthdate(birthdate?: string) {
  const parsedBirthdate = birthdate ? parsePatientBirthdate(birthdate) : null;
  return parsedBirthdate ? (calculatePatientAge(parsedBirthdate) ?? undefined) : undefined;
}

function preventInvalidResponsibleAgeKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key, responsibleAgeInputConstraints)) {
    event.preventDefault();
  }
}

function preventInvalidResponsibleAgePaste(event: React.ClipboardEvent<HTMLInputElement>) {
  if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), responsibleAgeInputConstraints)) {
    event.preventDefault();
  }
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

function sanitizeEstimatedAgeInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 3);
}

const RelationshipView: React.FC<RelationshipViewProps> = ({
  relationship,
  index,
  displayRelationshipTypes,
  showValidationErrors = false,
  showMissingPersonSelectionError = false,
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
  const showMissingExistingPersonError =
    personEntryMode === 'search' && requiresRelatedPerson && showMissingPersonSelectionError;
  const isPendingNewPerson = !relationship.relatedPersonUuid && !!relationship.newPerson;
  const genderOptions = config?.fieldConfigurations?.gender ?? defaultGenderOptions;
  const minorResponsibleRelationshipTypes =
    effectiveConfig?.relationshipOptions?.minorResponsibleRelationshipTypes ?? [];
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
      setFieldValue(`relationships[${index}].relation`, target.options[target.selectedIndex].text);
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
      const selectedPersonAge = getPersonSearchResultAge(selectedPersonResult);
      setSelectedExistingPerson(selectedPersonResult ?? null);
      const selectedPersonIsUnderage =
        requiresAdultResponsible && typeof selectedPersonAge === 'number' && selectedPersonAge < 18;
      const selectedPersonAgeIsUnknown = requiresAdultResponsible && typeof selectedPersonAge !== 'number';

      if (selectedPersonIsUnderage || selectedPersonAgeIsUnknown) {
        setIsInvalid(true);
        setSelectedPersonInvalidText(
          selectedPersonAgeIsUnknown
            ? t('responsiblePersonAgeUnknown', 'The responsible person must have a known age or date of birth')
            : t('responsibleExistingPersonMustBeAdult', 'Responsible person must be an adult'),
        );
        setFieldValue(field, '');
        setFieldValue(`relationships[${index}].relatedPersonName`, '');
        setFieldValue(`relationships[${index}].relatedPersonAge`, undefined);
        setFieldValue(`relationships[${index}].relatedPersonBirthdate`, undefined);
        setFieldValue(`relationships[${index}].relatedPersonBirthdateEstimated`, undefined);
        return;
      }

      setSelectedPersonInvalidText(null);
      setIsInvalid(!selectedSuggestion);
      setFieldValue(field, selectedSuggestion ?? '');
      setFieldValue(
        `relationships[${index}].relatedPersonName`,
        selectedSuggestion ? getPersonSearchResultDisplay(selectedPersonResult) : '',
      );
      setFieldValue(`relationships[${index}].relatedPersonAge`, selectedPersonAge);
      setFieldValue(
        `relationships[${index}].relatedPersonBirthdate`,
        selectedPersonResult?.person?.birthdate ?? selectedPersonResult?.birthdate,
      );
      setFieldValue(
        `relationships[${index}].relatedPersonBirthdateEstimated`,
        selectedPersonResult?.person?.birthdateEstimated ?? selectedPersonResult?.birthdateEstimated,
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
      setFieldValue(`relationships[${index}].relatedPersonAge`, undefined);
      setFieldValue(`relationships[${index}].relatedPersonBirthdate`, undefined);
      setFieldValue(`relationships[${index}].relatedPersonBirthdateEstimated`, undefined);
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
        [field]:
          field === 'phone'
            ? sanitizePhoneInput(event.target.value)
            : field === 'estimatedAge'
              ? sanitizeEstimatedAgeInput(event.target.value)
              : event.target.value,
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
      (showValidationErrors || touchedFields[field]) && errors[field] ? t(errors[field], errors[field]) : undefined,
    [showValidationErrors, t, touchedFields],
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
      <div className={styles.relationshipTypeRow}>
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
      </div>
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
                invalid={isInvalid || showMissingExistingPersonError}
                invalidText={
                  showMissingExistingPersonError
                    ? t('responsibleExistingPersonRequired', 'Select an existing person')
                    : (selectedPersonInvalidText ??
                      t('relationshipPersonMustExist', 'Family member or companion must be an existing person'))
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
                    type="number"
                    labelText={
                      requiresAdultResponsible
                        ? t('responsibleEstimatedAgeRequiredLabel', 'Approximate age')
                        : t('responsibleEstimatedAge', 'Approximate age (optional)')
                    }
                    value={newPersonValues.estimatedAge}
                    min={requiresAdultResponsible ? 18 : 0}
                    max={MAX_PATIENT_AGE_YEARS}
                    onKeyDown={preventInvalidResponsibleAgeKey}
                    onPaste={preventInvalidResponsibleAgePaste}
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
                  {t('confirmResponsiblePersonAction', 'Save companion or responsible person')}
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
              <p className={styles.labelText}>{t('pendingResponsiblePersonNote', 'Will be saved with the patient.')}</p>
              <Button type="button" kind="ghost" size="sm" onClick={handleEditPendingPerson}>
                {t('editPendingResponsiblePerson', 'Edit companion or responsible person')}
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

interface PrimaryResponsibleSectionProps {
  relationships?: Array<RelationshipValue>;
  setFieldValue: (field: string, value: unknown) => void;
}

const PrimaryResponsibleSection: React.FC<PrimaryResponsibleSectionProps> = ({ relationships = [], setFieldValue }) => {
  const { t } = useTranslation(moduleName);
  const availableRelationships = relationships
    .map((relationship, index) => ({ relationship, index }))
    .filter(
      ({ relationship }) =>
        relationship.action !== 'DELETE' && !!relationship.relationshipType && hasRelatedPerson(relationship),
    );

  const handlePrimaryResponsibleChange = useCallback(
    (selectedIndex: number, checked: boolean) => {
      relationships.forEach((relationship, index) => {
        const shouldBePrimary = checked && index === selectedIndex;
        if (!!relationship.isCompanion === shouldBePrimary) {
          return;
        }

        setFieldValue(`relationships[${index}].isCompanion`, shouldBePrimary);
        if (relationship.uuid && relationship.action !== 'ADD' && relationship.action !== 'DELETE') {
          setFieldValue(`relationships[${index}].action`, 'UPDATE');
        }
      });
    },
    [relationships, setFieldValue],
  );

  return (
    <div className={styles.relationshipSection}>
      <div className={styles.sectionHeading}>
        <h3>{t('patientResponsibleSection', 'Patient responsible person')}</h3>
        <p>{t('patientResponsibleHelpText', 'Select only one person as the primary responsible person.')}</p>
      </div>
      {hasMultiplePrimaryResponsiblePersons(relationships) ? (
        <InlineNotification
          kind="error"
          lowContrast
          title={t('patientCanOnlyHaveOnePrimaryResponsible', 'Select only one primary responsible person')}
        />
      ) : null}
      {availableRelationships.length ? (
        <div className={styles.responsibleOptions}>
          {availableRelationships.map(({ relationship, index }) => {
            const personName =
              relationship.relatedPersonName ||
              (relationship.newPerson ? getResponsiblePersonDisplayName(relationship.newPerson) : '');
            const relationshipLabel = relationship.relation ? ` · ${relationship.relation}` : '';

            return (
              <Checkbox
                key={`responsible-${getRelationshipKey(relationship)}`}
                id={`relationships[${index}].isCompanion`}
                labelText={`${personName}${relationshipLabel}`}
                checked={!!relationship.isCompanion}
                onChange={(_event, { checked }) => handlePrimaryResponsibleChange(index, checked)}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.emptyResponsibleText}>
          {t(
            'patientResponsibleEmptyText',
            'Add a patient family link before selecting the primary responsible person.',
          )}
        </p>
      )}
    </div>
  );
};

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
  const previouslyRequiredResponsibleRelationship = useRef(false);
  const [, relationshipsMeta] = useField<Array<RelationshipValue>>('relationships');
  const { t } = useTranslation(moduleName);
  const requiresResponsibleRelationship = isMinorPatient(values);
  const minorResponsibleRelationshipTypes = config?.relationshipOptions?.minorResponsibleRelationshipTypes ?? [];
  const companionRelationshipTypeUuid = config?.relationshipOptions?.companionRelationshipType?.split('/')[0];
  const hasRelationshipTypes = !!relationshipTypeResults?.length;
  const hasUnderageResponsible = hasUnderageResponsibleRelationship(
    values.relationships,
    minorResponsibleRelationshipTypes,
  );
  const hasAdultResponsible = hasResponsibleRelationship(values.relationships, minorResponsibleRelationshipTypes);
  const hasResponsibleWithUnknownAge = hasResponsibleRelationshipWithUnknownAge(
    values.relationships,
    minorResponsibleRelationshipTypes,
  );
  const unknownResponsibleAgeError =
    relationshipsMeta.touched && requiresResponsibleRelationship && hasResponsibleWithUnknownAge
      ? t('responsiblePersonAgeUnknown', 'The responsible person must have a known age or date of birth')
      : null;
  const missingResponsibleRelationshipError =
    relationshipsMeta.touched &&
    requiresResponsibleRelationship &&
    !hasUnderageResponsible &&
    !hasResponsibleWithUnknownAge &&
    !hasAdultResponsible
      ? t(
          'responsibleRelationshipRequiredForMinor',
          'For minors, record a responsible family member, guardian, or legal representative.',
        )
      : null;
  const relationshipError =
    unknownResponsibleAgeError ??
    missingResponsibleRelationshipError ??
    (relationshipsMeta.touched && typeof relationshipsMeta.error === 'string' ? relationshipsMeta.error : null);
  const visibleRelationshipTypes = useMemo(
    () =>
      getDisplayRelationshipTypes(
        displayRelationshipTypes,
        requiresResponsibleRelationship,
        companionRelationshipTypeUuid,
      ),
    [companionRelationshipTypeUuid, displayRelationshipTypes, requiresResponsibleRelationship],
  );

  useEffect(() => {
    if (hasRelationshipTypes) {
      const tmp: RelationshipType[] = [];
      relationshipTypeResults.forEach((type) => {
        const aIsToB = {
          display: getLocalizedRelationshipLabel(type.displayAIsToB || type.displayBIsToA || '', t),
          uuid: type.uuid,
          direction: 'aIsToB',
          weight: type.weight,
        };
        const bIsToA = {
          display: getLocalizedRelationshipLabel(type.displayBIsToA || type.displayAIsToB || '', t),
          uuid: type.uuid,
          direction: 'bIsToA',
          weight: type.weight,
        };
        aIsToB.display === bIsToA.display
          ? tmp.push(aIsToB)
          : bIsToA.display === 'Patient'
            ? tmp.push(aIsToB, { display: `Patient (${aIsToB.display})`, uuid: type.uuid, direction: 'bIsToA' })
            : tmp.push(aIsToB, bIsToA);
      });
      setDisplayRelationshipTypes(tmp);
    }
  }, [hasRelationshipTypes, relationshipTypeResults, t]);

  useEffect(() => {
    const wasRequired = previouslyRequiredResponsibleRelationship.current;
    previouslyRequiredResponsibleRelationship.current = requiresResponsibleRelationship;

    if (wasRequired && !requiresResponsibleRelationship && setFieldValue) {
      const relationships = values.relationships ?? [];
      const completedOrEditedRelationships = relationships.filter(
        (relationship) => !isEmptyNewRelationship(relationship),
      );

      if (completedOrEditedRelationships.length !== relationships.length) {
        setFieldValue('relationships', completedOrEditedRelationships, true);
      }
      setHasSeededDefaultRelationship(false);
    }
  }, [requiresResponsibleRelationship, setFieldValue, values.relationships]);

  useEffect(() => {
    if (
      defaultNewRelationship &&
      requiresResponsibleRelationship &&
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
    requiresResponsibleRelationship,
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
            submitCount,
            values: { relationships },
          },
        }) => (
          <div>
            <div className={styles.relationshipSection}>
              <div className={styles.sectionHeading}>
                <h3>{t('patientFamilyLinksSection', 'Patient family links')}</h3>
                <p>{t('patientFamilyLinksHelpText', 'Add the family members linked to the patient.')}</p>
              </div>
              {relationshipError ? (
                <div className={`${fieldStyles.fieldError} ${styles.sectionError}`} role="alert">
                  {relationshipError}
                </div>
              ) : null}
              {hasIncompleteRelationship(relationships) ? (
                <InlineNotification
                  kind="warning"
                  lowContrast
                  title={t('incompleteRelationshipTitle', 'Complete the pending family link')}
                  subtitle={t(
                    'incompleteRelationshipHelpText',
                    'Select the relationship and the related person before adding another family link.',
                  )}
                />
              ) : null}
              {hasMultipleFatherRelationships(relationships) ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('patientCanOnlyHaveOneFather', 'The patient can only have one father')}
                />
              ) : null}
              {requiresResponsibleRelationship &&
              hasUnderageResponsibleRelationship(relationships, minorResponsibleRelationshipTypes) ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('responsiblePersonMustBeAdult', 'Responsible person must be an adult')}
                  subtitle={t(
                    'responsiblePersonMustBeAdultHelpText',
                    'A minor cannot be assigned as the responsible person for another minor.',
                  )}
                />
              ) : requiresResponsibleRelationship &&
                !hasResponsibleRelationship(relationships, minorResponsibleRelationshipTypes) &&
                !hasIncompleteRelationship(relationships) &&
                !relationshipsMeta.touched ? (
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
                        showValidationErrors={submitCount > 0 || !!relationshipsMeta.touched}
                        showMissingPersonSelectionError={
                          (submitCount > 0 || !!relationshipsMeta.touched) && !hasRelatedPerson(relationship)
                        }
                        remove={remove}
                      />
                    </div>
                  ))
                : null}
              <div className={styles.actions}>
                <Button
                  kind="ghost"
                  disabled={hasIncompleteRelationship(relationships)}
                  onClick={() =>
                    push({
                      clientId: getRelationshipClientId(),
                      relatedPersonUuid: '',
                      action: 'ADD',
                    })
                  }
                >
                  {t('addFamilyLinkButtonText', 'Add family link')}
                </Button>
              </div>
            </div>
            <PrimaryResponsibleSection relationships={relationships} setFieldValue={setFieldValue} />
          </div>
        )}
      </FieldArray>
    </section>
  );
};
