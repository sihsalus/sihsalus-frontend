import { Button, InlineLoading, InlineNotification, Link } from '@carbon/react';
import { XAxis } from '@carbon/react/icons';
import {
  getUserFacingErrorMessage,
  interpolateUrl,
  isDesktop,
  logError,
  navigate,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  usePatientPhoto,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import { Form, Formik, type FormikErrors, type FormikHelpers, type FormikTouched } from 'formik';
import set from 'lodash-es/set';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { builtInSections, type RegistrationConfig, type SectionDefinition } from '../config-schema';
import { moduleName } from '../constants';
import { ResourcesContext } from '../offline.resources';
import BeforeSavePrompt from './before-save-prompt';
import { getDocumentIdentifierEntries } from './field/external-lookup/dni-identifier';
import { type SavePatientForm, SavePatientTransactionManager } from './form-manager';
import { getDocumentTypeDefinitionByIdentifierType, normalizeDocumentNumber } from './identity/identity-documents';
import { fetchPersonForPromotion, searchLocalIdentityByDocument } from './identity/identity-search.resource';
import { applyPersonToRegistrationForm } from './identity/promotion';
import { DummyDataInput } from './input/dummy-data/dummy-data-input.component';
import styles from './patient-registration.scss';
import { type CapturePhotoProps, type FormValues } from './patient-registration.types';
import { PatientRegistrationContext } from './patient-registration-context';
import {
  createInitialFormValues,
  useInitialAddressFieldValues,
  useInitialFormValues,
  usePatientUuidMap,
} from './patient-registration-hooks';
import { cancelRegistration, filterOutUndefinedPatientIdentifiers, scrollIntoView } from './patient-registration-utils';
import { getEffectiveRegistrationConfig } from './peru-registration-config';
import {
  getExistingPatientUuid,
  RegistrationDomainError,
  type RegistrationErrorCode,
  registrationErrorCodes,
} from './registration-errors';
import { resolveRegistrationAfterUrl } from './registration-redirect';
import { SectionWrapper } from './section/section-wrapper.component';
import { getValidationSchema } from './validation/patient-registration-validation';

export const initialFormValues = createInitialFormValues();

interface UserWithRoles {
  roles?: Array<{ display?: string; name?: string }>;
}

const medicalRecordArchivistRole = 'archivador de historias clinicas';

function normalizeRoleName(value?: string) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function hasMedicalRecordArchivistRole(user?: UserWithRoles | null) {
  return (
    user?.roles?.some((role) =>
      [role.name, role.display].some((roleName) => normalizeRoleName(roleName) === medicalRecordArchivistRole),
    ) ?? false
  );
}

export function preserveMedicalRecordAttributes(
  submittedAttributes: FormValues['attributes'],
  initialAttributes: FormValues['attributes'],
  medicalRecordAttributeUuids: Array<string>,
  canEditMedicalRecord: boolean,
) {
  const protectedAttributes = { ...submittedAttributes };

  if (canEditMedicalRecord) {
    return protectedAttributes;
  }

  medicalRecordAttributeUuids.forEach((attributeUuid) => {
    if (Object.hasOwn(initialAttributes ?? {}, attributeUuid)) {
      protectedAttributes[attributeUuid] = initialAttributes?.[attributeUuid] ?? '';
    } else {
      delete protectedAttributes[attributeUuid];
    }
  });

  return protectedAttributes;
}

interface RegistrationSubmitError {
  responseStatus?: number;
  status?: number;
  message?: string;
  responseBody?: {
    error?: {
      message?: string;
    };
  };
}

function isSessionExpired(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const typedError = error as RegistrationSubmitError;
  const status = typedError.status ?? typedError.responseStatus;
  const lowerCaseMessage = `${typedError.message ?? ''} ${typedError.responseBody?.error?.message ?? ''}`.toLowerCase();
  return status === 401 || lowerCaseMessage.includes('session expired') || lowerCaseMessage.includes('sesión expirada');
}

const defaultRegistrationFieldLabels: Record<string, string> = {
  address: 'Address',
  attributes: 'Patient information',
  birthdate: 'Date of birth',
  dni: 'DNI',
  familyName: 'Family name',
  familyName2: 'Second family name',
  gender: 'Gender',
  givenName: 'First name',
  identifiers: 'Identification data',
  relationshipType: 'Relationship to patient',
};

const registrationFieldLabelTranslationKeys: Record<string, string> = {
  address: 'addressLabelText',
  birthdate: 'dateOfBirthLabelText',
  relationshipType: 'relationshipToPatient',
};

export function getPatientRegistrationFieldLabel(
  path: Array<string>,
  translateWithFallback: (key: string, defaultValue: string) => string,
  attributeFieldLabels: Record<string, string> = {},
) {
  const [section] = path;
  const field = [...path.slice(1)].reverse().find((pathSegment) => !/^\d+$/.test(pathSegment));

  if (!section) {
    return translateWithFallback('fieldRequired', 'Field is required');
  }

  if (section === 'identifiers') {
    const identifierField = path[1];
    if (identifierField && defaultRegistrationFieldLabels[identifierField]) {
      return translateWithFallback(
        `${identifierField}IdentifierLabelText`,
        defaultRegistrationFieldLabels[identifierField],
      );
    }
    return translateWithFallback('idFieldLabelText', defaultRegistrationFieldLabels.identifiers);
  }

  if (section === 'attributes') {
    const attributeLabel = path
      .slice(1)
      .map((pathSegment) => attributeFieldLabels[pathSegment])
      .find(Boolean);
    if (attributeLabel) {
      return attributeLabel;
    }
  }

  if (field) {
    const labelKey = registrationFieldLabelTranslationKeys[field] ?? `${field}LabelText`;
    const translatedLabel = translateWithFallback(labelKey, defaultRegistrationFieldLabels[field] ?? field);

    if (translatedLabel !== field || defaultRegistrationFieldLabels[field]) {
      return translatedLabel;
    }
  }

  const defaultFieldLabel = defaultRegistrationFieldLabels[section];
  const labelKey = registrationFieldLabelTranslationKeys[section] ?? `${section}LabelText`;
  const fieldLabel = translateWithFallback(labelKey, defaultFieldLabel ?? section);

  if (fieldLabel !== section || defaultFieldLabel) {
    return fieldLabel;
  }

  return translateWithFallback(`${section}Section`, section);
}

export interface PatientRegistrationProps {
  savePatientForm: SavePatientForm;
  isOffline: boolean;
}

export const PatientRegistration: React.FC<PatientRegistrationProps> = ({ savePatientForm, isOffline }) => {
  const { currentSession, identifierTypes, identifierTypesError, isLoadingIdentifierTypes } =
    useContext(ResourcesContext);
  const { search } = useLocation();
  const configuredRegistrationConfig = useConfig() as RegistrationConfig;
  const config = useMemo(
    () => getEffectiveRegistrationConfig(configuredRegistrationConfig),
    [configuredRegistrationConfig],
  );
  const attributeFieldLabels = useMemo(
    () =>
      Object.fromEntries(
        (config.fieldDefinitions ?? [])
          .filter((fieldDefinition) => fieldDefinition.type === 'person attribute' && fieldDefinition.uuid)
          .map((fieldDefinition) => [fieldDefinition.uuid, fieldDefinition.label ?? fieldDefinition.id]),
      ),
    [config.fieldDefinitions],
  );
  const medicalRecordAttributeUuids = useMemo(
    () =>
      config.fieldDefinitions
        .filter((fieldDefinition) => ['medicalRecordStatus', 'medicalRecordArchiveType'].includes(fieldDefinition.id))
        .map((fieldDefinition) => fieldDefinition.uuid)
        .filter(Boolean),
    [config.fieldDefinitions],
  );
  const [target, setTarget] = useState<undefined | string>();
  const { patientUuid: uuidOfPatientToEdit } = useParams();
  const patientUuidToEdit = uuidOfPatientToEdit ?? '';
  const { isLoading: isLoadingPatientToEdit, patient: patientToEdit } = usePatient(patientUuidToEdit);
  const { t } = useTranslation(moduleName);
  const [capturePhotoProps, setCapturePhotoProps] = useState<CapturePhotoProps | null>(null);
  const [initialFormValuesState, setInitialFormValues, initialFormState = { isLoading: false }] =
    useInitialFormValues(patientUuidToEdit);
  const [initialAddressFieldValues, , initialAddressState = { isLoading: false }] =
    useInitialAddressFieldValues(patientUuidToEdit);
  const [patientUuidMap, , patientUuidMapState = { isLoading: false }] = usePatientUuidMap(patientUuidToEdit);
  const location = currentSession?.sessionLocation?.uuid;
  const isSessionLocationMissing = Boolean(currentSession && !isOffline && !location);
  const layout = useLayoutType();
  const isDesktopLayout = isDesktop(layout);
  const hasPatientRoute = !!uuidOfPatientToEdit;
  const isNewPatient = initialFormState.isNewPatient ?? !hasPatientRoute;
  const inEditMode = !isNewPatient;
  const canEditMedicalRecord = inEditMode && hasMedicalRecordArchivistRole(currentSession?.user);
  const showDummyData = useMemo(
    () => window.spaEnv === 'development' && localStorage.getItem('openmrs:devtools') === 'true' && !hasPatientRoute,
    [hasPatientRoute],
  );
  const { data: photo } = usePatientPhoto(patientToEdit?.id);
  const savePatientTransactionManager = useRef(new SavePatientTransactionManager());
  const promotePersonUuid = useMemo(() => new URLSearchParams(search ?? '').get('promotePerson'), [search]);
  const [isLoadingPromotion, setIsLoadingPromotion] = useState(!!promotePersonUuid && !hasPatientRoute);
  const validationSchema = getValidationSchema(config, identifierTypes);
  const areIdentifiersUnavailableForSubmit = (hasFormIdentifiers: boolean) =>
    !isOffline &&
    !(inEditMode && hasFormIdentifiers) &&
    (isLoadingIdentifierTypes || !!identifierTypesError || !identifierTypes?.length);

  // Entry point for promoting an existing person from outside the form: opening
  // `patient-registration?promotePerson=<personUuid>` hydrates the form with that
  // person so submitting promotes them (same UUID) instead of creating a new patient.
  const handledPromotePersonUuid = useRef<string | null>(null);
  useEffect(() => {
    if (!promotePersonUuid || hasPatientRoute || handledPromotePersonUuid.current === promotePersonUuid) {
      setIsLoadingPromotion(false);
      return;
    }

    if (isOffline) {
      showSnackbar({
        title: t('promotionOfflineTitle', 'Promoción no disponible'),
        subtitle: t('promotionOfflineSubtitle', 'La promoción de una persona existente a paciente requiere conexión.'),
        kind: 'warning',
      });
      handledPromotePersonUuid.current = promotePersonUuid;
      setIsLoadingPromotion(false);
      return;
    }

    handledPromotePersonUuid.current = promotePersonUuid;
    setIsLoadingPromotion(true);
    let cancelled = false;

    fetchPersonForPromotion(promotePersonUuid)
      .then((person) => {
        if (cancelled) {
          return;
        }

        setInitialFormValues((currentValues) => {
          const nextValues = {
            ...currentValues,
            address: { ...currentValues.address },
            attributes: { ...currentValues.attributes },
          };
          applyPersonToRegistrationForm(
            person,
            (field, value) => set(nextValues, field, value),
            () => {},
          );
          return nextValues;
        });
        setIsLoadingPromotion(false);
      })
      .catch((error) => {
        console.error('Could not load the person to promote', error);
        handledPromotePersonUuid.current = null;
        showSnackbar({
          title: t('promotionLoadErrorTitle', 'No se pudo cargar la persona a promover'),
          subtitle: t('promotionLoadErrorSubtitle', 'Verifique que la persona exista e intente nuevamente.'),
          kind: 'error',
        });
        setIsLoadingPromotion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasPatientRoute, isOffline, promotePersonUuid, setInitialFormValues, t]);

  const hydratedQueuedRegistrationUuid = useRef<string>();
  useEffect(() => {
    const queuedRegistration = initialFormState.queuedRegistration;
    if (!queuedRegistration || hydratedQueuedRegistrationUuid.current === patientUuidToEdit) {
      return;
    }

    setCapturePhotoProps(queuedRegistration._patientRegistrationData.capturePhotoProps ?? null);
    savePatientTransactionManager.current = Object.assign(
      new SavePatientTransactionManager(),
      queuedRegistration._patientRegistrationData.savePatientTransactionManager,
    );
    hydratedQueuedRegistrationUuid.current = patientUuidToEdit;
  }, [initialFormState.queuedRegistration, patientUuidToEdit]);

  const sections: Array<SectionDefinition> = useMemo(() => {
    return config.sections
      .map(
        (sectionName) =>
          config.sectionDefinitions.filter((s) => s.id === sectionName)[0] ??
          builtInSections.filter((s) => s.id === sectionName)[0],
      )
      .filter((section) => section && (section.id !== 'medicalRecord' || canEditMedicalRecord));
  }, [canEditMedicalRecord, config.sections, config.sectionDefinitions]);

  const onFormSubmit = async (values: FormValues, helpers: FormikHelpers<FormValues>) => {
    const abortController = new AbortController();
    helpers.setSubmitting(true);

    const submittedAttributes = preserveMedicalRecordAttributes(
      values.attributes,
      initialFormValuesState.attributes,
      medicalRecordAttributeUuids,
      canEditMedicalRecord,
    );

    const updatedFormValues = {
      ...values,
      attributes: submittedAttributes,
      identifiers: filterOutUndefinedPatientIdentifiers(values.identifiers),
    };
    try {
      if (isNewPatient && !isOffline && !savePatientTransactionManager.current.patientSaved) {
        const checkedDocuments = new Set<string>();
        const documentEntries = getDocumentIdentifierEntries(updatedFormValues.identifiers, identifierTypes ?? []);

        for (const [fieldName, identifier] of documentEntries) {
          const identifierType = identifierTypes?.find(
            (type) => type.fieldName === fieldName || type.uuid === identifier.identifierTypeUuid,
          );
          const identifierTypeUuid = identifier.identifierTypeUuid ?? identifierType?.uuid;
          const definition = getDocumentTypeDefinitionByIdentifierType(identifierTypeUuid);
          const documentNumber = normalizeDocumentNumber(identifier.identifierValue, definition);
          const documentKey = `${identifierTypeUuid ?? ''}:${documentNumber}`;

          if (!documentNumber || checkedDocuments.has(documentKey)) {
            continue;
          }
          checkedDocuments.add(documentKey);

          const identityMatches = await searchLocalIdentityByDocument(documentNumber, abortController, {
            patientIdentifierTypeUuid: definition?.patientIdentifierTypeUuid ?? undefined,
            personDocumentTypeConceptUuid: definition?.documentTypeConceptUuid,
          });
          const existingPatient = identityMatches.find((match) => match.kind === 'patient');
          const existingPerson = identityMatches.find((match) => match.kind === 'person');

          if (existingPatient) {
            throw new RegistrationDomainError(
              registrationErrorCodes.duplicatePatientDocument,
              `Duplicate patient ${existingPatient.uuid} found during document preflight.`,
              { existingPatientUuid: existingPatient.uuid },
            );
          }

          if (existingPerson && existingPerson.uuid !== updatedFormValues.personUuidToPromote) {
            throw new RegistrationDomainError(
              registrationErrorCodes.duplicatePersonDocument,
              `Duplicate person ${existingPerson.uuid} found during document preflight.`,
            );
          }
        }
      }

      const savedPatientUuid = await savePatientForm(
        isNewPatient,
        updatedFormValues,
        patientUuidMap,
        initialAddressFieldValues,
        capturePhotoProps,
        location ?? '',
        initialFormValuesState['identifiers'],
        currentSession,
        config,
        savePatientTransactionManager.current,
        identifierTypes,
        abortController,
      );

      showSnackbar({
        subtitle: inEditMode
          ? t('updatePatientSuccessSnackbarSubtitle', "The patient's information has been successfully updated")
          : t(
              'registerPatientSuccessSnackbarSubtitle',
              'The patient can now be found by searching for them using their name or ID number',
            ),
        title: inEditMode
          ? t('updatePatientSuccessSnackbarTitle', 'Patient Details Updated')
          : t('registerPatientSuccessSnackbarTitle', 'New Patient Created'),
        kind: 'success',
        isLowContrast: true,
      });

      const rawAfterUrl = new URLSearchParams(search).get('afterUrl');
      const savedOrExistingPatientUuid = savedPatientUuid ?? updatedFormValues.patientUuid;
      const afterUrl = resolveRegistrationAfterUrl(rawAfterUrl, savedOrExistingPatientUuid);
      const redirectUrl =
        afterUrl ?? interpolateUrl(config.links.submitButton, { patientUuid: savedOrExistingPatientUuid });

      setTarget(redirectUrl);
    } catch (error: unknown) {
      const errorTitle = inEditMode
        ? t('updatePatientErrorSnackbarTitle', 'Patient Details Update Failed')
        : t('registrationErrorSnackbarTitle', 'Patient Registration Failed');

      if (isSessionExpired(error)) {
        showSnackbar({
          title: errorTitle,
          subtitle: t('sessionExpiredError', 'Your session has expired. Please sign in again.'),
          kind: 'error',
        });
      } else {
        const existingPatientUuid = getExistingPatientUuid(error);
        showSnackbar({
          title: errorTitle,
          subtitle: getUserFacingErrorMessage(
            error,
            t('unexpectedRegistrationError', 'The patient could not be saved. Please try again.'),
            {
              codeMessages: {
                [registrationErrorCodes.clinicalConfigurationMissing]: t(
                  'registrationClinicalConfigurationError',
                  'The clinical information could not be saved because the system configuration is incomplete. Contact the system administrator.',
                ),
                [registrationErrorCodes.duplicatePatientDocument]: t(
                  'duplicatePatientDocumentError',
                  'A patient already exists with this document. Find the existing patient before registering a new one.',
                ),
                [registrationErrorCodes.duplicatePersonDocument]: t(
                  'duplicatePersonDocumentError',
                  'A person already exists with this document. Use person promotion to avoid a duplicate.',
                ),
                [registrationErrorCodes.identifierLocationRequired]: t(
                  'sessionLocationRequiredSubtitle',
                  'Choose your current care location from the top navigation before registering the patient.',
                ),
                [registrationErrorCodes.identifierRetryDeleteUnavailable]: t(
                  'identifierRetryDeleteError',
                  'An identifier was removed during a retry. Reload the patient and try again.',
                ),
                [registrationErrorCodes.identifierRetryUpdateUnavailable]: t(
                  'identifierRetryUpdateError',
                  'Identification data changed during a retry. Reload the patient and try again.',
                ),
                [registrationErrorCodes.identityVerificationMismatch]: t(
                  'identityVerificationMismatchError',
                  "The person's information does not match the identity verification source. Resolve the discrepancy before promoting them.",
                ),
                [registrationErrorCodes.partialCreateIdentifierChanged]: t(
                  'partialRegistrationIdentifiersChangedError',
                  'The patient was partially created and the identification data changed. Open the existing patient to update the identification.',
                ),
                [registrationErrorCodes.partialSavePatientChanged]: t(
                  'partialRegistrationDataChangedError',
                  'The patient was partially saved and the information changed. Reload the patient before continuing.',
                ),
                [registrationErrorCodes.promotionAlreadyPatient]: t(
                  'promotionAlreadyPatientError',
                  'This person is already registered as a patient. Find the existing patient instead of registering them again.',
                ),
                [registrationErrorCodes.promotionDocumentMismatch]: t(
                  'promotionDocumentMismatchError',
                  "The entered document does not match the selected person's document. Review it or clear the promotion and search again.",
                ),
                [registrationErrorCodes.promotionOffline]: t(
                  'promotionOfflineSubtitle',
                  'Promoting an existing person to patient requires a connection.',
                ),
                [registrationErrorCodes.relationshipPersonRequired]: t(
                  'relationshipPersonRequiredError',
                  'Select or register a person before saving the relationship.',
                ),
                [registrationErrorCodes.relationshipRetryChanged]: t(
                  'relationshipRetryChangedError',
                  'The relationship changed after it was partially saved. Restore the previous information or reload before trying again.',
                ),
                [registrationErrorCodes.relationshipUpdateInvalid]: t(
                  'relationshipUpdateInvalidError',
                  'The relationship cannot be updated because its saved identifier is missing. Reload and try again.',
                ),
                [registrationErrorCodes.responsiblePersonCreationFailed]: t(
                  'responsiblePersonCreationError',
                  'The related person could not be saved. Try again.',
                ),
              } satisfies Record<RegistrationErrorCode, string>,
              logContext: 'Patient registration submission failed',
              statusMessages: {
                400: t('invalidRegistrationData', 'Some information is invalid. Review the form and try again.'),
                403: t('registrationForbidden', 'You do not have permission to save this patient.'),
                409: t('duplicatePatientConflict', 'This patient conflicts with an existing record.'),
              },
            },
          ),
          kind: 'error',
          ...(existingPatientUuid
            ? {
                actionButtonLabel: t('identityLookupOpenPatient', 'Open existing patient'),
                onActionButtonClick: () =>
                  navigate({
                    to: interpolateUrl(config.links.submitButton, { patientUuid: existingPatientUuid }),
                  }),
              }
            : {}),
        });
      }

      helpers.setSubmitting(false);
    }
  };

  const getErrorMessages = (errors: FormikErrors<FormValues>) => {
    const messages = new Set<string>();
    const defaultErrorMessages: Record<string, string> = {
      birthdayRequired: 'Birthday is required',
      familyNameRequired: 'Family name is required',
      familyName2Required: 'Second family name is required',
      fieldRequired: 'Field is required',
      genderRequired: 'Gender is required',
      givenNameRequired: 'First name is required',
      identifierValueRequired: 'Identifier value is required',
    };

    const translateWithFallback = (key: string, defaultValue: string) => {
      const translatedText = t(key, defaultValue);
      return translatedText === key ? defaultValue : translatedText;
    };

    const collectMessages = (value: unknown, path: Array<string> = []) => {
      if (!value) {
        return;
      }
      if (typeof value === 'string') {
        const fieldLabel = getPatientRegistrationFieldLabel(path, translateWithFallback, attributeFieldLabels);
        const errorMessage = translateWithFallback(value, defaultErrorMessages[value] ?? value);
        messages.add(`${fieldLabel}: ${errorMessage}`);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          collectMessages(item, [...path, String(index)]);
        });
        return;
      }
      if (typeof value === 'object') {
        Object.entries(value).forEach(([key, nestedValue]) => {
          collectMessages(nestedValue, [...path, key]);
        });
      }
    };

    Object.entries(errors).forEach(([key, value]) => {
      collectMessages(value, [key]);
    });
    return [...messages];
  };

  const getTouchedFields = (errors: unknown): FormikTouched<FormValues> | boolean => {
    if (!errors || typeof errors !== 'object') {
      return true;
    }

    if (Array.isArray(errors)) {
      return errors.map((error) => getTouchedFields(error)) as unknown as FormikTouched<FormValues>;
    }

    return Object.fromEntries(
      Object.entries(errors).map(([key, value]) => [key, getTouchedFields(value)]),
    ) as FormikTouched<FormValues>;
  };

  const getDescription = (errors: FormikErrors<FormValues>) => {
    const errorMessages = getErrorMessages(errors);

    return (
      <ul style={{ listStyle: 'inside' }}>
        {errorMessages.map((validationMessage) => (
          <li key={validationMessage}>{validationMessage}</li>
        ))}
      </ul>
    );
  };

  const displayErrors = (errors: FormikErrors<FormValues>) => {
    const errorCount = getErrorMessages(errors).length;

    if (errors && typeof errors === 'object' && errorCount) {
      showSnackbar({
        isLowContrast: true,
        kind: 'warning',
        title:
          errorCount === 1
            ? t('fieldWithErrors', 'The following field has errors:')
            : t('fieldsWithErrors', 'The following fields have errors:'),
        subtitle: <>{getDescription(errors)}</>,
      });
    }
  };

  const initialDataError = initialFormState.error ?? initialAddressState.error ?? patientUuidMapState.error;
  useEffect(() => {
    if (initialDataError) {
      logError(initialDataError, 'Patient registration initial data failed');
    }
  }, [initialDataError]);

  const hasStaleInitialData = [initialFormState, initialAddressState, patientUuidMapState].some(
    (state) => state.hydratedPatientUuid && state.hydratedPatientUuid !== patientUuidToEdit,
  );
  const isLoadingInitialData =
    isLoadingPromotion ||
    (hasPatientRoute &&
      (hasStaleInitialData ||
        (isLoadingPatientToEdit && !initialFormState.queuedRegistration) ||
        initialFormState.isLoading ||
        initialAddressState.isLoading ||
        patientUuidMapState.isLoading));

  if (isLoadingInitialData) {
    return <InlineLoading description={t('loadingPatientRegistration', 'Cargando datos del paciente...')} />;
  }

  if (hasPatientRoute && initialDataError) {
    return (
      <InlineNotification
        hideCloseButton
        kind="error"
        title={t('patientRegistrationLoadErrorTitle', 'No se pudo cargar el registro del paciente')}
        subtitle={t(
          'patientRegistrationLoadErrorSubtitle',
          'Recargue la página o contacte al administrador del sistema.',
        )}
      />
    );
  }

  return (
    <Formik initialValues={initialFormValuesState} validationSchema={validationSchema} onSubmit={onFormSubmit}>
      {(props) => {
        const handleRegisterPatient = async () => {
          const errors = await props.validateForm();

          if (errors && typeof errors === 'object' && !!Object.keys(errors).length) {
            props.setTouched(getTouchedFields(errors) as FormikTouched<FormValues>, false);
            displayErrors(errors);
            return;
          }

          props.submitForm();
        };

        const renderActionButtons = () => (
          <>
            <Button
              className={styles.submitButton}
              type="button"
              onClick={handleRegisterPatient}
              // Current session and identifiers are required for patient registration.
              // If currentSession or identifierTypes are not available, then the
              // user should be blocked to register the patient.
              disabled={
                !currentSession ||
                isSessionLocationMissing ||
                areIdentifiersUnavailableForSubmit(!!Object.keys(props.values.identifiers ?? {}).length) ||
                props.isSubmitting
              }
            >
              {props.isSubmitting ? (
                <InlineLoading
                  className={styles.spinner}
                  description={`${t('submitting', 'Submitting')} ...`}
                  iconDescription="submitting"
                />
              ) : inEditMode ? (
                t('updatePatient', 'Update patient')
              ) : (
                t('registerPatient', 'Register patient')
              )}
            </Button>
            <Button className={styles.cancelButton} kind="tertiary" onClick={cancelRegistration}>
              {t('cancel', 'Cancel')}
            </Button>
          </>
        );

        return (
          <Form className={styles.form} noValidate>
            <BeforeSavePrompt when={Object.keys(props.touched).length > 0} redirect={target} />
            {isSessionLocationMissing ? (
              <InlineNotification
                className={styles.sessionLocationWarning}
                hideCloseButton
                kind="warning"
                lowContrast
                title={t('sessionLocationRequiredTitle', 'Select a session location')}
                subtitle={t(
                  'sessionLocationRequiredSubtitle',
                  'Choose your current care location from the top navigation before registering the patient.',
                )}
              />
            ) : null}
            <div className={styles.formContainer}>
              <div>
                <div className={styles.stickyColumn}>
                  <h4>
                    {inEditMode ? t('updatePatient', 'Update patient') : t('createNewPatient', 'Create new patient')}
                  </h4>
                  {showDummyData && <DummyDataInput setValues={props.setValues} />}
                  {isDesktopLayout && <div className={styles.actionPanel}>{renderActionButtons()}</div>}
                  <div className={styles.sectionNav}>
                    <p className={styles.label01}>{t('jumpTo', 'Jump to')}</p>
                    {sections.map((section) => (
                      <div className={classNames(styles.space05, styles.touchTarget)} key={section.id}>
                        <Link className={styles.linkName} onClick={() => scrollIntoView(section.id)}>
                          <XAxis size={16} /> {t(`${section.id}Section`, section.name ?? section.id)}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.infoGrid}>
                <PatientRegistrationContext.Provider
                  value={{
                    identifierTypes: identifierTypes,
                    validationSchema,
                    values: props.values,
                    inEditMode,
                    setFieldValue: props.setFieldValue,
                    setFieldTouched: props.setFieldTouched,
                    setCapturePhotoProps,
                    currentPhoto: photo?.imageSrc ?? null,
                    isOffline,
                    initialFormValues: props.initialValues,
                    setInitialFormValues,
                  }}
                >
                  {sections.map((section, index) => (
                    <SectionWrapper
                      key={`registration-section-${section.id}`}
                      sectionDefinition={section}
                      index={index}
                    />
                  ))}
                </PatientRegistrationContext.Provider>
                {!isDesktopLayout && <div className={styles.bottomActionPanel}>{renderActionButtons()}</div>}
              </div>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
};

/**
 * @internal
 * Just exported for testing
 */
