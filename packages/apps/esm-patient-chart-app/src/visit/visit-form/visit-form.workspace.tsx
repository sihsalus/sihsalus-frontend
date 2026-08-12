import {
  Button,
  ButtonSet,
  ContentSwitcher,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Row,
  Stack,
  Switch,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AssignedExtension,
  Extension,
  ExtensionSlot,
  formatDatetime,
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  navigate,
  type NewVisitPayload,
  saveVisit,
  showSnackbar,
  toDateObjectStrict,
  toOmrsIsoString,
  updateVisit,
  useConfig,
  useConnectivity,
  useFeatureFlag,
  useLayoutType,
  usePatient,
  useSession,
  userHasAccess,
  useVisit,
  type Visit,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  canCopyFinanciadorToVisit,
  convertTime12to24,
  createOfflineVisitForPatient,
  type DefaultPatientWorkspaceProps,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  isFinanciadorCopyAuthorizationError,
  normalizeFinanciadorConceptUuid,
  type PatientWorkspace2DefinitionProps,
  safeCopyFinanciadorToVisit,
  SELF_FINANCED_CONCEPT_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_CONCEPT_UUID,
  type SafeCopyFinanciadorToVisitResult,
  time12HourFormatRegex,
  useActivePatientEnrollment,
} from '@openmrs/esm-patient-common-lib';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import { UnauthorizedState } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import {
  type ChartConfig,
  resolveCanonicalCoveragePersonAttributeMappings,
  resolveCanonicalCoverageVisitAttributeTypes,
} from '../../config-schema';
import { useDefaultVisitLocation } from '../hooks/useDefaultVisitLocation';
import { useEmrConfiguration } from '../hooks/useEmrConfiguration';
import { useVisitAttributeTypes } from '../hooks/useVisitAttributeType';
import { canEditVisit, canStartVisit } from '../visit-access';
import { invalidateUseVisits, useInfiniteVisits } from '../visits-widget/visit.resource';

import BaseVisitType from './base-visit-type.component';
import {
  type CompanionRecord,
  getCompanionPerson,
  getVisitCompanionPersonUuid,
  withVisitCompanionAttribute,
} from './companion.resource';
import { canRegisterCompanionPerson, canSearchCompanionPerson } from './companion-access';
import CompanionList from './companion-list.component';
import LocationSelector from './location-selector.component';
import { getMinorCompanionRequirementState, isPatientMinor } from './minor-companion-validation';
import { MemoizedRecommendedVisitType } from './recommended-visit-type.component';
import VisitAttributeTypeFields from './visit-attribute-type.component';
import VisitDateTimeField from './visit-date-time.component';
import {
  createVisitAttribute,
  deleteVisitAttribute,
  getDefaultVisitAttributesFromPatientAddress,
  getDefaultVisitAttributesFromPersonAttributes,
  getVisitAttributes,
  normalizeVisitTimeFormatInput,
  normalizeVisitTimeInput,
  reconcileVisitCreation,
  sanitizeVisitCoverageAttributes,
  updateVisitAttribute,
  useConditionalVisitTypes,
  usePersonAttributesForVisitDefaults,
  useVisitAttributeTypeExists,
  useVisitFormCallbacks,
  VISIT_PERSISTENCE_CORRELATION_CONFLICT,
  type VisitFormCallbacks,
  type VisitFormData,
  type VisitPersistenceCorrelation,
} from './visit-form.resource';
import styles from './visit-form.scss';
import { filterVisitTypesByEligibility } from './visit-type-eligibility';

dayjs.extend(isSameOrBefore);

const VISIT_SAVE_OUTCOME_UNKNOWN = 'VISIT_SAVE_OUTCOME_UNKNOWN';
const defaultCompanionPersonSearchWorkspace = 'visit-companion-search-workspace';
const defaultCompanionPersonRegistrationWorkspace = 'visit-companion-registration-workspace';
const DETERMINISTIC_VISIT_CREATE_REJECTION_STATUSES = new Set([
  400, 401, 403, 404, 405, 406, 409, 410, 412, 413, 414, 415, 416, 417, 422,
]);

function isDefinitiveClientRejection(error: unknown) {
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = Number(candidate?.status ?? candidate?.response?.status);
  return Number.isInteger(status) && DETERMINISTIC_VISIT_CREATE_REJECTION_STATUSES.has(status);
}

function hasCompleteVisitCoverage(attributes: NewVisitPayload['attributes']): boolean {
  const values = new Map((attributes ?? []).map(({ attributeType, value }) => [attributeType, value]));
  const financiador = normalizeFinanciadorConceptUuid(
    typeof values.get(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) === 'string'
      ? (values.get(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) as string)
      : null,
  );

  if (!financiador) {
    return false;
  }
  if (financiador === SELF_FINANCED_CONCEPT_UUID) {
    return true;
  }

  const hasInsuranceNumber = Boolean(String(values.get(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID) ?? '').trim());
  if (!hasInsuranceNumber) {
    return false;
  }
  if (financiador !== SIS_CONCEPT_UUID) {
    return true;
  }

  return Boolean(
    String(values.get(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID) ?? '').trim() &&
      String(values.get(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID) ?? '').trim(),
  );
}

interface StartVisitFormWorkspaceProps {
  /**
   * A unique string identifying where the visit form is opened from.
   * This string is passed into various extensions within the form to
   * affect how / if they should be rendered.
   */
  openedFrom: string;
  showPatientHeader?: boolean;
  showVisitEndDateTimeFields?: boolean;
  onVisitStarted?: (visit: Visit) => void | Promise<void>;
  onBeforeVisitSave?: (persistedVisit?: Visit) => boolean | Promise<boolean>;
  onQueueEntryAdded?: () => void | Promise<void>;
  additionalVisitAttributes?: NewVisitPayload['attributes'];
  visitPersistenceCorrelation?: VisitPersistenceCorrelation;
  /**
   * Idempotency token for the visit this form is about to create, owned by the
   * launcher. The form generates its own per mount, which a launcher that can
   * relaunch it after a failure must override: a fresh token on the second
   * attempt makes the backend treat the retry as a new visit.
   */
  visitPersistenceToken?: string;
  patientUuid?: string;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  companionPersonSearchWorkspaceName?: string;
  companionPersonRegistrationWorkspaceName?: string;
  requiredVisitLocation?: {
    uuid: string;
    display: string;
  };
  requiredVisitTypeUuid?: string;
  requestedServiceName?: string;
  requireActiveSisFinancing?: boolean;
  visitToEdit?: Visit;
  workspaceTitle?: string;
  workspaceDescription?: string;
}

type LegacyStartVisitFormProps = DefaultPatientWorkspaceProps & StartVisitFormWorkspaceProps;
type Workspace2StartVisitFormProps = PatientWorkspace2DefinitionProps<StartVisitFormWorkspaceProps, object>;
type StartVisitFormProps = LegacyStartVisitFormProps | Workspace2StartVisitFormProps;

function isWorkspace2Props(props: StartVisitFormProps): props is Workspace2StartVisitFormProps {
  return 'groupProps' in props && 'workspaceProps' in props;
}

interface ExtraVisitInfoState {
  attributes?: NewVisitPayload['attributes'];
  handleCreateExtraVisitInfo?: () => void;
}

