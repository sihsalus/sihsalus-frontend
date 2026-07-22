/**
 * Patient Search and Quick Registration Component
 *
 * Streamlined interface for emergency patient registration:
 * - Smart search: name, HCE, or identity document
 * - Inline quick registration when patient not found
 * - Inline initial priority selector (Emergencia/Urgencia)
 * - Single "Enviar a cola de triaje" button
 * - NO modals - everything inline for speed
 */

import {
  Button,
  ContentSwitcher,
  Form,
  InlineLoading,
  InlineNotification,
  Layer,
  Loading,
  Search,
  Select,
  SelectItem,
  Stack,
  Switch,
  Tag,
  TextArea,
  TextInput,
  Tile,
} from '@carbon/react';
import { CheckmarkFilled, SendFilled, User, UserFollow } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { age, OpenmrsDatePicker, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  calendarDateToLocalDate,
  estimatePatientBirthdateFromAge,
  getLocalCalendarDate,
  getOldestAllowedPatientBirthdate,
  getPreferredIdentifier,
  MAX_PATIENT_AGE_YEARS,
  parsePatientBirthdate,
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Config } from '../config-schema';
import { generateIdentifier, saveEmergencyPatient } from '../resources/patient-registration.resource';
import { EmergencyNationalityField } from './components/emergency-nationality-field.component';
import InitialPrioritySelector, { type InitialPriority } from './components/initial-priority-selector.component';
import { getEmergencyIdentityDocumentTypes } from './emergency-identity-documents';
import { useInsuranceTypeConceptAnswers } from './insurance-type.resource';
import { getAutomaticNationalityUpdate, isCompletedPeruDni } from './patient-nationality';
import { useNationalityConceptAnswers } from './patient-nationality.resource';
import { buildEmergencyPatientAttributes } from './patient-registration-attributes';
import styles from './patient-search-registration.component.scss';
import {
  communicationConditionLabels,
  communicationConditionOptions,
  identificationStatusLabels,
  identificationStatusOptions,
  type QuickRegistrationFormData,
  quickRegistrationSchema,
  responsibleTypeLabels,
  responsibleTypeOptions,
} from './patient-search-registration.validation';
import type { SearchedPatient } from './types';
import { usePatientSearch } from './usePatientSearch';

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface PatientSearchRegistrationProps {
  onPatientQueued: (
    patientUuid: string,
    patientData: SearchedPatient,
    priorityLevel: InitialPriority,
  ) => Promise<void> | void;
}

const ageInputConstraints = { integer: true, max: MAX_PATIENT_AGE_YEARS, min: 0, nonNegative: true };

interface RegistrationSubmitError {
  status?: number;
  responseStatus?: number;
  message?: string;
  responseBody?: {
    error?: {
      message?: string;
    };
  };
}

function isSessionExpired(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const typedError = error as RegistrationSubmitError;
  const status = typedError.status ?? typedError.responseStatus;
  const lowerCaseMessage = `${typedError.message ?? ''} ${typedError.responseBody?.error?.message ?? ''}`.toLowerCase();

  return (
    status === 401 || status === 403 || lowerCaseMessage.includes('session') || lowerCaseMessage.includes('expired')
  );
}

function formatGenderLabel(gender?: string) {
  switch (gender) {
    case 'M':
      return 'M';
    case 'F':
      return 'F';
    case 'U':
      return 'No determinado';
    default:
      return '';
  }
}

function preventInvalidAgeKey(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key, ageInputConstraints)) {
    event.preventDefault();
  }
}

function preventInvalidAgePaste(event: React.ClipboardEvent<HTMLInputElement>) {
  if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), ageInputConstraints)) {
    event.preventDefault();
  }
}

