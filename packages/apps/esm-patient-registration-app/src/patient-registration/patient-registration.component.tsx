import { Button, InlineLoading, Link } from '@carbon/react';
import { XAxis } from '@carbon/react/icons';
import {
  createErrorHandler,
  interpolateUrl,
  isDesktop,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  usePatientPhoto,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import { Form, Formik, type FormikErrors, type FormikHelpers } from 'formik';
import set from 'lodash-es/set';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { builtInSections, type RegistrationConfig, type SectionDefinition } from '../config-schema';
import { moduleName } from '../constants';
import { ResourcesContext } from '../offline.resources';
import { fetchPersonForPromotion } from './identity/identity-search.resource';
import { applyPersonToRegistrationForm } from './identity/promotion';
import BeforeSavePrompt from './before-save-prompt';
import { type SavePatientForm, SavePatientTransactionManager } from './form-manager';
import { DummyDataInput } from './input/dummy-data/dummy-data-input.component';
import styles from './patient-registration.scss';
import { type CapturePhotoProps, type FormValues } from './patient-registration.types';
import { PatientRegistrationContext } from './patient-registration-context';
import { useInitialAddressFieldValues, useInitialFormValues, usePatientUuidMap } from './patient-registration-hooks';
import { cancelRegistration, filterOutUndefinedPatientIdentifiers, scrollIntoView } from './patient-registration-utils';
import { getEffectiveRegistrationConfig } from './peru-registration-config';
import { SectionWrapper } from './section/section-wrapper.component';
import { getValidationSchema } from './validation/patient-registration-validation';

export const initialFormValues = {} as FormValues;

interface RegistrationSubmitError {
  status?: number;
  message?: string;
  responseBody?: {
    error?: {
      globalErrors?: Array<{ message?: string }>;
      message?: string;
    };
  };
}

function isRegistrationSubmitError(error: unknown): error is RegistrationSubmitError {
  return typeof error === 'object' && error !== null && 'responseBody' in error;
}

function isSessionExpired(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const typedError = error as RegistrationSubmitError & { responseStatus?: number; message?: string };
  const status = typedError.status ?? typedError.responseStatus;
  const lowerCaseMessage = `${typedError.message ?? ''} ${typedError.responseBody?.error?.message ?? ''}`.toLowerCase();
  return (
    status === 401 || status === 403 || lowerCaseMessage.includes('session') || lowerCaseMessage.includes('expired')
  );
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
  const [target, setTarget] = useState<undefined | string>();
  const { patientUuid: uuidOfPatientToEdit } = useParams();
  const patientUuidToEdit = uuidOfPatientToEdit ?? '';
  const { isLoading: isLoadingPatientToEdit, patient: patientToEdit } = usePatient(patientUuidToEdit);
  const { t } = useTranslation(moduleName);
  const [capturePhotoProps, setCapturePhotoProps] = useState<CapturePhotoProps | null>(null);
  const [initialFormValuesState, setInitialFormValues] = useInitialFormValues(patientUuidToEdit);
  const [initialAddressFieldValues] = useInitialAddressFieldValues(patientUuidToEdit);
  const [patientUuidMap] = usePatientUuidMap(patientUuidToEdit);
  const location = currentSession?.sessionLocation?.uuid;
  const layout = useLayoutType();
  const isDesktopLayout = isDesktop(layout);
  const inEditMode = !isLoadingPatientToEdit && !!(uuidOfPatientToEdit && patientToEdit);
  const showDummyData = useMemo(
    () => window.spaEnv === 'development' && localStorage.getItem('openmrs:devtools') === 'true' && !inEditMode,
    [inEditMode],
  );
  const { data: photo } = usePatientPhoto(patientToEdit?.id);
  const savePatientTransactionManager = useRef(new SavePatientTransactionManager());
  const validationSchema = getValidationSchema(config, identifierTypes);
  const areIdentifiersUnavailableForSubmit = (hasFormIdentifiers: boolean) =>
    !isOffline &&
    !(inEditMode && hasFormIdentifiers) &&
    (isLoadingIdentifierTypes || !!identifierTypesError || !identifierTypes?.length);

  useEffect(() => {
    Object.keys(initialFormValues).forEach((key) => {
      Reflect.deleteProperty(initialFormValues, key);
    });
    Object.assign(initialFormValues, initialFormValuesState);
  }, [initialFormValuesState]);

  // Entry point for promoting an existing person from outside the form: opening
  // `patient-registration?promotePerson=<personUuid>` hydrates the form with that
  // person so submitting promotes them (same UUID) instead of creating a new patient.
  const handledPromotePersonUuid = useRef<string | null>(null);
  useEffect(() => {
    const promotePersonUuid = new URLSearchParams(search).get('promotePerson');

    if (!promotePersonUuid || inEditMode || handledPromotePersonUuid.current === promotePersonUuid) {
      return;
    }

    if (isOffline) {
      showSnackbar({
        title: t('promotionOfflineTitle', 'Promoción no disponible'),
        subtitle: t(
          'promotionOfflineSubtitle',
          'La promoción de una persona existente a paciente requiere conexión.',
        ),
        kind: 'warning',
      });
      return;
    }

    handledPromotePersonUuid.current = promotePersonUuid;
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
          applyPersonToRegistrationForm(person, (field, value) => set(nextValues, field, value), () => {});
          return nextValues;
        });
      })
      .catch((error) => {
        console.error('Could not load the person to promote', error);
        handledPromotePersonUuid.current = null;
        showSnackbar({
          title: t('promotionLoadErrorTitle', 'No se pudo cargar la persona a promover'),
          subtitle: t('promotionLoadErrorSubtitle', 'Verifique que la persona exista e intente nuevamente.'),
          kind: 'error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [search, inEditMode, isOffline, setInitialFormValues, t]);

  const sections: Array<SectionDefinition> = useMemo(() => {
    return config.sections
      .map(
        (sectionName) =>
          config.sectionDefinitions.filter((s) => s.id === sectionName)[0] ??
          builtInSections.filter((s) => s.id === sectionName)[0],
      )
      .filter((s) => s);
  }, [config.sections, config.sectionDefinitions]);

  const onFormSubmit = async (values: FormValues, helpers: FormikHelpers<FormValues>) => {
    const abortController = new AbortController();
    helpers.setSubmitting(true);

    const updatedFormValues = { ...values, identifiers: filterOutUndefinedPatientIdentifiers(values.identifiers) };
    try {
      await savePatientForm(
        !inEditMode,
        updatedFormValues,
        patientUuidMap,
        initialAddressFieldValues,
        capturePhotoProps,
        location ?? '',
        initialFormValuesState['identifiers'],
        currentSession,
        config,
        savePatientTransactionManager.current,
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
      // Only allow relative paths (must start with /) to prevent open redirect
      const afterUrl = rawAfterUrl && rawAfterUrl.startsWith('/') ? rawAfterUrl : null;
      const redirectUrl = interpolateUrl(afterUrl || config.links.submitButton, { patientUuid: values.patientUuid });

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
      } else if (isRegistrationSubmitError(error) && error.responseBody?.error?.globalErrors) {
        error.responseBody.error.globalErrors.forEach((globalError) => {
          showSnackbar({ title: errorTitle, subtitle: globalError.message, kind: 'error' });
        });
      } else if (isRegistrationSubmitError(error) && error.responseBody?.error?.message) {
        showSnackbar({ title: errorTitle, subtitle: error.responseBody.error.message, kind: 'error' });
      } else {
        createErrorHandler()(error);
      }

      helpers.setSubmitting(false);
    }
  };

  const getErrorMessages = (errors: FormikErrors<FormValues>) => {
    const messages = new Set<string>();

    const collectMessages = (value: unknown, fallbackKey?: string) => {
      if (!value) {
        return;
      }
      if (typeof value === 'string') {
        messages.add(t(value, value));
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          collectMessages(item, fallbackKey);
        });
        return;
      }
      if (typeof value === 'object') {
        Object.entries(value).forEach(([key, nestedValue]) => {
          collectMessages(nestedValue, key);
        });
        return;
      }
      if (fallbackKey) {
        messages.add(t(`${fallbackKey}LabelText`, fallbackKey));
      }
    };

    Object.entries(errors).forEach(([key, value]) => {
      collectMessages(value, key);
    });
    return [...messages];
  };

  const getDescription = (errors: FormikErrors<FormValues>) => {
    const errorMessages = getErrorMessages(errors);

    return (
      <ul style={{ listStyle: 'inside' }}>
        {errorMessages.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    );
  };

  const displayErrors = (errors: FormikErrors<FormValues>) => {
    if (errors && typeof errors === 'object' && !!Object.keys(errors).length) {
      showSnackbar({
        isLowContrast: true,
        kind: 'warning',
        title: t('fieldsWithErrors', 'The following fields have errors:'),
        subtitle: <>{getDescription(errors)}</>,
      });
    }
  };

  return (
    <Formik
      enableReinitialize
      initialValues={initialFormValuesState}
      validationSchema={validationSchema}
      onSubmit={onFormSubmit}
    >
      {(props) => {
        const renderActionButtons = () => (
          <>
            <Button
              className={styles.submitButton}
              type="submit"
              onClick={() => props.validateForm().then((errors) => displayErrors(errors))}
              // Current session and identifiers are required for patient registration.
              // If currentSession or identifierTypes are not available, then the
              // user should be blocked to register the patient.
              disabled={
                !currentSession ||
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
          <Form className={styles.form}>
            <BeforeSavePrompt when={Object.keys(props.touched).length > 0} redirect={target} />
            <div className={styles.formContainer}>
              <div>
                <div className={styles.stickyColumn}>
                  <h4>
                    {inEditMode
                      ? t('editPatientDetails', 'Edit patient details')
                      : t('createNewPatient', 'Create new patient')}
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