const StartVisitForm: React.FC<StartVisitFormProps> = (props) => {
  const { t } = useTranslation();
  const isWorkspace2 = isWorkspace2Props(props);
  const workspaceProps = isWorkspace2 ? props.workspaceProps : props;
  const {
    showPatientHeader = false,
    showVisitEndDateTimeFields,
    onVisitStarted,
    onBeforeVisitSave,
    onQueueEntryAdded,
    additionalVisitAttributes,
    visitPersistenceCorrelation,
    visitPersistenceToken: providedVisitPersistenceToken,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    companionPersonSearchWorkspaceName = defaultCompanionPersonSearchWorkspace,
    companionPersonRegistrationWorkspaceName = defaultCompanionPersonRegistrationWorkspace,
    requiredVisitLocation,
    requiredVisitTypeUuid,
    requestedServiceName,
    requireActiveSisFinancing,
    visitToEdit,
    openedFrom,
    workspaceTitle,
    workspaceDescription,
  } = workspaceProps;
  const isQueueRegistration = openedFrom === 'service-queues-add-patient' && !visitToEdit;
  const initialPatientUuid = isWorkspace2
    ? (props.groupProps?.patientUuid ?? workspaceProps.patientUuid)
    : props.patientUuid;
  const closeCurrentWorkspace = useCallback(
    (options?: { ignoreChanges?: boolean }) => {
      if (isWorkspace2Props(props)) {
        void props.closeWorkspace({
          discardUnsavedChanges: options?.ignoreChanges,
        });
        return;
      }

      props.closeWorkspace(options);
    },
    [props],
  );
  const promptBeforeClosing = useCallback(
    (testFcn: () => boolean) => {
      if (!isWorkspace2Props(props)) {
        props.promptBeforeClosing(testFcn);
      }
    },
    [props],
  );
  const isTablet = useLayoutType() === 'tablet';
  const isEmrApiModuleInstalled = useFeatureFlag('emrapi-module');
  const isOnline = useConnectivity();
  const config = useConfig<ChartConfig>();
  const configuredVisitAttributeTypes = useMemo(
    () => resolveCanonicalCoverageVisitAttributeTypes(config.visitAttributeTypes),
    [config.visitAttributeTypes],
  );
  const configuredPersonAttributeMappings = useMemo(
    () => resolveCanonicalCoveragePersonAttributeMappings(config.defaultVisitAttributesFromPersonAttributes),
    [config.defaultVisitAttributesFromPersonAttributes],
  );
  const sessionUser = useSession();
  const canSearchCompanion = canSearchCompanionPerson(sessionUser?.user);
  const canRegisterCompanion = canRegisterCompanionPerson(sessionUser?.user);
  const sessionLocation = sessionUser?.sessionLocation;
  const defaultVisitLocation = useDefaultVisitLocation(
    sessionLocation,
    config.restrictByVisitLocationTag && isEmrApiModuleInstalled,
  );
  const { emrConfiguration } = useEmrConfiguration(isEmrApiModuleInstalled);
  const { patientUuid, patient, isLoading: isLoadingPatient } = usePatient(initialPatientUuid);
  const canReviewPatientCoverage = userHasAccess('app:opciones.registrarPaciente', sessionUser?.user);
  const canCopyPatientCoverage = canCopyFinanciadorToVisit(sessionUser?.user);
  const openPatientCoverageReview = useCallback(() => {
    const afterUrl = encodeURIComponent(`${globalThis.spaBase}/home`);
    navigate({
      to: `${globalThis.spaBase}/patient/${patientUuid}/edit?focusSection=insurance&afterUrl=${afterUrl}`,
    });
  }, [patientUuid]);
  const persistedCompanionPersonUuid = getVisitCompanionPersonUuid(
    visitToEdit?.attributes,
    config.companionVisitAttributeTypeUuid,
  );
  const {
    data: persistedCompanionPerson,
    error: persistedCompanionPersonError,
    isLoading: isLoadingPersistedCompanion,
  } = useSWR(
    persistedCompanionPersonUuid ? ['visit-companion-person', persistedCompanionPersonUuid] : null,
    () => getCompanionPerson(persistedCompanionPersonUuid),
    { shouldRetryOnError: false },
  );
  const [selectedCompanion, setSelectedCompanion] = useState<CompanionRecord | undefined>(() =>
    persistedCompanionPersonUuid
      ? {
          personUuid: persistedCompanionPersonUuid,
          name: persistedCompanionPersonUuid,
        }
      : undefined,
  );
  const companionSelectionTouched = useRef(false);
  const companionVisitKey = visitToEdit?.uuid ?? `new:${patientUuid}`;
  const previousCompanionVisitKey = useRef(companionVisitKey);
  const [contentSwitcherIndex, setContentSwitcherIndex] = useState(config.showRecommendedVisitTypeTab ? 0 : 1);
  const visitHeaderSlotState = useMemo(() => ({ patientUuid }), [patientUuid]);
  const { activePatientEnrollment, isLoading } = useActivePatientEnrollment(patientUuid);
  const { mutate: mutateCurrentVisit } = useVisit(patientUuid);
  const { mutateVisits: mutateInfiniteVisits } = useInfiniteVisits(patientUuid);
  const allVisitTypes = useConditionalVisitTypes();
  const { attributes: personAttributesForVisitDefaults } = usePersonAttributesForVisitDefaults(patientUuid);
  const patientIdentifierValues = useMemo(
    () =>
      Array.isArray(patient?.identifier)
        ? patient.identifier.map(({ value }) => value?.trim() ?? '').filter(Boolean)
        : undefined,
    [patient?.identifier],
  );
  const [isVisitSaved, setIsVisitSaved] = useState(false);
  const [persistedVisitPendingPostSubmit, setPersistedVisitPendingPostSubmit] = useState<Visit | null>(null);
  const [visitCreationRequiresReconciliation, setVisitCreationRequiresReconciliation] = useState(false);
  const [queueEntryPersistenceCompleted, setQueueEntryPersistenceCompleted] = useState(false);
  const completedPostSubmitActions = useRef(new Set<string>());
  const financiadorCopyInFlight = useRef<Promise<SafeCopyFinanciadorToVisitResult> | null>(null);
  const visitPersistenceToken = useRef(uuidv4());
  const pendingVisitCreationPayload = useRef<NewVisitPayload | null>(null);
  const pendingVisitCreationError = useRef<unknown>(null);
  // A missing attribute type would make the backend reject the whole visit payload,
  // so the correlation token is dropped when the backend does not have it provisioned.
  const persistenceAttributeTypeExists = useVisitAttributeTypeExists(config.visitPersistenceTokenAttributeTypeUuid);
  const companionAttributeTypeExists = useVisitAttributeTypeExists(config.companionVisitAttributeTypeUuid);
  const effectiveVisitPersistenceCorrelation = useMemo<VisitPersistenceCorrelation | undefined>(() => {
    if (visitToEdit) {
      return undefined;
    }

    if (visitPersistenceCorrelation) {
      return visitPersistenceCorrelation;
    }

    if (!persistenceAttributeTypeExists) {
      console.warn(
        `The visit attribute type ${config.visitPersistenceTokenAttributeTypeUuid} configured as visitPersistenceTokenAttributeTypeUuid does not exist on the backend. Visits will be created without the persistence token.`,
      );
      return undefined;
    }

    return config.visitPersistenceTokenAttributeTypeUuid
      ? {
          attributeType: config.visitPersistenceTokenAttributeTypeUuid,
          value: providedVisitPersistenceToken ?? visitPersistenceToken.current,
        }
      : undefined;
  }, [
    config.visitPersistenceTokenAttributeTypeUuid,
    persistenceAttributeTypeExists,
    providedVisitPersistenceToken,
    visitPersistenceCorrelation,
    visitToEdit,
  ]);

  const [errorFetchingResources, setErrorFetchingResources] = useState<{
    blockSavingForm: boolean;
  }>(null);
  const { visitAttributeTypes } = useVisitAttributeTypes();
  const [visitFormCallbacks, setVisitFormCallbacks] = useVisitFormCallbacks();
  const [extraVisitInfo, setExtraVisitInfo] = useState<ExtraVisitInfoState | null>(null);

  const showCoveragePermissionHandoff = useCallback(() => {
    const reviewAction = canReviewPatientCoverage
      ? {
          actionButtonLabel: t('reviewCoverage', 'Revisar cobertura'),
          onActionButtonClick: openPatientCoverageReview,
        }
      : {};
    showSnackbar({
      isLowContrast: true,
      kind: 'warning',
      title: t('financiadorCopyNotAuthorized', 'Consulta iniciada; cobertura requiere apoyo'),
      subtitle: t(
        'financiadorCopyNotAuthorizedSubtitle',
        'Su rol no puede sincronizar la cobertura de la consulta. Solicite a Admisión que la revise antes del FUA.',
      ),
      ...reviewAction,
    });
  }, [canReviewPatientCoverage, openPatientCoverageReview, t]);

  const copyFinanciadorWithVisibleRecovery = useCallback(
    async (visitUuid: string) => {
      const attemptCopy = async (showSuccess: boolean): Promise<SafeCopyFinanciadorToVisitResult> => {
        let copyPromise = financiadorCopyInFlight.current;
        const reportsResult = !copyPromise;
        if (!copyPromise) {
          copyPromise = safeCopyFinanciadorToVisit({
            patientUuid,
            visitUuid,
            onlyFillMissing: true,
            patientIdentifierValues,
          });
          financiadorCopyInFlight.current = copyPromise;
        }

        let result: SafeCopyFinanciadorToVisitResult;
        try {
          result = await copyPromise;
        } finally {
          if (financiadorCopyInFlight.current === copyPromise) {
            financiadorCopyInFlight.current = null;
          }
        }

        // A main-form retry can race the snackbar retry. Both reuse the same
        // request, but only its owner reports the outcome to avoid duplicate
        // warnings or success messages.
        if (!reportsResult) {
          return result;
        }

        if (result.ok === true) {
          if (result.skipped || result.reviewReason) {
            const hasAccreditationConflict = result.reviewReason === 'sis-accreditation-conflict';
            const hasIncompleteCoverage = result.reviewReason === 'incomplete-coverage';
            const reviewAction = canReviewPatientCoverage
              ? {
                  actionButtonLabel: t('reviewCoverage', 'Revisar cobertura'),
                  onActionButtonClick: openPatientCoverageReview,
                }
              : {};
            showSnackbar({
              isLowContrast: true,
              kind: 'warning',
              title: hasAccreditationConflict
                ? t('financiadorAccreditationConflict', 'La acreditación SIS requiere revisión')
                : hasIncompleteCoverage
                  ? t('financiadorIncomplete', 'Cobertura incompleta en la consulta')
                  : t('financiadorMissing', 'Consulta iniciada sin financiador'),
              subtitle: hasAccreditationConflict
                ? t(
                    'financiadorAccreditationConflictSubtitle',
                    'El estado de la consulta no coincide con la afiliación. Revíselo antes de generar el FUA.',
                  )
                : hasIncompleteCoverage
                  ? t(
                      'financiadorIncompleteSubtitle',
                      'Complete el número de afiliación y, para SIS, el estado y la fecha de acreditación antes del FUA.',
                    )
                  : t(
                      'financiadorMissingSubtitle',
                      'Registre la cobertura del paciente para completar los datos de esta consulta.',
                    ),
              ...reviewAction,
            });
            return result;
          }

          if (showSuccess) {
            showSnackbar({
              isLowContrast: true,
              kind: 'success',
              title: t('financiadorCopyRecovered', 'Cobertura registrada en la consulta'),
              subtitle: t('financiadorCopyRecoveredSubtitle', 'La reparación se completó sin crear otra consulta.'),
            });
          }
          return result;
        }

        if (isFinanciadorCopyAuthorizationError(result.error)) {
          showCoveragePermissionHandoff();
          return result;
        }

        showSnackbar({
          isLowContrast: true,
          kind: 'warning',
          title: showSuccess
            ? t('financiadorCopyRetryFailed', 'La cobertura sigue pendiente')
            : t('financiadorCopyFailed', 'Consulta iniciada; cobertura pendiente'),
          subtitle: t(
            'financiadorCopyFailedSubtitle',
            'La atención puede continuar. Reintente la cobertura; no inicie otra consulta.',
          ),
          actionButtonLabel: t('retryFinanciadorCopy', 'Reintentar cobertura'),
          onActionButtonClick: () => void attemptCopy(true),
        });
        return result;
      };

      return attemptCopy(false);
    },
    [
      canReviewPatientCoverage,
      openPatientCoverageReview,
      patientIdentifierValues,
      patientUuid,
      showCoveragePermissionHandoff,
      t,
    ],
  );

  const displayVisitStopDateTimeFields = useMemo(
    () => Boolean(visitToEdit?.uuid || showVisitEndDateTimeFields),
    [visitToEdit?.uuid, showVisitEndDateTimeFields],
  );

  const patientWithOpenmrsBirthdate = patient as
    | {
        birthdate?: string;
        person?: {
          birthdate?: string;
        };
      }
    | undefined;
  const patientBirthDateValue =
    patient?.birthDate ?? patientWithOpenmrsBirthdate?.birthdate ?? patientWithOpenmrsBirthdate?.person?.birthdate;

  const patientBirthDate = useMemo(() => {
    if (!patientBirthDateValue) {
      return null;
    }

    const birthDateValue = patientBirthDateValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? patientBirthDateValue;
    const birthDate = dayjs(birthDateValue);
    return birthDate.isValid() ? birthDate.startOf('day') : null;
  }, [patientBirthDateValue]);
  const isMinorPatient = isPatientMinor(patientBirthDateValue);
  const companionRequired = !visitToEdit && isMinorPatient;

  useEffect(() => {
    if (previousCompanionVisitKey.current !== companionVisitKey) {
      previousCompanionVisitKey.current = companionVisitKey;
      companionSelectionTouched.current = false;
      setSelectedCompanion(
        persistedCompanionPersonUuid
          ? {
              personUuid: persistedCompanionPersonUuid,
              name: persistedCompanionPersonUuid,
            }
          : undefined,
      );
    }
  }, [companionVisitKey, persistedCompanionPersonUuid]);

  useEffect(() => {
    if (
      persistedCompanionPerson &&
      !companionSelectionTouched.current &&
      persistedCompanionPerson.uuid === persistedCompanionPersonUuid
    ) {
      setSelectedCompanion({
        personUuid: persistedCompanionPerson.uuid,
        name: persistedCompanionPerson.display || persistedCompanionPerson.uuid,
      });
    }
  }, [persistedCompanionPerson, persistedCompanionPersonUuid]);

  const handleCompanionSelected = useCallback((companion: CompanionRecord) => {
    companionSelectionTouched.current = true;
    setSelectedCompanion(companion);
  }, []);

  const handleClearCompanion = useCallback(() => {
    companionSelectionTouched.current = true;
    setSelectedCompanion(undefined);
  }, []);

  const launchCompanionWorkspace = useCallback(
    (workspaceName: string) => {
      if (!isWorkspace2Props(props)) {
        return;
      }

      void props
        .launchChildWorkspace(workspaceName, {
          patientUuid,
          requireAdult: isMinorPatient,
          onCompanionSelected: handleCompanionSelected,
        })
        .catch((error) => {
          showSnackbar({
            isLowContrast: false,
            kind: 'error',
            title: t('companionWorkspaceOpenError', 'No se pudo abrir el formulario de acompañante'),
            subtitle: getCompatibleUserFacingErrorMessage(
              error,
              t('companionWorkspaceOpenErrorMessage', 'Cierre el formulario e intente nuevamente.'),
              { logContext: 'Launch visit companion workspace' },
              frameworkGetUserFacingErrorMessage,
            ),
          });
        });
    },
    [handleCompanionSelected, isMinorPatient, patientUuid, props, t],
  );
  const isLoadingCompanion =
    Boolean(persistedCompanionPersonUuid) &&
    isLoadingPersistedCompanion &&
    !persistedCompanionPersonError &&
    !companionSelectionTouched.current;
  const companionRequirementState =
    !visitToEdit && isLoadingPatient
      ? 'loading'
      : getMinorCompanionRequirementState(
          companionRequired,
          isLoadingCompanion,
          Boolean(selectedCompanion?.personUuid),
        );

  const visitFormSchema = useMemo(() => {
    const createVisitAttributeSchema = (required: boolean) =>
      required
        ? z.string({
            required_error: t('fieldRequired', 'This field is required'),
          })
        : z.string().optional();

    const visitAttributes = configuredVisitAttributeTypes.reduce<
      Record<string, ReturnType<typeof createVisitAttributeSchema>>
    >((acc, { uuid, required }) => {
      acc[uuid] = createVisitAttributeSchema(required);
      return acc;
    }, {});
    const invalidTimeFormatMessage = t('invalidTimeFormat', 'Enter a valid time in hh:mm format (01:00 to 12:59)');
    const timeFormatRequiredMessage = t('timeFormatRequired', 'Select AM or PM');
    const timeFormatSchema = z.enum(['AM', 'PM'], {
      errorMap: () => ({ message: timeFormatRequiredMessage }),
    });
    const createTimeSchema = (required: boolean) =>
      z.preprocess(
        (value) => {
          if (typeof value !== 'string') {
            return value;
          }

          const normalizedValue = normalizeVisitTimeInput(value);
          return required ? normalizedValue : normalizedValue || undefined;
        },
        required
          ? z.string().refine((value) => value.match(time12HourFormatRegex), invalidTimeFormatMessage)
          : z
              .string()
              .refine((value) => value.match(time12HourFormatRegex), invalidTimeFormatMessage)
              .optional(),
      );
    const createTimeFormatSchema = (required: boolean) =>
      z.preprocess(normalizeVisitTimeFormatInput, required ? timeFormatSchema : timeFormatSchema.optional());

    // Validates that the start time is not in the future
    const validateStartTime = (data: z.infer<typeof visitFormSchema>) => {
      const [visitStartHours, visitStartMinutes] = convertTime12to24(data.visitStartTime, data.visitStartTimeFormat);
      const visitStartDatetime = new Date(data.visitStartDate).setHours(visitStartHours, visitStartMinutes);
      return new Date(visitStartDatetime) <= new Date();
    };

    const hadPreviousStopDateTime = Boolean(visitToEdit?.stopDatetime);

    return z
      .object({
        visitStartDate: z
          .date()
          .refine(
            (value) => {
              const today = dayjs();
              const startDate = dayjs(value);

              return startDate.isSameOrBefore(today, 'day');
            },
            t('invalidVisitStartDate', 'Start date needs to be on or before {{firstEncounterDatetime}}', {
              firstEncounterDatetime: formatDatetime(new Date()),
            }),
          )
          .refine(
            (value) => !patientBirthDate || !dayjs(value).isBefore(patientBirthDate, 'day'),
            t('visitStartDateCannotBeBeforeBirthDate', "Visit start date cannot be before the patient's birth date"),
          ),
        visitStartTime: createTimeSchema(true),
        visitStartTimeFormat: createTimeFormatSchema(true),
        visitStopDate: displayVisitStopDateTimeFields && hadPreviousStopDateTime ? z.date() : z.date().optional(),
        visitStopTime:
          displayVisitStopDateTimeFields && hadPreviousStopDateTime ? createTimeSchema(true) : createTimeSchema(false),
        visitStopTimeFormat:
          displayVisitStopDateTimeFields && hadPreviousStopDateTime
            ? createTimeFormatSchema(true)
            : createTimeFormatSchema(false),
        programType: z.string().optional(),
        visitType: z.string().refine((value) => !!value, t('visitTypeRequired', 'Care type is required')),
        visitLocation: z.object({
          display: z.string().optional(),
          uuid: z
            .string({
              required_error: t('visitLocationRequired', 'Care UPSS is required'),
            })
            .min(1, t('visitLocationRequired', 'Care UPSS is required')),
        }),
        visitAttributes: z.object(visitAttributes),
      })
      .refine((data) => validateStartTime(data), {
        message: t('futureStartTime', 'Visit start time cannot be in the future'),
        path: ['visitStartTime'],
      })
      .refine((data) => !(displayVisitStopDateTimeFields && data.visitStopDate && !data.visitStopTime), {
        message: t('visitStopTimeRequired', 'Visit stop time is required'),
        path: ['visitStopTime'],
      })
      .refine(
        (data) =>
          !(displayVisitStopDateTimeFields && data.visitStopDate && data.visitStopTime && !data.visitStopTimeFormat),
        {
          message: t('visitStopTimeFormatRequired', 'Visit stop time format is required'),
          path: ['visitStopTimeFormat'],
        },
      );
  }, [configuredVisitAttributeTypes, patientBirthDate, visitToEdit?.stopDatetime, t, displayVisitStopDateTimeFields]);

  const defaultValues = useMemo(() => {
    const visitStartDate = visitToEdit?.startDatetime ? new Date(visitToEdit?.startDatetime) : new Date();
    const visitStopDate = visitToEdit?.stopDatetime ? new Date(visitToEdit?.stopDatetime) : null;

    let defaultValues: Partial<VisitFormData> = {
      visitStartDate,
      visitStartTime: dayjs(visitStartDate).format('hh:mm'),
      visitStartTimeFormat: new Date(visitStartDate).getHours() >= 12 ? 'PM' : 'AM',
      visitStopTimeFormat: new Date().getHours() >= 12 ? 'PM' : 'AM',
      visitType: visitToEdit?.visitType?.uuid ?? requiredVisitTypeUuid ?? emrConfiguration?.atFacilityVisitType?.uuid,
      visitLocation: visitToEdit?.location ?? requiredVisitLocation ?? defaultVisitLocation ?? {},
      visitAttributes:
        visitToEdit?.attributes.reduce<Record<string, string>>((acc, curr) => {
          acc[curr.attributeType.uuid] = typeof curr.value === 'object' ? curr?.value?.uuid : `${curr.value ?? ''}`;
          return acc;
        }, {}) ?? getDefaultVisitAttributes(),
    };

    if (visitStopDate) {
      defaultValues = {
        ...defaultValues,
        visitStopDate,
        visitStopTime: dayjs(visitStopDate).format('hh:mm'),
        visitStopTimeFormat: visitStopDate.getHours() >= 12 ? 'PM' : 'AM',
      };
    }

    function getDefaultVisitAttributes() {
      const configuredVisitAttributeUuids = new Set(configuredVisitAttributeTypes.map(({ uuid }) => uuid));
      const personAttributeDefaults = getDefaultVisitAttributesFromPersonAttributes(
        patient,
        personAttributesForVisitDefaults,
        configuredPersonAttributeMappings,
        configuredVisitAttributeUuids,
      );
      const addressDefaults = getDefaultVisitAttributesFromPatientAddress(
        patient,
        config.defaultVisitAttributesFromPatientAddress,
        configuredVisitAttributeUuids,
      );

      return {
        ...addressDefaults,
        ...personAttributeDefaults,
      };
    }

    return defaultValues;
  }, [
    visitToEdit,
    defaultVisitLocation,
    requiredVisitLocation,
    requiredVisitTypeUuid,
    emrConfiguration,
    patient,
    configuredVisitAttributeTypes,
    configuredPersonAttributeMappings,
    config.defaultVisitAttributesFromPatientAddress,
    personAttributesForVisitDefaults,
  ]);

  const methods = useForm<VisitFormData>({
    mode: 'all',
    resolver: zodResolver(visitFormSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    control,
    getValues,
    formState: { errors, isDirty, isSubmitting },
    setError,
    reset,
    setValue,
  } = methods;
  const selectedVisitLocation = useWatch({ control, name: 'visitLocation' });
  const selectedVisitType = useWatch({ control, name: 'visitType' });
  const availableVisitTypes = useMemo(
    () =>
      isQueueRegistration
        ? filterVisitTypesByEligibility(
            allVisitTypes,
            config.visitTypeEligibilityRules,
            selectedVisitLocation?.uuid,
            patient?.gender,
          )
        : allVisitTypes,
    [
      allVisitTypes,
      config.visitTypeEligibilityRules,
      isQueueRegistration,
      patient?.gender,
      selectedVisitLocation?.uuid,
    ],
  );
  const allowedVisitTypeUuids = useMemo(
    () => (isQueueRegistration ? new Set(availableVisitTypes.map(({ uuid }) => uuid)) : undefined),
    [availableVisitTypes, isQueueRegistration],
  );

  useEffect(() => {
    if (
      selectedVisitType &&
      allVisitTypes.length &&
      !availableVisitTypes.some((visitType) => visitType.uuid === selectedVisitType)
    ) {
      setValue('visitType', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [allVisitTypes.length, availableVisitTypes, selectedVisitType, setValue]);

  // default values are cached so form needs to be reset when they change (e.g. when default visit location finishes loading)
  useEffect(() => {
    reset(defaultValues, { keepDirtyValues: true });
  }, [defaultValues, reset]);

  useEffect(() => {
    promptBeforeClosing(
      () =>
        (isDirty && !isVisitSaved) || Boolean(persistedVisitPendingPostSubmit) || visitCreationRequiresReconciliation,
    );
  }, [
    isDirty,
    isVisitSaved,
    persistedVisitPendingPostSubmit,
    promptBeforeClosing,
    visitCreationRequiresReconciliation,
  ]);

  const [maxVisitStartDatetime, initialMinVisitStopDatetime] = useMemo(() => {
    const now = Date.now();

    if (!visitToEdit?.encounters?.length) {
      return [now, null];
    }

    const allEncounterDatetimes = visitToEdit?.encounters?.map(({ encounterDatetime }) =>
      Date.parse(encounterDatetime),
    );

    const maxVisitStartDatetime = Math.min(...allEncounterDatetimes);
    const minVisitStopDatetime = Math.max(...allEncounterDatetimes);
    return [maxVisitStartDatetime, minVisitStopDatetime];
  }, [visitToEdit]);

  const visitStartDate = getValues('visitStartDate') ?? new Date();
  const minVisitStopDatetime = initialMinVisitStopDatetime ?? Date.parse(visitStartDate.toLocaleString());
  const minVisitStopDatetimeFallback = Date.parse(visitStartDate.toLocaleString());
  const resolvedMinVisitStopDatetime = minVisitStopDatetime || minVisitStopDatetimeFallback;

  const validateVisitStartStopDatetime = useCallback(() => {
    const visitStartDate = getValues('visitStartDate');
    const visitStartTime = getValues('visitStartTime');
    const visitStartTimeFormat = getValues('visitStartTimeFormat');

    const [visitStartHours, visitStartMinutes] = convertTime12to24(visitStartTime, visitStartTimeFormat);

    const visitStartDatetime = visitStartDate.setHours(visitStartHours, visitStartMinutes);

    let validSubmission = true;

    if (maxVisitStartDatetime && visitStartDatetime >= maxVisitStartDatetime) {
      validSubmission = false;
      setError('visitStartDate', {
        message: t('invalidVisitStartDate', 'Start date needs to be on or before {{firstEncounterDatetime}}', {
          firstEncounterDatetime: formatDatetime(new Date(maxVisitStartDatetime)),
        }),
      });
    }

    if (!displayVisitStopDateTimeFields) {
      return validSubmission;
    }

    const visitStopDate = getValues('visitStopDate');
    const visitStopTime = getValues('visitStopTime');
    const visitStopTimeFormat = getValues('visitStopTimeFormat');

    if (visitStopDate && visitStopTime && visitStopTimeFormat) {
      const [visitStopHours, visitStopMinutes] = convertTime12to24(visitStopTime, visitStopTimeFormat);

      const visitStopDatetime = visitStopDate.setHours(visitStopHours, visitStopMinutes);

      if (minVisitStopDatetime && visitStopDatetime <= minVisitStopDatetime) {
        validSubmission = false;
        setError('visitStopDate', {
          message: t(
            'visitStopDateMustBeAfterMostRecentEncounter',
            'Stop date needs to be on or after {{lastEncounterDatetime}}',
            {
              lastEncounterDatetime: formatDatetime(new Date(minVisitStopDatetime)),
            },
          ),
        });
      }

      if (visitStartDatetime >= visitStopDatetime) {
        validSubmission = false;
        setError('visitStopDate', {
          message: t('invalidVisitStopDate', 'Visit stop date time cannot be on or before visit start date time'),
        });
      }
    }

    return validSubmission;
  }, [displayVisitStopDateTimeFields, getValues, maxVisitStartDatetime, minVisitStopDatetime, setError, t]);

  const handleVisitAttributes = useCallback(
    async (visitAttributes: { [p: string]: string }, visitUuid: string) => {
      const responses = [];
      const getPersistedValue = (persistedValue: unknown) => {
        if (persistedValue && typeof persistedValue === 'object' && 'uuid' in persistedValue) {
          return String(persistedValue.uuid ?? '');
        }

        return String(persistedValue ?? '');
      };
      let persistedAttributes = await getVisitAttributes(visitUuid);
      const findPersistedAttribute = (attributeType: string) =>
        persistedAttributes.find((attribute) => attribute.attributeType?.uuid === attributeType);
      const replacePersistedAttribute = (
        attributeType: string,
        attribute: (typeof persistedAttributes)[number] | undefined,
      ) => {
        persistedAttributes = persistedAttributes.filter(
          (persistedAttribute) => persistedAttribute.attributeType?.uuid !== attributeType,
        );
        if (attribute) {
          persistedAttributes.push(attribute);
        }
      };

      const persistVisitAttribute = async (
        attributeType: string,
        value: string,
        { completeAction = true }: { completeAction?: boolean } = {},
      ) => {
        const actionId = `visit-attribute:${attributeType}`;
        if (completeAction && completedPostSubmitActions.current.has(actionId)) {
          return;
        }

        const attributeToEdit = findPersistedAttribute(attributeType);
        const originalAttribute = visitToEdit?.attributes?.find(
          (attribute) => attribute.attributeType.uuid === attributeType,
        );
        const attributeName =
          originalAttribute?.attributeType.display ??
          visitAttributeTypes?.find((type) => type.uuid === attributeType)?.display ??
          t('visitAttribute', 'atributo de consulta');

        try {
          if (attributeToEdit) {
            const isSameValue = getPersistedValue(attributeToEdit.value) === value;

            if (!isSameValue) {
              const response = value
                ? await updateVisitAttribute(visitUuid, attributeToEdit.uuid, value)
                : await deleteVisitAttribute(visitUuid, attributeToEdit.uuid);
              responses.push(response);
              replacePersistedAttribute(attributeType, value ? { ...attributeToEdit, value } : undefined);
            }
          } else if (value) {
            const response = await createVisitAttribute(visitUuid, attributeType, value);
            responses.push(response);
            replacePersistedAttribute(attributeType, {
              uuid: response?.data?.uuid ?? `pending-${attributeType}`,
              attributeType: { uuid: attributeType },
              value,
            });
          }

          if (completeAction) {
            completedPostSubmitActions.current.add(actionId);
          }
        } catch (error) {
          try {
            persistedAttributes = await getVisitAttributes(visitUuid);
            const reconciledAttribute = findPersistedAttribute(attributeType);
            const attributeWasReconciled = value
              ? getPersistedValue(reconciledAttribute?.value) === value
              : !reconciledAttribute;

            if (attributeWasReconciled) {
              console.error('Visit attribute write returned an error but server state confirms success.', error);
              if (completeAction) {
                completedPostSubmitActions.current.add(actionId);
              }
              return;
            }
          } catch (reconciliationError) {
            console.error('Could not reconcile the visit attribute after a write failure.', reconciliationError);
          }

          const title = attributeToEdit
            ? value
              ? t('errorUpdatingVisitAttribute', 'No se pudo actualizar el atributo {{attributeName}}', {
                  attributeName,
                })
              : t('errorDeletingVisitAttribute', 'No se pudo eliminar el atributo {{attributeName}}', {
                  attributeName,
                })
            : t('errorCreatingVisitAttribute', 'No se pudo crear el atributo {{attributeName}}', {
                attributeName,
              });
          showSnackbar({
            title,
            kind: 'error',
            isLowContrast: false,
            subtitle: getCompatibleUserFacingErrorMessage(
              error,
              t('visitAttributeSaveFailed', 'No se pudo guardar el atributo de la consulta. Intente nuevamente.'),
              { logContext: `Persist visit attribute ${attributeType}` },
              frameworkGetUserFacingErrorMessage,
            ),
          });
          throw error;
        }
      };

      const coverageAttributeTypes = new Set([
        FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
        INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
        SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
        SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
      ]);
      const semanticCoverageIsConfigured = configuredVisitAttributeTypes.some(
        ({ uuid }) => uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
      );

      // Unrelated attributes are independent of the coverage transaction and
      // can be completed before its commit-marker protocol begins.
      for (const [attributeType, value] of Object.entries(visitAttributes)) {
        if (semanticCoverageIsConfigured && coverageAttributeTypes.has(attributeType)) {
          continue;
        }
        await persistVisitAttribute(attributeType, value);
      }

      if (semanticCoverageIsConfigured) {
        const desiredCoverage = new Map(
          [...coverageAttributeTypes].map((attributeType) => [attributeType, visitAttributes[attributeType] ?? '']),
        );
        const coverageWillChange = [...desiredCoverage].some(
          ([attributeType, value]) => getPersistedValue(findPersistedAttribute(attributeType)?.value) !== value,
        );

        if (coverageWillChange) {
          const desiredStatus = desiredCoverage.get(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID) ?? '';
          const persistedPayer = normalizeFinanciadorConceptUuid(
            getPersistedValue(findPersistedAttribute(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID)?.value) || null,
          );
          const desiredPayer = normalizeFinanciadorConceptUuid(
            desiredCoverage.get(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) || null,
          );
          const payerBecomesSis = desiredPayer === SIS_CONCEPT_UUID && persistedPayer !== SIS_CONCEPT_UUID;

          // The SIS status is the commit marker for the number/date bundle.
          // Invalidate it before any coverage mutation and recreate it only
          // after the complements and payer have converged.
          await persistVisitAttribute(SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID, '', {
            completeAction: !desiredStatus,
          });

          // A transition into SIS commits its payer first so any later failure
          // remains discoverable as SIS + missing status. A transition away
          // from SIS keeps the old SIS payer until its complements are cleaned,
          // preserving the same durable worklist marker.
          if (payerBecomesSis) {
            await persistVisitAttribute(
              FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
              desiredCoverage.get(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) ?? '',
            );
          }
          await persistVisitAttribute(
            INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
            desiredCoverage.get(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID) ?? '',
          );
          await persistVisitAttribute(
            SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
            desiredCoverage.get(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID) ?? '',
          );
          if (!payerBecomesSis) {
            await persistVisitAttribute(
              FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
              desiredCoverage.get(FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID) ?? '',
            );
          }
          const hasCompleteSisComplements = Boolean(
            (desiredCoverage.get(INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID) ?? '').trim() &&
              (desiredCoverage.get(SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID) ?? '').trim(),
          );
          await persistVisitAttribute(
            SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
            desiredPayer === SIS_CONCEPT_UUID && hasCompleteSisComplements ? desiredStatus : '',
          );
        } else {
          for (const attributeType of coverageAttributeTypes) {
            completedPostSubmitActions.current.add(`visit-attribute:${attributeType}`);
          }
        }
      }

      return responses;
    },
    [configuredVisitAttributeTypes, visitToEdit, t, visitAttributeTypes],
  );

  const onSubmit = useCallback(
    async (data: VisitFormData) => {
      if (visitToEdit && !validateVisitStartStopDatetime()) {
        return;
      }

      if (companionRequirementState === 'loading') {
        showSnackbar({
          title: t('companionsLoading', 'No se pudo validar el acompañante'),
          subtitle: t('companionsLoadingMessage', 'Espere a que se carguen los acompañantes e intente nuevamente.'),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      if (companionRequirementState === 'missing') {
        showSnackbar({
          title: t('companionRequiredForMinorTitle', 'Acompañante obligatorio'),
          subtitle: t(
            'companionRequiredForMinor',
            'Seleccione o registre un acompañante adulto antes de iniciar la consulta del menor.',
          ),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      if (selectedCompanion && !companionAttributeTypeExists) {
        showSnackbar({
          title: t('companionConfigurationMissing', 'No se pudo guardar el acompañante'),
          subtitle: t(
            'companionConfigurationMissingMessage',
            'El atributo de acompañante por consulta no está configurado. Contacte a soporte.',
          ),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      const queueEntryIsRequired =
        openedFrom === 'appointments-check-in' || openedFrom === 'service-queues-add-patient';
      if (queueEntryIsRequired && !isOnline) {
        showSnackbar({
          title: t('queueEntryOfflineUnavailable', 'No se puede registrar la atención sin conexión'),
          subtitle: t(
            'queueEntryOfflineUnavailableMessage',
            'La admisión de citas y colas requiere conexión. No se creó la consulta.',
          ),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      const hasQueueEntryCallback = [...visitFormCallbacks.values()].some(
        (callbacks) => callbacks.kind === 'queue-entry',
      );
      if (queueEntryIsRequired && !hasQueueEntryCallback && !queueEntryPersistenceCompleted) {
        showSnackbar({
          title: t('queueEntryUnavailable', 'No se puede registrar la cola'),
          subtitle: t(
            'queueEntryUnavailableMessage',
            'No se cargó el formulario de cola o el usuario no tiene el privilegio requerido. La consulta no fue creada.',
          ),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      let recoveredVisit = persistedVisitPendingPostSubmit;
      if (isOnline && !visitToEdit && !recoveredVisit && pendingVisitCreationPayload.current) {
        if (!effectiveVisitPersistenceCorrelation) {
          showSnackbar({
            title: t('visitSaveRequiresReconciliation', 'No se pudo confirmar la consulta'),
            subtitle: t(
              'visitSaveOutcomeManualReview',
              'No vuelva a enviar el formulario. Ciérrelo y verifique las consultas activas del paciente antes de continuar.',
            ),
            kind: 'error',
            isLowContrast: false,
          });
          return;
        }

        try {
          recoveredVisit = await reconcileVisitCreation(
            patientUuid,
            pendingVisitCreationPayload.current,
            effectiveVisitPersistenceCorrelation,
          );
        } catch (error) {
          const recoveryError =
            (error as { code?: string })?.code === VISIT_PERSISTENCE_CORRELATION_CONFLICT
              ? error
              : Object.assign(new Error('The visit creation result could not be reconciled.'), {
                  code: VISIT_SAVE_OUTCOME_UNKNOWN,
                  cause: error,
                });
          showSnackbar({
            title: t('visitSaveRequiresReconciliation', 'No se pudo confirmar la consulta'),
            subtitle: getCompatibleUserFacingErrorMessage(
              recoveryError,
              t(
                'visitSaveOutcomeUnknown',
                'No repita la admisión. Pulse Reintentar para verificar la consulta antes de continuar.',
              ),
              {
                codeMessages: {
                  [VISIT_PERSISTENCE_CORRELATION_CONFLICT]: t(
                    'visitPersistenceCorrelationConflict',
                    'Se encontraron consultas inconsistentes para este registro. Regularícelas antes de continuar.',
                  ),
                },
                logContext: 'Reconcile pending visit creation before retry',
              },
              frameworkGetUserFacingErrorMessage,
            ),
            kind: 'error',
            isLowContrast: false,
          });
          return;
        }

        if (recoveredVisit) {
          console.error(
            'Visit creation returned an error but the correlated server state confirms success.',
            pendingVisitCreationError.current,
          );
          pendingVisitCreationPayload.current = null;
          pendingVisitCreationError.current = null;
          setVisitCreationRequiresReconciliation(false);
          setIsVisitSaved(true);
          setPersistedVisitPendingPostSubmit(recoveredVisit);
        } else {
          showSnackbar({
            title: t('visitSaveRequiresReconciliation', 'No se pudo confirmar la consulta'),
            subtitle: t(
              'visitSaveOutcomeUnknown',
              'No repita la admisión. Pulse Reintentar para verificar la consulta antes de continuar.',
            ),
            kind: 'error',
            isLowContrast: false,
          });
          return;
        }
      }

      if (onBeforeVisitSave && !(await onBeforeVisitSave(recoveredVisit ?? visitToEdit))) {
        return;
      }

      for (const [extensionId, callbacks] of visitFormCallbacks) {
        const actionId = `extension:${extensionId}`;
        if (
          !completedPostSubmitActions.current.has(actionId) &&
          callbacks.onBeforeVisitSave &&
          !(await callbacks.onBeforeVisitSave())
        ) {
          return;
        }
      }

      const {
        visitStartTimeFormat,
        visitStartDate,
        visitLocation,
        visitStartTime,
        visitType,
        visitAttributes,
        visitStopDate,
        visitStopTime,
        visitStopTimeFormat,
      } = data;

      const [hours, minutes] = convertTime12to24(visitStartTime, visitStartTimeFormat);
      const submissionDatetime = new Date();
      const currentSeconds = submissionDatetime.getSeconds();
      const startDatetime = isQueueRegistration
        ? submissionDatetime
        : new Date(
            dayjs(visitStartDate).year(),
            dayjs(visitStartDate).month(),
            dayjs(visitStartDate).date(),
            hours,
            minutes,
            currentSeconds,
          );
      const sanitizedVisitAttributes = sanitizeVisitCoverageAttributes(
        visitAttributes,
        patientIdentifierValues ?? [],
        configuredVisitAttributeTypes.some(({ uuid }) => uuid === FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID),
      );
      const visitAttributesWithCompanion = withVisitCompanionAttribute(
        sanitizedVisitAttributes,
        config.companionVisitAttributeTypeUuid,
        selectedCompanion?.personUuid,
      );
      const submittedVisitAttributes = Object.entries(visitAttributesWithCompanion)
        .filter(([attributeType, value]) => Boolean(attributeType && value))
        .map(([attributeType, value]) => ({ attributeType, value }));
      const initialVisitAttributes = [...(additionalVisitAttributes ?? [])];
      if (!visitToEdit) {
        for (const attribute of submittedVisitAttributes) {
          if (!initialVisitAttributes.some(({ attributeType }) => attributeType === attribute.attributeType)) {
            initialVisitAttributes.push(attribute);
          }
        }
      }
      const payload: NewVisitPayload = {
        patient: patientUuid,
        startDatetime: toDateObjectStrict(toOmrsIsoString(startDatetime)),
        visitType: visitType,
        location: visitLocation?.uuid,
        attributes: initialVisitAttributes.length ? initialVisitAttributes : undefined,
      };

      if (
        effectiveVisitPersistenceCorrelation &&
        !visitPersistenceCorrelation &&
        !payload.attributes?.some(
          (attribute) => attribute.attributeType === effectiveVisitPersistenceCorrelation.attributeType,
        )
      ) {
        payload.attributes = [...(payload.attributes ?? []), effectiveVisitPersistenceCorrelation];
      }

      if (visitToEdit?.uuid) {
        // The request throws 400 (Bad request) error when the patient is passed in the update payload
        delete payload.patient;
      }

      if (displayVisitStopDateTimeFields && visitStopDate && visitStopTime && visitStopTimeFormat) {
        const [visitStopHours, visitStopMinutes] = convertTime12to24(visitStopTime, visitStopTimeFormat);

        payload.stopDatetime = toDateObjectStrict(
          toOmrsIsoString(
            new Date(
              dayjs(visitStopDate).year(),
              dayjs(visitStopDate).month(),
              dayjs(visitStopDate).date(),
              visitStopHours,
              visitStopMinutes,
              currentSeconds,
            ),
          ),
        );
      }

      const abortController = new AbortController();

      if (config.showExtraVisitAttributesSlot) {
        const { attributes: extraAttributes } = extraVisitInfo ?? {};
        if (Array.isArray(extraAttributes) && extraAttributes.length > 0) {
          if (!payload.attributes) {
            payload.attributes = [];
          }
          payload.attributes.push(...extraAttributes);
        }
      }

      const coverageCapturedInVisitPayload = hasCompleteVisitCoverage(payload.attributes);

      if (isOnline) {
        let visit: Visit | null = recoveredVisit;

        try {
          if (!visit) {
            if (!completedPostSubmitActions.current.has('extra-visit-info')) {
              await extraVisitInfo?.handleCreateExtraVisitInfo?.();
              completedPostSubmitActions.current.add('extra-visit-info');
            }

            if (visitToEdit?.uuid) {
              const response = await updateVisit(visitToEdit.uuid, payload, abortController);
              visit = response.data;
            } else {
              pendingVisitCreationPayload.current = payload;
              setVisitCreationRequiresReconciliation(true);

              try {
                const response = await saveVisit(payload, abortController);
                visit = response.data;
                pendingVisitCreationPayload.current = null;
                pendingVisitCreationError.current = null;
                setVisitCreationRequiresReconciliation(false);
              } catch (saveError) {
                if (isDefinitiveClientRejection(saveError)) {
                  pendingVisitCreationPayload.current = null;
                  pendingVisitCreationError.current = null;
                  setVisitCreationRequiresReconciliation(false);
                  throw saveError;
                }

                if (!effectiveVisitPersistenceCorrelation) {
                  pendingVisitCreationError.current = saveError;
                  throw Object.assign(new Error('The visit creation result is unknown.'), {
                    code: VISIT_SAVE_OUTCOME_UNKNOWN,
                    cause: saveError,
                  });
                }

                pendingVisitCreationError.current = saveError;
                try {
                  visit = await reconcileVisitCreation(patientUuid, payload, effectiveVisitPersistenceCorrelation);
                } catch (reconciliationError) {
                  console.error('Could not reconcile visit creation after a write failure.', reconciliationError);
                  if ((reconciliationError as { code?: string })?.code === VISIT_PERSISTENCE_CORRELATION_CONFLICT) {
                    throw reconciliationError;
                  }
                  throw Object.assign(new Error('The visit creation result could not be reconciled.'), {
                    code: VISIT_SAVE_OUTCOME_UNKNOWN,
                    cause: reconciliationError,
                  });
                }

                if (!visit) {
                  throw Object.assign(new Error('The visit creation result is unknown.'), {
                    code: VISIT_SAVE_OUTCOME_UNKNOWN,
                    cause: saveError,
                  });
                }

                console.error(
                  'Visit creation returned an error but the correlated server state confirms success.',
                  saveError,
                );
                pendingVisitCreationPayload.current = null;
                pendingVisitCreationError.current = null;
                setVisitCreationRequiresReconciliation(false);
              }
            }

            setIsVisitSaved(true);
            setPersistedVisitPendingPostSubmit(visit);
          }

          if (!visitToEdit) {
            for (const { attributeType } of submittedVisitAttributes) {
              completedPostSubmitActions.current.add(`visit-attribute:${attributeType}`);
            }
            completedPostSubmitActions.current.add('visit-attributes');
          }

          if (!completedPostSubmitActions.current.has('visit-attributes')) {
            const visitAttributesResponses = await handleVisitAttributes(visitAttributesWithCompanion, visit.uuid);
            completedPostSubmitActions.current.add('visit-attributes');
            if (visitAttributesResponses.length > 0) {
              showSnackbar({
                isLowContrast: true,
                kind: 'success',
                title: t(
                  'additionalVisitInformationUpdatedSuccessfully',
                  'Additional visit information updated successfully',
                ),
              });
            }
          }

          // Backfill coverage only when the create payload did not already carry
          // a complete canonical bundle. Normal clinical flows keep this
          // non-blocking; triage waits for it before running the queue callback,
          // without rolling back or recreating the already persisted visit.
          // Users without the REST capability receive a deterministic handoff to
          // Admisión instead of a retry action that cannot succeed for their role.
          if (!visitToEdit && !completedPostSubmitActions.current.has('financiador')) {
            if (coverageCapturedInVisitPayload) {
              completedPostSubmitActions.current.add('financiador');
            } else if (!canCopyPatientCoverage) {
              completedPostSubmitActions.current.add('financiador');
              showCoveragePermissionHandoff();
            } else {
              const recordCoverageResult = (coverageResult: SafeCopyFinanciadorToVisitResult) => {
                if (
                  (coverageResult.ok === true && !coverageResult.skipped && !coverageResult.reviewReason) ||
                  (coverageResult.ok === false && isFinanciadorCopyAuthorizationError(coverageResult.error))
                ) {
                  completedPostSubmitActions.current.add('financiador');
                }
              };
              const coverageCopy = copyFinanciadorWithVisibleRecovery(visit.uuid);
              if (requireActiveSisFinancing) {
                recordCoverageResult(await coverageCopy);
              } else {
                void coverageCopy.then(recordCoverageResult);
              }
            }
          }

          for (const [extensionId, callbacks] of visitFormCallbacks) {
            const actionId = `extension:${extensionId}`;
            if (!completedPostSubmitActions.current.has(actionId)) {
              await callbacks.onVisitCreatedOrUpdated(visit);
              completedPostSubmitActions.current.add(actionId);
              if (callbacks.kind === 'queue-entry') {
                setQueueEntryPersistenceCompleted(true);
              }
            }
          }

          if (!visitToEdit && onVisitStarted && !completedPostSubmitActions.current.has('visit-started')) {
            await onVisitStarted(visit);
            completedPostSubmitActions.current.add('visit-started');
          }

          if (!isQueueRegistration) {
            showSnackbar({
              isLowContrast: true,
              kind: 'success',
              subtitle: !visitToEdit
                ? t('visitStartedSuccessfully', '{{visit}} started successfully', {
                    visit: visit.visitType?.display ?? t('visit', 'Visit'),
                  })
                : t('visitDetailsUpdatedSuccessfully', '{{visit}} updated successfully', {
                    visit: visit.visitType?.display ?? t('pastVisit', 'Past visit'),
                  }),
              title: !visitToEdit
                ? t('visitStarted', 'Visit started')
                : t('visitDetailsUpdated', 'Visit details updated'),
            });
          }

          setPersistedVisitPendingPostSubmit(null);
          setVisitCreationRequiresReconciliation(false);
          setQueueEntryPersistenceCompleted(false);
          completedPostSubmitActions.current.clear();
          closeCurrentWorkspace({ ignoreChanges: true });
        } catch (error) {
          const visitWasPersisted = Boolean(visit);
          showSnackbar({
            title: visitWasPersisted
              ? t('visitStartedWithPendingActions', 'Consulta iniciada con acciones pendientes')
              : !visitToEdit
                ? t('startVisitError', 'No se pudo iniciar la consulta')
                : t('errorUpdatingVisitDetails', 'No se pudieron actualizar los datos de la consulta'),
            kind: 'error',
            isLowContrast: false,
            subtitle: getCompatibleUserFacingErrorMessage(
              error,
              visitWasPersisted
                ? t(
                    'visitPostSubmitActionFailed',
                    'La consulta ya fue guardada. Pulse Reintentar para completar el registro; no inicie otra consulta.',
                  )
                : t('visitSaveFailed', 'No se pudo guardar la consulta. Intente nuevamente.'),
              {
                codeMessages: {
                  [VISIT_SAVE_OUTCOME_UNKNOWN]: t(
                    effectiveVisitPersistenceCorrelation ? 'visitSaveOutcomeUnknown' : 'visitSaveOutcomeManualReview',
                    effectiveVisitPersistenceCorrelation
                      ? 'No repita la admisión. Pulse Reintentar para verificar la consulta antes de continuar.'
                      : 'No vuelva a enviar el formulario. Ciérrelo y verifique las consultas activas del paciente antes de continuar.',
                  ),
                  [VISIT_PERSISTENCE_CORRELATION_CONFLICT]: t(
                    'visitPersistenceCorrelationConflict',
                    'Se encontraron consultas inconsistentes para este registro. Regularícelas antes de continuar.',
                  ),
                },
                logContext: visitWasPersisted ? 'Complete visit post-submit actions' : 'Save visit',
              },
              frameworkGetUserFacingErrorMessage,
            ),
          });
        } finally {
          mutateCurrentVisit();
          invalidateUseVisits(patientUuid);
          mutateInfiniteVisits();
        }

        return;
      } else {
        extraVisitInfo?.handleCreateExtraVisitInfo?.();
        createOfflineVisitForPatient(
          patientUuid,
          visitLocation.uuid,
          config.offlineVisitTypeUuid,
          payload.startDatetime,
        ).then(
          () => {
            setIsVisitSaved(true);
            mutateCurrentVisit();
            closeCurrentWorkspace({ ignoreChanges: true });
            showSnackbar({
              isLowContrast: true,
              kind: 'success',
              subtitle: t('visitStartedSuccessfully', '{{visit}} started successfully', {
                visit: t('offlineVisit', 'Offline Visit'),
              }),
              title: t('visitStarted', 'Visit started'),
            });
          },
          (error: Error) => {
            showSnackbar({
              title: t('startVisitError', 'No se pudo iniciar la consulta'),
              kind: 'error',
              isLowContrast: false,
              subtitle: getCompatibleUserFacingErrorMessage(
                error,
                t('offlineVisitSaveFailed', 'No se pudo guardar la consulta sin conexión. Intente nuevamente.'),
                { logContext: 'Save offline visit' },
                frameworkGetUserFacingErrorMessage,
              ),
            });
          },
        );

        return;
      }
    },
    [
      closeCurrentWorkspace,
      additionalVisitAttributes,
      config.offlineVisitTypeUuid,
      config.companionVisitAttributeTypeUuid,
      config.showExtraVisitAttributesSlot,
      configuredVisitAttributeTypes,
      displayVisitStopDateTimeFields,
      extraVisitInfo,
      handleVisitAttributes,
      effectiveVisitPersistenceCorrelation,
      isOnline,
      isQueueRegistration,
      mutateCurrentVisit,
      mutateInfiniteVisits,
      onVisitStarted,
      onBeforeVisitSave,
      openedFrom,
      persistedVisitPendingPostSubmit,
      queueEntryPersistenceCompleted,
      visitFormCallbacks,
      visitPersistenceCorrelation,
      patientUuid,
      t,
      validateVisitStartStopDatetime,
      visitToEdit,
      companionRequirementState,
      companionAttributeTypeExists,
      canCopyPatientCoverage,
      copyFinanciadorWithVisibleRecovery,
      requireActiveSisFinancing,
      showCoveragePermissionHandoff,
      patientIdentifierValues,
      selectedCompanion,
    ],
  );

  const content = (
    <FormProvider {...methods}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)} data-openmrs-role="Start Visit Form">
        {persistedVisitPendingPostSubmit ? (
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('visitSavedPendingCompletion', 'La consulta ya fue guardada')}
            subtitle={t(
              'visitSavedPendingCompletionMessage',
              'Los datos guardados permanecen bloqueados mientras se reintentan las acciones pendientes.',
            )}
          />
        ) : visitCreationRequiresReconciliation ? (
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('visitSaveRequiresReconciliation', 'No se pudo confirmar la consulta')}
            subtitle={t(
              effectiveVisitPersistenceCorrelation ? 'visitSaveOutcomeUnknown' : 'visitSaveOutcomeManualReview',
              effectiveVisitPersistenceCorrelation
                ? 'No repita la admisión. Pulse Reintentar para verificar la consulta antes de continuar.'
                : 'No vuelva a enviar el formulario. Ciérrelo y verifique las consultas activas del paciente antes de continuar.',
            )}
          />
        ) : null}
        {workspaceDescription ? (
          <InlineNotification
            hideCloseButton
            kind="info"
            lowContrast
            className={styles.workspaceDescription}
            title={t('startVisitInstructionsTitle', 'Revise los datos de la atención')}
            subtitle={workspaceDescription}
          />
        ) : null}
        <fieldset
          className={styles.persistedVisitFields}
          disabled={Boolean(persistedVisitPendingPostSubmit || visitCreationRequiresReconciliation)}
        >
          {showPatientHeader && patient && (
            <ExtensionSlot
              name="patient-header-slot"
              state={{
                patient,
                patientUuid: patientUuid,
                hideActionsOverflow: true,
              }}
            />
          )}
          {errorFetchingResources && (
            <InlineNotification
              kind={errorFetchingResources?.blockSavingForm ? 'error' : 'warning'}
              lowContrast
              className={styles.inlineNotification}
              title={t('partOfFormDidntLoad', 'Part of the form did not load')}
              subtitle={t('refreshToTryAgain', 'Please refresh to try again')}
            />
          )}
          <div>
            {isTablet && (
              <Row className={styles.headerGridRow}>
                <ExtensionSlot
                  name="visit-form-header-slot"
                  className={styles.dataGridRow}
                  state={visitHeaderSlotState}
                />
              </Row>
            )}
            <Stack gap={1} className={styles.container}>
              {!isQueueRegistration ? (
                <VisitDateTimeField
                  dateFieldName="visitStartDate"
                  maxDate={maxVisitStartDatetime}
                  minDate={patientBirthDate?.valueOf()}
                  timeFieldName="visitStartTime"
                  timeFormatFieldName="visitStartTimeFormat"
                  visitDatetimeLabel={t('visitStartDatetime', 'Visit start date and time')}
                />
              ) : null}

              {displayVisitStopDateTimeFields && (
                <VisitDateTimeField
                  dateFieldName="visitStopDate"
                  minDate={resolvedMinVisitStopDatetime}
                  timeFieldName="visitStopTime"
                  timeFormatFieldName="visitStopTimeFormat"
                  visitDatetimeLabel={t('visitStopDatetime', 'Visit stop date and time')}
                />
              )}

              {/* Upcoming appointments. This get shown when config.showUpcomingAppointments is true. */}
              {config.showUpcomingAppointments && (
                <section>
                  <div className={styles.sectionTitle} />
                  <div className={styles.sectionField}>
                    <VisitFormExtensionSlot
                      name="visit-form-top-slot"
                      patientUuid={patientUuid}
                      currentServiceQueueUuid={currentServiceQueueUuid}
                      currentQueueLocationUuid={currentQueueLocationUuid}
                      requestedServiceName={requestedServiceName}
                      requireActiveSisFinancing={requireActiveSisFinancing}
                      onQueueEntryAdded={onQueueEntryAdded}
                      visitFormOpenedFrom={openedFrom}
                      setVisitFormCallbacks={setVisitFormCallbacks}
                    />
                  </div>
                </section>
              )}

              {/* This field lets the user select a location for the visit. The location is required for the visit to be saved. Defaults to the active session location */}
              <LocationSelector control={control} lockedLocation={requiredVisitLocation} />

              {/* The selected person is persisted only on this consultation, never as a patient relationship. */}
              <CompanionList
                isLoading={isLoadingCompanion}
                onClearCompanion={handleClearCompanion}
                onRegisterPerson={
                  isWorkspace2 && canRegisterCompanion
                    ? () => launchCompanionWorkspace(companionPersonRegistrationWorkspaceName)
                    : undefined
                }
                onSearchPerson={
                  isWorkspace2 && canSearchCompanion
                    ? () => launchCompanionWorkspace(companionPersonSearchWorkspaceName)
                    : undefined
                }
                required={companionRequired}
                selectedCompanion={selectedCompanion}
              />

              {/* Lists available program types. This feature is dependent on the `showRecommendedVisitTypeTab` config being set
          to true. */}
              {config.showRecommendedVisitTypeTab && (
                <section>
                  <h1 className={styles.sectionTitle}>{t('program', 'Program')}</h1>
                  <FormGroup legendText={t('selectProgramType', 'Select program type')} className={styles.sectionField}>
                    <Controller
                      name="programType"
                      control={control}
                      render={({ field: { onChange } }) => (
                        <RadioButtonGroup
                          orientation="vertical"
                          onChange={(uuid: string) =>
                            onChange(activePatientEnrollment.find(({ program }) => program.uuid === uuid)?.uuid)
                          }
                          name="program-type-radio-group"
                        >
                          {activePatientEnrollment.map(({ uuid, display, program }) => (
                            <RadioButton
                              key={uuid}
                              className={styles.radioButton}
                              id={uuid}
                              labelText={display}
                              value={program.uuid}
                            />
                          ))}
                        </RadioButtonGroup>
                      )}
                    />
                  </FormGroup>
                </section>
              )}

              {/* Lists available visit types if no atFacilityVisitType enabled. The content switcher only gets shown when recommended visit types are enabled */}
              {requiredVisitTypeUuid ? (
                <section>
                  <h1 className={styles.sectionTitle}>{`${t('visitType_title', 'Tipo de consulta')} *`}</h1>
                  <div className={styles.sectionField}>
                    <p className={styles.bodyShort02}>
                      {availableVisitTypes.find((visitType) => visitType.uuid === requiredVisitTypeUuid)?.display ??
                        t('configuredAppointmentVisitType', 'Tipo asignado por el servicio de la cita')}
                    </p>
                  </div>
                </section>
              ) : !emrConfiguration?.atFacilityVisitType ? (
                <section>
                  <h1 className={styles.sectionTitle}>{`${t('visitType_title', 'Tipo de consulta')} *`}</h1>
                  <div className={styles.sectionField}>
                    {config.showRecommendedVisitTypeTab ? (
                      <>
                        <ContentSwitcher
                          selectedIndex={contentSwitcherIndex}
                          onChange={({ index }) => setContentSwitcherIndex(index)}
                        >
                          <Switch name="recommended" text={t('recommended', 'Recommended')} />
                          <Switch name="all" text={t('all', 'All')} />
                        </ContentSwitcher>
                        {contentSwitcherIndex === 0 && !isLoading && (
                          <MemoizedRecommendedVisitType
                            allowedVisitTypeUuids={allowedVisitTypeUuids}
                            patientUuid={patientUuid}
                            patientProgramEnrollment={(() => {
                              return activePatientEnrollment?.find(
                                ({ program }) => program.uuid === getValues('programType'),
                              );
                            })()}
                            locationUuid={getValues('visitLocation')?.uuid}
                          />
                        )}
                        {contentSwitcherIndex === 1 && <BaseVisitType visitTypes={availableVisitTypes} />}
                      </>
                    ) : (
                      // Defaults to showing all possible visit types if recommended visits are not enabled
                      <BaseVisitType visitTypes={availableVisitTypes} />
                    )}
                  </div>

                  {errors?.visitType && (
                    <section>
                      <div className={styles.sectionTitle} />
                      <div className={styles.sectionField}>
                        <InlineNotification
                          role="alert"
                          style={{ margin: '0', minWidth: '100%' }}
                          kind="error"
                          lowContrast={true}
                          title={t('missingVisitType', 'Missing visit type')}
                          subtitle={t('selectVisitType', 'Select a care type')}
                        />
                      </div>
                    </section>
                  )}
                </section>
              ) : null}

              {config.showExtraVisitAttributesSlot && (
                <MemoizedExtraVisitSlot patientUuid={patientUuid} setExtraVisitInfo={setExtraVisitInfo} />
              )}

              {/* Visit type attribute fields. These get shown when visit attribute types are configured */}
              <section>
                <h1 className={styles.sectionTitle}>{isTablet && t('visitAttributes', 'Visit attributes')}</h1>
                <div className={styles.sectionField}>
                  <VisitAttributeTypeFields
                    setErrorFetchingResources={setErrorFetchingResources}
                    visitAttributeTypes={configuredVisitAttributeTypes}
                  />
                </div>
              </section>
            </Stack>
          </div>
        </fieldset>
        {/* Preserve the queue selection used by the first persistence attempt once the visit exists. */}
        <fieldset className={styles.persistedVisitFields} disabled={Boolean(persistedVisitPendingPostSubmit)}>
          <Stack gap={1} className={styles.container}>
            <section className={styles.queueSection}>
              <div className={styles.sectionTitle} />
              <div className={styles.sectionField}>
                <VisitFormExtensionSlot
                  name="visit-form-bottom-slot"
                  patientUuid={patientUuid}
                  currentServiceQueueUuid={currentServiceQueueUuid}
                  currentQueueLocationUuid={currentQueueLocationUuid}
                  requestedServiceName={requestedServiceName}
                  requireActiveSisFinancing={requireActiveSisFinancing}
                  onQueueEntryAdded={onQueueEntryAdded}
                  visitFormOpenedFrom={openedFrom}
                  setVisitFormCallbacks={setVisitFormCallbacks}
                />
              </div>
            </section>
          </Stack>
        </fieldset>
        <ButtonSet
          className={classNames(styles.buttonSet, {
            [styles.tablet]: isTablet,
            [styles.desktop]: !isTablet,
          })}
        >
          <Button className={styles.button} kind="secondary" onClick={() => closeCurrentWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            disabled={
              isSubmitting ||
              errorFetchingResources?.blockSavingForm ||
              (visitCreationRequiresReconciliation && !effectiveVisitPersistenceCorrelation)
            }
            kind="primary"
            type="submit"
          >
            {isSubmitting ? (
              <InlineLoading
                className={styles.spinner}
                description={
                  persistedVisitPendingPostSubmit || visitCreationRequiresReconciliation
                    ? t('retryingVisitCompletion', 'Reintentando registro') + '...'
                    : visitToEdit
                      ? t('updatingVisit', 'Updating visit') + '...'
                      : isQueueRegistration
                        ? t('addingPatientToQueue', 'Adding patient to queue') + '...'
                        : t('startingVisit', 'Starting visit') + '...'
                }
              />
            ) : (
              <span>
                {persistedVisitPendingPostSubmit || visitCreationRequiresReconciliation
                  ? t('retryVisitCompletion', 'Reintentar registro')
                  : visitToEdit
                    ? t('updateVisit', 'Update visit')
                    : isQueueRegistration
                      ? t('addPatientToQueue', 'Add patient to queue')
                      : t('startVisit', 'Start visit')}
              </span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );

  if (isWorkspace2) {
    return (
      <Workspace2
        title={
          workspaceTitle ??
          (visitToEdit ? t('editVisitDetails', 'Edit visit details') : t('startVisitWorkspaceTitle', 'Start visit'))
        }
        hasUnsavedChanges={
          (isDirty && !isVisitSaved) || Boolean(persistedVisitPendingPostSubmit) || visitCreationRequiresReconciliation
        }
      >
        {content}
      </Workspace2>
    );
  }

  return content;
};

interface VisitFormExtensionSlotProps {
  name: string;
  patientUuid: string;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  requestedServiceName?: string;
  requireActiveSisFinancing?: boolean;
  onQueueEntryAdded?: () => void | Promise<void>;
  visitFormOpenedFrom: string;
  setVisitFormCallbacks: React.Dispatch<React.SetStateAction<Map<string, VisitFormCallbacks>>>;
}

type VisitFormExtensionState = {
  patientUuid: string;

  /**
   * This function allows an extension to register callbacks for visit form submission.
   * This callbacks can be used to make further requests. The callbacks should handle its own UI notification
   * on success / failure, and its returned Promise MUST resolve on success and MUST reject on failure.
   * @param callback
   * @returns
   */
  setVisitFormCallbacks(callbacks: VisitFormCallbacks);

  visitFormOpenedFrom: string;
  patientChartConfig: ChartConfig;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  requestedServiceName?: string;
  requireActiveSisFinancing?: boolean;
  onQueueEntryAdded?: () => void | Promise<void>;
};

const VisitFormExtensionSlot: React.FC<VisitFormExtensionSlotProps> = React.memo(
  ({
    name,
    patientUuid,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    requestedServiceName,
    requireActiveSisFinancing,
    onQueueEntryAdded,
    visitFormOpenedFrom,
    setVisitFormCallbacks,
  }) => {
    const config = useConfig<ChartConfig>();

    return (
      <ExtensionSlot name={name}>
        {(extension: AssignedExtension) => {
          const state: VisitFormExtensionState = {
            patientUuid,
            setVisitFormCallbacks: (callbacks) => {
              setVisitFormCallbacks((old) => {
                return new Map(old).set(extension.id, callbacks);
              });
            },
            visitFormOpenedFrom,
            patientChartConfig: config,
            currentServiceQueueUuid,
            currentQueueLocationUuid,
            requestedServiceName,
            requireActiveSisFinancing,
            onQueueEntryAdded,
          };
          return <Extension state={state} />;
        }}
      </ExtensionSlot>
    );
  },
);

/**
 * Error boundary + memoized wrapper for the extra-visit-attribute-slot.
 * The billing extension parcel can crash during single-spa lifecycle transitions
 * (UPDATING/UNMOUNTING) due to a framework-level race condition. Without this
 * boundary, the error propagates through React's commit phase and crashes the
 * entire visit form, preventing the workspace from closing after visit creation.
 */
class ExtraVisitSlotErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Swallow the parcel lifecycle error silently
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const MemoizedExtraVisitSlot = React.memo(
  ({
    patientUuid,
    setExtraVisitInfo,
  }: {
    patientUuid: string;
    setExtraVisitInfo: (state: ExtraVisitInfoState) => void;
  }) => (
    <ExtraVisitSlotErrorBoundary>
      <ExtensionSlot state={{ patientUuid, setExtraVisitInfo }} name="extra-visit-attribute-slot" />
    </ExtraVisitSlotErrorBoundary>
  ),
);

const StartVisitFormGuard: React.FC<StartVisitFormProps> = (props) => {
  const { user } = useSession();

  const visitToEdit = isWorkspace2Props(props) ? props.workspaceProps.visitToEdit : props.visitToEdit;
  const hasAccess = visitToEdit ? canEditVisit(user) : canStartVisit(user);

  if (!hasAccess) {
    return (
      <UnauthorizedState
        privilege={
          visitToEdit
            ? ['Edit Visits', 'app:home.admision', 'app:hoja.clinica.visitas.editar']
            : ['Add Visits', 'app:home.admision', 'app:hoja.clinica.visitas.editar']
        }
        description={
          visitToEdit
            ? 'Necesita el privilegio para editar visitas.'
            : 'Necesita el privilegio para crear visitas o permisos de admisión.'
        }
      />
    );
  }

  return <StartVisitForm {...props} />;
};

export default StartVisitFormGuard;