function getBirthdatePickerValue(value?: string) {
  const birthdate = value ? parsePatientBirthdate(value) : null;
  return birthdate ? (calendarDateToLocalDate(birthdate) ?? undefined) : undefined;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PatientSearchRegistration: React.FC<PatientSearchRegistrationProps> = ({ onPatientQueued }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const {
    data: nationalityOptions,
    error: nationalityOptionsError,
    isLoading: isLoadingNationalityOptions,
  } = useNationalityConceptAnswers(config.patientRegistration.nationalityConceptSetUuid);
  const allowedNationalityConceptUuids = useMemo(
    () => (nationalityOptions ? new Set(nationalityOptions.map((option) => option.uuid)) : undefined),
    [nationalityOptions],
  );
  const {
    data: insuranceTypeOptions,
    error: insuranceTypeOptionsError,
    isLoading: isLoadingInsuranceTypeOptions,
  } = useInsuranceTypeConceptAnswers(config.patientRegistration.insuranceTypeConceptSetUuid);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SearchedPatient | null>(null);

  // Patient search hook
  const {
    data: searchResults,
    isLoading,
    fetchError,
    hasMore,
    isValidating,
    setPage,
    totalResults,
  } = usePatientSearch(searchQuery, false, !!searchQuery, 10);

  // Registration state
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [isPatientUnknown, setIsPatientUnknown] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState<SearchedPatient | null>(null);

  // Priority state
  const [initialPriority, setInitialPriority] = useState<InitialPriority | undefined>('emergency');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The patient ready to be queued (either selected or registered)
  const readyPatient = selectedPatient || registeredPatient;
  const identityDocumentTypes = useMemo(
    () => getEmergencyIdentityDocumentTypes(config.patientRegistration),
    [config.patientRegistration],
  );

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
    watch,
  } = useForm<QuickRegistrationFormData>({
    resolver: zodResolver(quickRegistrationSchema),
    defaultValues: {
      isUnknown: false,
      identifierType: config.patientRegistration.defaultIdentifierTypeUuid,
      nationality: '',
      arrivalDateTime: dayjs().format('YYYY-MM-DDTHH:mm'),
      communicationCondition: 'communicates',
      identificationStatus: 'confirmed',
      responsibleType: '',
      district: 'NAPO',
      village: 'SANTA CLOTILDE',
      address: '',
    },
  });
  const selectedIdentifierType = watch('identifierType');
  const identifierValue = watch('identifier');
  const nationalityValue = watch('nationality');
  const nationalityWasAutoAssigned = useRef(false);
  const hasCompletedDni =
    !isPatientUnknown &&
    selectedIdentifierType === config.patientRegistration.defaultIdentifierTypeUuid &&
    isCompletedPeruDni(identifierValue);
  const canAutomaticallyAssignPeru =
    hasCompletedDni && allowedNationalityConceptUuids?.has(config.patientRegistration.peruNationalityConceptUuid);
  const shouldLockNationalityToPeru =
    Boolean(canAutomaticallyAssignPeru) &&
    (!nationalityValue || nationalityValue === config.patientRegistration.peruNationalityConceptUuid);

  useEffect(() => {
    const update = getAutomaticNationalityUpdate({
      currentNationality: nationalityValue,
      hasCompletedDni: Boolean(canAutomaticallyAssignPeru),
      isUnknown: isPatientUnknown,
      peruConceptUuid: config.patientRegistration.peruNationalityConceptUuid,
      wasAutoAssigned: nationalityWasAutoAssigned.current,
    });

    nationalityWasAutoAssigned.current = update.wasAutoAssigned;
    if (update.shouldUpdate) {
      setValue('nationality', update.nationality, { shouldDirty: true, shouldValidate: true });
    }
  }, [
    config.patientRegistration.peruNationalityConceptUuid,
    canAutomaticallyAssignPeru,
    isPatientUnknown,
    nationalityValue,
    setValue,
  ]);

  // Infinite scroll observer
  const observer = useRef<IntersectionObserver | null>(null);
  const loadingIconRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isValidating) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPage((page) => page + 1);
          }
        },
        { threshold: 0.75 },
      );
      if (node) observer.current.observe(node);
    },
    [isValidating, hasMore, setPage],
  );

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  // ============================================================================
  // SEARCH LOGIC
  // ============================================================================

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchQuery('');
    setSelectedPatient(null);
    setRegisteredPatient(null);
    setShowRegistrationForm(false);
    setInitialPriority(undefined);
  }, []);

  const handleSelectPatient = useCallback((patient: SearchedPatient) => {
    setSelectedPatient(patient);
    setRegisteredPatient(null);
    setShowRegistrationForm(false);
  }, []);

  const handleDeselectPatient = useCallback(() => {
    setSelectedPatient(null);
    setRegisteredPatient(null);
    setInitialPriority(undefined);
  }, []);

  const handleOpenRegistrationForm = useCallback(
    (unknownPatient = false) => {
      nationalityWasAutoAssigned.current = false;
      setSelectedPatient(null);
      setRegisteredPatient(null);
      setShowRegistrationForm(true);
      setIsPatientUnknown(unknownPatient);
      reset({
        isUnknown: unknownPatient,
        givenName: unknownPatient ? 'DESCONOCIDO' : '',
        familyName: unknownPatient ? 'DESCONOCIDO' : '',
        familyName2: '',
        identifierType: config.patientRegistration.defaultIdentifierTypeUuid,
        nationality: '',
        arrivalDateTime: dayjs().format('YYYY-MM-DDTHH:mm'),
        communicationCondition: unknownPatient ? '' : 'communicates',
        identificationStatus: unknownPatient ? 'pending' : 'confirmed',
        responsibleType: '',
        district: 'NAPO',
        village: 'SANTA CLOTILDE',
        address: '',
      });
    },
    [config.patientRegistration.defaultIdentifierTypeUuid, reset],
  );

  // Debounced search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const timer = setTimeout(() => {
        setSearchQuery(searchTerm.trim());
        setShowRegistrationForm(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (searchTerm.length === 0) {
      setSearchQuery('');
    }
  }, [searchTerm]);

  // Unknown patient toggle
  const handleUnknownPatientToggle = useCallback(
    (e: { name: string }) => {
      if (e.name === 'known') {
        setIsPatientUnknown(false);
        setValue('isUnknown', false);
        setValue('givenName', '');
        setValue('familyName', '');
        setValue('familyName2', '');
        setValue('communicationCondition', 'communicates');
        setValue('identificationStatus', 'confirmed');
      } else {
        nationalityWasAutoAssigned.current = false;
        setIsPatientUnknown(true);
        setValue('isUnknown', true);
        setValue('givenName', 'DESCONOCIDO');
        setValue('familyName', 'DESCONOCIDO');
        setValue('familyName2', '');
        setValue('nationality', '', { shouldDirty: true, shouldValidate: true });
        setValue('communicationCondition', '');
        setValue('identificationStatus', 'pending');
      }
    },
    [setValue],
  );

  // ============================================================================
  // REGISTRATION LOGIC
  // ============================================================================

  const onSubmitRegistration = useCallback(
    async (data: QuickRegistrationFormData) => {
      setIsRegistering(true);
      try {
        // Validate and build attributes before consuming an identifier from idgen.
        const attributes = buildEmergencyPatientAttributes(
          data,
          config.patientRegistration,
          allowedNationalityConceptUuids,
        );

        // 1. Generar OpenMRS ID vía idgen (needed early for unknown patient name)
        const idGenResponse = await generateIdentifier(config.patientRegistration.identifierSourceUuid);
        const openmrsId = idGenResponse.data.identifier;

        // 2. Determine patient name
        // For unknown patients, append OpenMRS ID to differentiate: "DESCONOCIDO (10045)"
        let givenName = data.givenName;
        let familyName = data.familyName;
        let familyName2 = data.familyName2 ?? '';
        if (data.isUnknown) {
          givenName = 'DESCONOCIDO';
          familyName = `(${openmrsId})`;
          familyName2 = '';
        }

        // 3. Calcular birthdate
        let calculatedBirthdate: string | undefined;
        let birthdateEstimated = true;
        if (data.birthdate) {
          calculatedBirthdate = data.birthdate;
          birthdateEstimated = false;
        } else if (data.yearsEstimated != null) {
          calculatedBirthdate = estimatePatientBirthdateFromAge(data.yearsEstimated) ?? undefined;
        }

        // 4. Construir array de identifiers
        const identifiers: Array<{
          identifier: string;
          identifierType: string;
          location: string;
          preferred: boolean;
        }> = [
          {
            identifier: openmrsId,
            identifierType: config.patientRegistration.openMrsIdIdentifierTypeUuid,
            location: config.patientRegistration.defaultLocationUuid,
            preferred: true,
          },
        ];

        // Si el usuario ingresó un documento de identidad, agregarlo como identifier clínico-administrativo.
        if (data.identifier) {
          identifiers.push({
            identifier: data.identifier,
            identifierType: data.identifierType || config.patientRegistration.defaultIdentifierTypeUuid,
            location: config.patientRegistration.defaultLocationUuid,
            preferred: false,
          });
        }

        // 6. Build address
        const addressObj: Record<string, string> = {
          country: 'PERU',
          address1: 'LORETO',
          stateProvince: 'MAYNAS',
        };
        if (data.district) addressObj.countyDistrict = data.district;
        if (data.village) addressObj.cityVillage = data.village;
        if (data.address) addressObj.address4 = data.address;

        // 7. Construir payload del paciente
        const personPayload: Record<string, unknown> = {
          names: [{ givenName, familyName, ...(familyName2 ? { familyName2 } : {}), preferred: true }],
          gender: data.gender,
          birthdateEstimated,
          attributes,
          addresses: [addressObj],
          dead: false,
        };
        if (calculatedBirthdate) {
          personPayload.birthdate = calculatedBirthdate;
        }

        const patientPayload = {
          person: personPayload,
          identifiers,
        };

        // 7. Crear paciente en el backend
        const response = await saveEmergencyPatient(patientPayload);
        const savedPatient = response.data;

        const savedPatientIdentifiers = Array.isArray(savedPatient.identifiers)
          ? savedPatient.identifiers
              .map((identifier) => ({
                uuid: identifier.uuid ?? '',
                identifier: identifier.identifier || identifier.display || '',
                identifierType: identifier.identifierType,
              }))
              .filter((identifier) => identifier.identifier)
          : [];

        const fallbackIdentifiers = identifiers.map(
          (id: { identifier: string; identifierType: string }, i: number) => ({
            uuid: `temp-${i}`,
            identifier: id.identifier,
            identifierType: {
              uuid: id.identifierType,
              display:
                i === 0
                  ? t('medicalRecordNumber', 'HCE / code')
                  : identityDocumentTypes.find((type) => type.value === id.identifierType)?.label,
            },
          }),
        );

        // 8. Mapear respuesta al formato SearchedPatient
        const displayName = [familyName, familyName2, givenName].filter(Boolean).join(' ');
        const newPatient = {
          uuid: savedPatient.uuid,
          display: savedPatient.display || displayName,
          identifiers: savedPatientIdentifiers.length > 0 ? savedPatientIdentifiers : fallbackIdentifiers,
          person: {
            age: data.yearsEstimated ?? undefined,
            gender: data.gender,
            birthdate: calculatedBirthdate,
            birthdateEstimated,
            display: displayName,
            personName: {
              givenName,
              familyName,
              familyName2: familyName2 || undefined,
              display: displayName,
            },
          },
          emergencyRegistrationContext: {
            arrivalDateTime: data.arrivalDateTime,
            communicationCondition: data.communicationCondition,
            identificationStatus: data.identificationStatus,
            responsibleType: data.responsibleType,
            companionName: data.companionName,
            companionRelationship: data.companionRelationship,
            administrativeNotes: data.administrativeNotes,
          },
        };

        showSnackbar({
          title: t('patientRegistered', 'Paciente registrado'),
          subtitle: displayName,
          kind: 'success',
          timeoutInMs: 3000,
        });

        setRegisteredPatient(newPatient);
        setShowRegistrationForm(false);
      } catch (error: unknown) {
        const isExpiredSession = isSessionExpired(error);

        showSnackbar({
          title: t('errorRegisteringPatient', 'Error al registrar paciente'),
          subtitle: isExpiredSession
            ? t('sessionExpiredError', 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.')
            : error instanceof Error
              ? error.message
              : t('unknownError', 'Error desconocido'),
          kind: 'error',
        });
      } finally {
        setIsRegistering(false);
      }
    },
    [t, config, identityDocumentTypes, allowedNationalityConceptUuids],
  );

  // ============================================================================
  // SUBMIT TO QUEUE
  // ============================================================================

  const handleSendToQueue = useCallback(async () => {
    if (!readyPatient || !initialPriority) return;
    setIsSubmitting(true);
    try {
      await onPatientQueued(readyPatient.uuid, readyPatient, initialPriority);
    } finally {
      setIsSubmitting(false);
    }
  }, [readyPatient, initialPriority, onPatientQueued]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const maximumBirthdate = new Date();
  const oldestAllowedBirthdate = getOldestAllowedPatientBirthdate(getLocalCalendarDate(maximumBirthdate));
  const minimumBirthdate = oldestAllowedBirthdate
    ? (calendarDateToLocalDate(oldestAllowedBirthdate) ?? undefined)
    : undefined;

  return (
    <div className={styles.container}>
      <Stack gap={6}>
        {/* Header */}
        <div className={styles.header}>
          <h4>{t('quickEmergencyRegistration', 'Registro rápido de emergencias')}</h4>
          <p className={styles.subtitle}>
            {t(
              'searchOrRegisterDescription',
              'Busque un paciente existente o registre uno nuevo para enviarlo a la cola de triaje.',
            )}
          </p>
        </div>

        {/* Search Section - hidden when patient is ready */}
        {!readyPatient && (
          <>
            <Layer className={styles.searchSection}>
              <Search
                id="patient-search"
                labelText={t('searchPatient', 'Buscar paciente')}
                placeholder={t('enterNameIdOrDni', 'Nombre, HCE o documento...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="lg"
                closeButtonLabelText={t('clearSearch', 'Limpiar')}
                onClear={handleClearSearch}
              />
              {isLoading && <InlineLoading description={t('searchingPatients', 'Buscando...')} />}
              <div className={styles.quickActions}>
                <Button kind="tertiary" renderIcon={UserFollow} onClick={() => handleOpenRegistrationForm()} size="sm">
                  {t('registerNewPatient', 'Registrar nuevo paciente')}
                </Button>
                <Button
                  className={styles.unidentifiedPatientButton}
                  kind="tertiary"
                  renderIcon={UserFollow}
                  onClick={() => handleOpenRegistrationForm(true)}
                  size="sm"
                >
                  {t('registerUnidentifiedPatient', 'Registrar paciente no identificado / incapaz')}
                </Button>
              </div>
            </Layer>

            {/* Search Results */}
            {searchQuery && searchResults && searchResults.length > 0 && (
              <div className={styles.resultsSection}>
                <p className={styles.resultsCount}>
                  {t('resultsFound', '{{count}} resultado(s)', { count: totalResults })}
                </p>
                <Stack gap={3}>
                  {searchResults.map((patient) => {
                    const preferredIdentifier = getPreferredIdentifier(patient.identifiers ?? []);

                    return (
                      <Layer key={patient.uuid}>
                        <Tile className={styles.patientResultTile} onClick={() => handleSelectPatient(patient)}>
                          <div className={styles.patientResult}>
                            <User size={24} className={styles.patientIcon} />
                            <div className={styles.patientResultInfo}>
                              <p className={styles.patientResultName}>
                                {patient.person?.personName?.display || patient.display}
                              </p>
                              <div className={styles.patientResultMeta}>
                                <span>
                                  {patient.person?.birthdate ? (age(patient.person.birthdate) ?? '?') : '?'}
                                </span>
                                <span className={styles.separator}>|</span>
                                <span>{formatGenderLabel(patient.person?.gender) || t('unknown', 'Desconocido')}</span>
                                {preferredIdentifier && (
                                  <>
                                    <span className={styles.separator}>|</span>
                                    <span>
                                      {preferredIdentifier.identifierType?.display}: {preferredIdentifier.identifier}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </Tile>
                      </Layer>
                    );
                  })}
                  {hasMore && (
                    <div className={styles.loadingIcon} ref={loadingIconRef}>
                      <Loading withOverlay={false} small />
                    </div>
                  )}
                </Stack>
              </div>
            )}

            {/* No Results */}
            {searchQuery && !isLoading && searchResults && searchResults.length === 0 && !showRegistrationForm && (
              <Stack gap={4}>
                <InlineNotification
                  kind="warning"
                  lowContrast
                  hideCloseButton
                  title={t('patientNotFound', 'Paciente no encontrado')}
                  subtitle={t('noResultsFor', 'Sin resultados para "{{term}}"', { term: searchQuery })}
                />
                <Button kind="tertiary" renderIcon={UserFollow} onClick={() => handleOpenRegistrationForm()} size="md">
                  {t('registerNewPatient', 'Registrar nuevo paciente')}
                </Button>
              </Stack>
            )}

            {/* Error */}
            {fetchError && (
              <InlineNotification
                kind="error"
                lowContrast
                hideCloseButton
                title={t('errorSearching', 'Error en búsqueda')}
                subtitle={fetchError.message}
              />
            )}

            {/* Quick Registration Form */}
            {showRegistrationForm && (
              <Layer>
                <Tile className={styles.registrationTile}>
                  <Stack gap={5}>
                    <div className={styles.registrationHeader}>
                      <UserFollow size={20} />
                      <h5>{t('quickRegistration', 'Registro rápido')}</h5>
                    </div>

                    <InlineNotification
                      kind="info"
                      lowContrast
                      hideCloseButton
                      subtitle={t('emergencyNote', 'Datos mínimos para emergencia. El perfil se completa después.')}
                    />

                    <Form onSubmit={handleSubmit(onSubmitRegistration)}>
                      <Stack gap={4}>
                        {/* Unknown patient toggle */}
                        <div className={styles.unknownPatientSection}>
                          <span className={styles.label01}>{t('nameKnown', 'Nombre conocido?')}</span>
                          <ContentSwitcher
                            size="sm"
                            className={styles.contentSwitcher}
                            selectedIndex={isPatientUnknown ? 1 : 0}
                            onChange={handleUnknownPatientToggle}
                          >
                            <Switch name="known" text={t('yes', 'Sí')} />
                            <Switch name="unknown" text={t('no', 'No')} />
                          </ContentSwitcher>
                        </div>

                        {isPatientUnknown && (
                          <InlineNotification
                            kind="warning"
                            lowContrast
                            hideCloseButton
                            subtitle={t(
                              'unknownWarning',
                              'Se registrará como DESCONOCIDO. Puede actualizarse después.',
                            )}
                          />
                        )}

                        <fieldset className={styles.formSection}>
                          <legend className={styles.sectionTitle}>{t('intakeContext', 'Contexto de ingreso')}</legend>
                          <div className={styles.fieldRow}>
                            <TextInput
                              id="arrivalDateTime"
                              type="datetime-local"
                              labelText={t('arrivalDateTime', 'Fecha/hora de ingreso') + ' *'}
                              invalid={!!errors.arrivalDateTime}
                              invalidText={errors.arrivalDateTime?.message}
                              disabled={isRegistering}
                              {...register('arrivalDateTime')}
                            />
                            <Controller
                              name="identificationStatus"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  id="identificationStatus"
                                  labelText={t('identificationStatus', 'Estado de identificación')}
                                  disabled={isRegistering}
                                  value={field.value || (isPatientUnknown ? 'pending' : 'confirmed')}
                                  onChange={(e) => field.onChange(e.target.value)}
                                >
                                  {identificationStatusOptions.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                      text={identificationStatusLabels[option.value]}
                                    />
                                  ))}
                                </Select>
                              )}
                            />
                          </div>
                          <Controller
                            name="communicationCondition"
                            control={control}
                            render={({ field }) => (
                              <Select
                                id="communicationCondition"
                                labelText={t('communicationCondition', 'Condición de comunicación') + ' *'}
                                invalid={!!errors.communicationCondition}
                                invalidText={errors.communicationCondition?.message}
                                disabled={isRegistering}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                              >
                                <SelectItem value="" text={t('select', 'Seleccionar')} />
                                {communicationConditionOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    text={communicationConditionLabels[option.value]}
                                  />
                                ))}
                              </Select>
                            )}
                          />
                          <TextArea
                            id="administrativeNotes"
                            labelText={t('administrativeNotes', 'Observaciones administrativas')}
                            rows={3}
                            maxCount={500}
                            enableCounter
                            invalid={!!errors.administrativeNotes}
                            invalidText={errors.administrativeNotes?.message}
                            disabled={isRegistering}
                            {...register('administrativeNotes')}
                          />
                        </fieldset>

                        {/* ── Identificación ── */}
                        {!isPatientUnknown && (
                          <fieldset className={styles.formSection}>
                            <legend className={styles.sectionTitle}>{t('identification', 'Identificación')}</legend>
                            <div className={styles.fieldRow}>
                              <TextInput
                                id="familyName"
                                labelText={t('paternalLastName', 'Apellido Paterno') + ' *'}
                                placeholder={t('enterPaternalLastName', 'Apellido paterno')}
                                invalid={!!errors.familyName}
                                invalidText={errors.familyName?.message}
                                disabled={isRegistering}
                                {...register('familyName')}
                              />
                              <TextInput
                                id="familyName2"
                                labelText={t('maternalLastName', 'Apellido Materno')}
                                placeholder={t('enterMaternalLastName', 'Apellido materno')}
                                disabled={isRegistering}
                                {...register('familyName2')}
                              />
                            </div>
                            <TextInput
                              id="givenName"
                              labelText={t('firstName', 'Primer Nombre') + ' *'}
                              placeholder={t('enterFirstName', 'Primer nombre')}
                              invalid={!!errors.givenName}
                              invalidText={errors.givenName?.message}
                              disabled={isRegistering}
                              {...register('givenName')}
                            />
                            <div className={styles.fieldRowDateGender}>
                              <Controller
                                name="birthdate"
                                control={control}
                                render={({ field }) => (
                                  <OpenmrsDatePicker
                                    id="birthdate"
                                    labelText={t('birthdate', 'Fecha nac.')}
                                    minDate={minimumBirthdate}
                                    maxDate={maximumBirthdate}
                                    value={getBirthdatePickerValue(field.value)}
                                    onChange={(date: Date) => {
                                      field.onChange(dayjs(date).format('YYYY-MM-DD'));
                                    }}
                                    isInvalid={!!errors.birthdate}
                                    invalidText={errors.birthdate?.message}
                                    isDisabled={isRegistering}
                                  />
                                )}
                              />
                              <Controller
                                name="gender"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    id="gender"
                                    labelText={t('gender', 'Sexo') + ' *'}
                                    invalid={!!errors.gender}
                                    invalidText={errors.gender?.message}
                                    disabled={isRegistering}
                                    value={field.value || ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                  >
                                    <SelectItem value="" text="..." />
                                    <SelectItem value="M" text="M" />
                                    <SelectItem value="F" text="F" />
                                    <SelectItem value="U" text={t('undetermined', 'No determinado')} />
                                  </Select>
                                )}
                              />
                            </div>
                            <div className={styles.fieldRow}>
                              <Controller
                                name="identifierType"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    id="identifierType"
                                    labelText={t('identityDocumentType', 'Tipo de documento')}
                                    disabled={isRegistering}
                                    value={field.value || config.patientRegistration.defaultIdentifierTypeUuid}
                                    onChange={(event) => {
                                      field.onChange(event.target.value);
                                    }}
                                  >
                                    {identityDocumentTypes.map((type) => (
                                      <SelectItem key={type.value} value={type.value} text={type.label} />
                                    ))}
                                  </Select>
                                )}
                              />
                              <TextInput
                                id="identifier"
                                labelText={t('identityDocumentOptional', 'Documento de identidad (opcional)')}
                                placeholder={t('enterIdentityDocument', 'Ingrese documento de identidad')}
                                invalid={!!errors.identifier}
                                invalidText={errors.identifier?.message}
                                disabled={isRegistering}
                                {...register('identifier')}
                              />
                            </div>
                            <Controller
                              name="nationality"
                              control={control}
                              render={({ field }) => (
                                <EmergencyNationalityField
                                  value={field.value}
                                  options={nationalityOptions}
                                  isLoading={isLoadingNationalityOptions}
                                  error={nationalityOptionsError}
                                  invalidText={errors.nationality?.message}
                                  disabled={isRegistering || shouldLockNationalityToPeru}
                                  nationalityWasAutoAssigned={nationalityWasAutoAssigned}
                                  onChange={field.onChange}
                                />
                              )}
                            />
                          </fieldset>
                        )}

                        {/* Solo Sexo y Edad para paciente desconocido */}
                        {isPatientUnknown && (
                          <div className={styles.fieldRow}>
                            <Controller
                              name="gender"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  id="gender-unknown"
                                  labelText={t('gender', 'Sexo') + ' *'}
                                  invalid={!!errors.gender}
                                  invalidText={errors.gender?.message}
                                  disabled={isRegistering}
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value)}
                                >
                                  <SelectItem value="" text="..." />
                                  <SelectItem value="M" text="M" />
                                  <SelectItem value="F" text="F" />
                                  <SelectItem value="U" text={t('undetermined', 'No determinado')} />
                                </Select>
                              )}
                            />
                            <TextInput
                              id="yearsEstimated"
                              type="number"
                              labelText={t('estimatedAge', 'Edad est. (años)')}
                              placeholder={t('enterAge', 'Años')}
                              invalid={!!errors.yearsEstimated}
                              invalidText={errors.yearsEstimated?.message}
                              disabled={isRegistering}
                              onKeyDown={preventInvalidAgeKey}
                              onPaste={preventInvalidAgePaste}
                              min={ageInputConstraints.min}
                              max={ageInputConstraints.max}
                              {...register('yearsEstimated', {
                                setValueAs: (value) =>
                                  value === ''
                                    ? undefined
                                    : (validatePlainNumberInput(value, ageInputConstraints).parsedValue ?? value),
                              })}
                            />
                          </div>
                        )}

                        {/* ── Ubicación ── */}
                        {!isPatientUnknown && (
                          <fieldset className={styles.formSection}>
                            <legend className={styles.sectionTitle}>{t('location', 'Ubicación')}</legend>
                            <div className={styles.fieldRow3}>
                              <TextInput
                                id="district"
                                labelText={t('district', 'Distrito')}
                                disabled={isRegistering}
                                {...register('district')}
                              />
                              <TextInput
                                id="village"
                                labelText={t('village', 'C. Poblado')}
                                placeholder={t('enterVillage', 'Centro poblado')}
                                disabled={isRegistering}
                                {...register('village')}
                              />
                              <TextInput
                                id="address"
                                labelText={t('address', 'Dirección')}
                                placeholder={t('enterAddress', 'Dirección')}
                                disabled={isRegistering}
                                {...register('address')}
                              />
                            </div>
                          </fieldset>
                        )}

                        {/* ── Seguro ── */}
                        {!isPatientUnknown && (
                          <fieldset className={styles.formSection}>
                            <legend className={styles.sectionTitle}>{t('insurance', 'Seguro')}</legend>
                            <div className={styles.fieldRow}>
                              <Controller
                                name="insuranceType"
                                control={control}
                                render={({ field }) => (
                                  <Select
                                    id="insuranceType"
                                    labelText={t('insuranceType', 'Tipo')}
                                    disabled={
                                      isRegistering || isLoadingInsuranceTypeOptions || !!insuranceTypeOptionsError
                                    }
                                    value={field.value || ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                  >
                                    <SelectItem
                                      value=""
                                      text={
                                        insuranceTypeOptionsError
                                          ? t('insuranceCatalogUnavailable', 'Catálogo de seguros no disponible')
                                          : isLoadingInsuranceTypeOptions
                                            ? t('loadingInsuranceTypes', 'Cargando tipos de seguro...')
                                            : t('select', 'Seleccionar')
                                      }
                                    />
                                    {(insuranceTypeOptions ?? []).map((option) => (
                                      <SelectItem key={option.uuid} value={option.uuid} text={option.display} />
                                    ))}
                                  </Select>
                                )}
                              />
                              <TextInput
                                id="insuranceCode"
                                labelText={t('insuranceCode', 'Código')}
                                placeholder={t('enterInsuranceCode', 'Código de seguro')}
                                disabled={isRegistering}
                                {...register('insuranceCode')}
                              />
                            </div>
                          </fieldset>
                        )}

                        {/* ── Acompañante / Responsable ── */}
                        <fieldset className={styles.formSection}>
                          <legend className={styles.sectionTitle}>{t('companion', 'Acompañante / Responsable')}</legend>
                          <Controller
                            name="responsibleType"
                            control={control}
                            render={({ field }) => (
                              <Select
                                id="responsibleType"
                                labelText={t('responsibleType', 'Tipo de responsable') + (isPatientUnknown ? ' *' : '')}
                                invalid={!!errors.responsibleType}
                                invalidText={errors.responsibleType?.message}
                                disabled={isRegistering}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value)}
                              >
                                <SelectItem value="" text={t('select', 'Seleccionar')} />
                                {responsibleTypeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    text={responsibleTypeLabels[option.value]}
                                  />
                                ))}
                              </Select>
                            )}
                          />
                          <TextInput
                            id="companionName"
                            labelText={t('companionName', 'Nombre completo') + (isPatientUnknown ? ' *' : '')}
                            placeholder={t('enterCompanionName', 'Nombre del acompañante')}
                            invalid={!!errors.companionName}
                            invalidText={errors.companionName?.message}
                            disabled={isRegistering}
                            {...register('companionName')}
                          />
                          <div className={styles.fieldRow}>
                            <TextInput
                              id="companionAge"
                              type="number"
                              labelText={t('companionAge', 'Edad')}
                              placeholder={t('enterCompanionAge', 'Años')}
                              disabled={isRegistering}
                              invalid={!!errors.companionAge}
                              invalidText={errors.companionAge?.message}
                              onKeyDown={preventInvalidAgeKey}
                              onPaste={preventInvalidAgePaste}
                              min={ageInputConstraints.min}
                              max={ageInputConstraints.max}
                              {...register('companionAge')}
                            />
                            <TextInput
                              id="companionRelationship"
                              labelText={t('companionRelationship', 'Parentesco o vínculo')}
                              placeholder={t('enterRelationship', 'Ej: Padre, Madre, PNP, SAMU')}
                              disabled={isRegistering}
                              {...register('companionRelationship')}
                            />
                          </div>
                        </fieldset>

                        <div className={styles.formActions}>
                          <Button
                            kind="secondary"
                            size="md"
                            onClick={() => {
                              setShowRegistrationForm(false);
                              setIsPatientUnknown(false);
                              reset();
                            }}
                            disabled={isRegistering}
                          >
                            {t('cancel', 'Cancelar')}
                          </Button>
                          <Button type="submit" size="md" disabled={isRegistering}>
                            {isRegistering ? (
                              <InlineLoading description={t('registering', 'Registrando...')} />
                            ) : (
                              t('registerPatient', 'Registrar paciente')
                            )}
                          </Button>
                        </div>
                      </Stack>
                    </Form>
                  </Stack>
                </Tile>
              </Layer>
            )}
          </>
        )}

        {/* Selected/Registered Patient Card */}
        {readyPatient && (
          <Layer>
            <Tile className={styles.patientFoundTile}>
              <div className={styles.selectedPatientRow}>
                <div className={styles.patientInfo}>
                  <CheckmarkFilled size={20} className={styles.successIcon} />
                  <User size={24} />
                  <div>
                    <p className={styles.patientResultName}>
                      {readyPatient.person?.personName?.display || readyPatient.person?.display || readyPatient.display}
                    </p>
                    <div className={styles.patientResultMeta}>
                      {readyPatient.person?.birthdate && <span>{age(readyPatient.person.birthdate)}</span>}
                      {readyPatient.person?.gender && (
                        <>
                          <span className={styles.separator}>|</span>
                          <span>{formatGenderLabel(readyPatient.person.gender) || t('unknown', 'Desconocido')}</span>
                        </>
                      )}
                      {readyPatient.identifiers?.[0] && (
                        <>
                          <span className={styles.separator}>|</span>
                          <Tag type="blue" size="sm">
                            {readyPatient.identifiers[0].identifier}
                          </Tag>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button kind="ghost" size="sm" onClick={handleDeselectPatient}>
                  {t('change', 'Cambiar')}
                </Button>
              </div>
            </Tile>
          </Layer>
        )}

        {/* Initial Priority Selector - only when patient is ready */}
        {readyPatient && (
          <InitialPrioritySelector value={initialPriority} onChange={setInitialPriority} disabled={isSubmitting} />
        )}

        {/* Submit Button */}
        {readyPatient && (
          <div className={styles.submitActions}>
            <Button
              kind="primary"
              size="lg"
              renderIcon={SendFilled}
              onClick={handleSendToQueue}
              disabled={!initialPriority || isSubmitting}
              className={styles.submitButton}
            >
              {isSubmitting ? (
                <InlineLoading description={t('sending', 'Enviando...')} />
              ) : initialPriority === 'emergency' ? (
                t('sendToImmediateAttention', 'Enviar a atención inmediata')
              ) : (
                t('sendToTriageQueue', 'Enviar a cola de triaje')
              )}
            </Button>
          </div>
        )}
      </Stack>
    </div>
  );
};

export default PatientSearchRegistration;
