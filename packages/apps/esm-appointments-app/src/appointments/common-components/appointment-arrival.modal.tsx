import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  formatDatetime,
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  launchWorkspace2,
  navigate,
  showSnackbar,
  useConfig,
  usePatient,
  userHasAccess,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import {
  fetchPersonInsurance,
  fetchFreshPatientVitalStatus,
  fetchVisitInsurance,
  getSisFinancingState,
  isTriageFinancingEligible,
  safeCopyFinanciadorToVisit,
} from '@openmrs/esm-patient-common-lib';
import { formatPersonName, getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import {
  appointmentsCompanionPersonRegistrationWorkspace,
  appointmentsCompanionPersonSearchWorkspace,
  clinicalChartPrivilege,
} from '../../constants';
import { useMutateAppointments } from '../../form/appointments-form.resource';
import { canTransition } from '../../helpers';
import {
  APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
  changeAppointmentStatus,
  ensureAppointmentVisitLink,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentStatus } from '../../types';
import styles from './appointment-arrival.scss';
import {
  canCreateAppointmentQueueEntry,
  canCreateAppointmentVisit,
  canInspectAppointmentVisits,
  canReuseAppointmentVisit,
} from './appointment-arrival-access';
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

const appointmentsStartVisitWorkspace = 'appointments-start-visit-workspace';
const addActiveVisitToQueueWorkspace = 'appointments-add-active-visit-to-queue-workspace';
const APPOINTMENT_STATUS_CONFLICT = 'APPOINTMENT_STATUS_CONFLICT';
const COMPANION_CAPABILITY_MISSING = 'COMPANION_CAPABILITY_MISSING';
const PATIENT_AGE_LOADING = 'PATIENT_AGE_LOADING';
const PATIENT_AGE_UNAVAILABLE = 'PATIENT_AGE_UNAVAILABLE';
const companionRegistrationPrivilege = 'app:opciones.registrarAcompanante';
const ACTIVE_VISIT_CHANGED = 'ACTIVE_VISIT_CHANGED';
const ACTIVE_VISIT_LOCATION_MISMATCH = 'ACTIVE_VISIT_LOCATION_MISMATCH';
const ACTIVE_VISIT_TYPE_MISMATCH = 'ACTIVE_VISIT_TYPE_MISMATCH';
const APPOINTMENT_LOCATION_MISSING = 'APPOINTMENT_LOCATION_MISSING';
const APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS = 'APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS';
const APPOINTMENT_ARRIVAL_RULE_INVALID = 'APPOINTMENT_ARRIVAL_RULE_INVALID';
const APPOINTMENT_ARRIVAL_RULE_MISSING = 'APPOINTMENT_ARRIVAL_RULE_MISSING';
const APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED = 'APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED';
const MULTIPLE_ACTIVE_VISITS = 'MULTIPLE_ACTIVE_VISITS';
const TRIAGE_FINANCING_UNDEFINED = 'TRIAGE_FINANCING_UNDEFINED';
const TRIAGE_SIS_FINANCING_REQUIRED = 'TRIAGE_SIS_FINANCING_REQUIRED';
const CLINICAL_CHART_CAPABILITY_MISSING = 'CLINICAL_CHART_CAPABILITY_MISSING';
const QUEUE_ENTRY_CAPABILITY_MISSING = 'QUEUE_ENTRY_CAPABILITY_MISSING';
const VISIT_CREATION_CAPABILITY_MISSING = 'VISIT_CREATION_CAPABILITY_MISSING';
const VISIT_INSPECTION_CAPABILITY_MISSING = 'VISIT_INSPECTION_CAPABILITY_MISSING';
const VISIT_REUSE_CAPABILITY_MISSING = 'VISIT_REUSE_CAPABILITY_MISSING';
const DECEASED_PATIENT_ARRIVAL_BLOCKED = 'DECEASED_PATIENT_ARRIVAL_BLOCKED';
const PATIENT_DEATH_STATUS_UNAVAILABLE = 'PATIENT_DEATH_STATUS_UNAVAILABLE';

type ArrivalAction = 'queue' | 'direct';
type VisitBranchPreflight =
  | { status: 'not-needed' | 'loading' }
  | { status: 'ready'; hasActiveVisit: boolean }
  | { status: 'error'; error: unknown };

interface AppointmentArrivalModalProps {
  appointment: Appointment;
  patientUuid: string;
  closeModal: () => void;
  mutateVisits?: () => void;
}

/**
 * Modal de registro de llegada de una cita. Las políticas con cola muestran
 * únicamente la acción «Enviar a cola de espera». La atención directa se
 * conserva para servicios configurados explícitamente con la política `direct`.
 */
const AppointmentArrivalModal: React.FC<AppointmentArrivalModalProps> = ({
  appointment,
  patientUuid,
  closeModal,
  mutateVisits,
}) => {
  const {
    appointmentArrivalRules,
    appointmentVisitAttributeTypeUuid,
    checkInButton,
    customPatientChartUrl,
    triageRouting,
  } = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const session = useSession();
  const { patient: fhirPatient, isLoading: isPatientLoading, error: patientError } = usePatient(patientUuid);
  const isDeceasedPatient = Boolean(fhirPatient?.deceasedBoolean || fhirPatient?.deceasedDateTime);
  const canOpenPatientChart = userHasAccess(clinicalChartPrivilege, session?.user);
  const { mutateAppointments } = useMutateAppointments();
  const [pendingAction, setPendingAction] = useState<ArrivalAction | null>(null);
  const [inlineError, setInlineError] = useState<unknown>(null);
  const isBusy = pendingAction !== null;

  useEffect(() => {
    if (
      !isPatientLoading &&
      inlineError &&
      typeof inlineError === 'object' &&
      'code' in inlineError &&
      inlineError.code === PATIENT_AGE_LOADING
    ) {
      setInlineError(null);
    }
  }, [inlineError, isPatientLoading]);

  const appointmentLocationUuid = appointment.location?.uuid;
  const exactArrivalRules = appointmentLocationUuid
    ? (appointmentArrivalRules ?? []).filter(
        (rule) =>
          rule.appointmentServiceUuid === appointment.service.uuid &&
          rule.appointmentLocationUuid === appointmentLocationUuid,
      )
    : [];
  const arrivalRule = exactArrivalRules.length === 1 ? exactArrivalRules[0] : undefined;
  const queueAllowedByRule =
    arrivalRule?.arrivalPolicy === 'queue-optional' || arrivalRule?.arrivalPolicy === 'queue-required';
  const directAllowedByRule =
    arrivalRule?.arrivalPolicy === 'queue-optional' || arrivalRule?.arrivalPolicy === 'direct';
  const showDirectAction = directAllowedByRule && !queueAllowedByRule;
  const canInspectVisits = canInspectAppointmentVisits(session?.user);
  const canCreateVisit = canCreateAppointmentVisit(session?.user);
  const canReuseVisit = canReuseAppointmentVisit(session?.user);
  const canCreateQueueEntry = canCreateAppointmentQueueEntry(session?.user);
  const canReviewPatientCoverage = userHasAccess('app:opciones.registrarPaciente', session?.user);
  const shouldResolveVisitBranch = Boolean(
    canInspectVisits &&
      ((showDirectAction && canOpenPatientChart && (!canCreateVisit || !canReuseVisit)) ||
        (queueAllowedByRule && canCreateQueueEntry && !canCreateVisit)),
  );
  const [visitBranchPreflight, setVisitBranchPreflight] = useState<VisitBranchPreflight>({ status: 'not-needed' });

  const getCheckInErrorMessageOptions = () =>
    ({
      codeMessages: {
        [APPOINTMENT_STATUS_CONFLICT]: t(
          'appointmentStatusChanged',
          'El estado de la cita cambió. Actualice la lista antes de continuar.',
        ),
        [COMPANION_CAPABILITY_MISSING]: t(
          'companionCapabilityMissing',
          'El paciente es menor de edad y requiere un acompañante, pero su usuario no tiene permisos para buscar ni registrar personas. Solicite el registro de la llegada a un usuario con alguno de esos accesos.',
        ),
        [PATIENT_AGE_LOADING]: t(
          'patientAgeLoading',
          'Espere mientras se verifica la edad del paciente antes de registrar la llegada.',
        ),
        [PATIENT_AGE_UNAVAILABLE]: t(
          'patientAgeUnavailable',
          'No se pudo verificar la edad del paciente. Vuelva a intentar y, si el problema continúa, revise que tenga una fecha de nacimiento válida.',
        ),
        [MULTIPLE_ACTIVE_VISITS]: t(
          'multipleActiveVisits',
          'El paciente tiene más de una consulta activa. Regularice las consultas antes de continuar.',
        ),
        [CLINICAL_CHART_CAPABILITY_MISSING]: t(
          'clinicalChartCapabilityMissing',
          'La atención directa requiere acceso a la historia clínica del paciente. Solicite ese acceso o use la cola, si está habilitada.',
        ),
        [QUEUE_ENTRY_CAPABILITY_MISSING]: t(
          'queueEntryCapabilityMissing',
          'Su usuario no puede registrar entradas en cola. Solicite permisos para consultar pacientes, consultas y colas, y para gestionar entradas de cola.',
        ),
        [VISIT_CREATION_CAPABILITY_MISSING]: t(
          'visitCreationCapabilityMissing',
          'Su usuario no puede crear la consulta requerida. Solicite a un administrador permisos para iniciar consultas.',
        ),
        [VISIT_INSPECTION_CAPABILITY_MISSING]: t(
          'visitInspectionCapabilityMissing',
          'Su usuario no puede verificar las consultas activas del paciente. Solicite permisos para consultar visitas antes de registrar la llegada.',
        ),
        [VISIT_REUSE_CAPABILITY_MISSING]: t(
          'visitReuseCapabilityMissing',
          'Existe una consulta activa, pero su usuario no puede vincularla con la cita. Solicite permisos para consultar y editar visitas y sus atributos.',
        ),
        [ACTIVE_VISIT_CHANGED]: t(
          'activeVisitChanged',
          'La consulta activa del paciente cambió. Cierre este formulario y vuelva a registrar la llegada.',
        ),
        [ACTIVE_VISIT_LOCATION_MISMATCH]: t(
          'activeVisitLocationMismatch',
          'La consulta activa pertenece a otra UPSS o servicio. Finalícela o regularícela antes de registrar la llegada.',
        ),
        [ACTIVE_VISIT_TYPE_MISMATCH]: t(
          'activeVisitTypeMismatch',
          'El tipo de la consulta activa no corresponde al servicio de la cita. Regularice la consulta antes de continuar.',
        ),
        [APPOINTMENT_LOCATION_MISSING]: t(
          'appointmentLocationMissing',
          'La cita no tiene una UPSS válida. Regularice la cita antes de iniciar la atención.',
        ),
        [APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS]: t(
          'appointmentArrivalRuleAmbiguous',
          'Existe más de una regla de llegada para este servicio y UPSS. Corrija la configuración antes de registrar la llegada.',
        ),
        [APPOINTMENT_ARRIVAL_RULE_MISSING]: t(
          'appointmentArrivalRuleMissing',
          'No existe una regla de llegada configurada para el servicio y la UPSS de esta cita. Contacte al administrador antes de continuar.',
        ),
        [APPOINTMENT_ARRIVAL_RULE_INVALID]: t(
          'appointmentArrivalRuleInvalid',
          'La regla de llegada de este servicio está incompleta. Corrija la configuración antes de registrar la llegada.',
        ),
        [APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED]: t(
          'appointmentArrivalActionNotAllowed',
          'La modalidad de llegada seleccionada no está habilitada para este servicio.',
        ),
        [APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING]: t(
          'appointmentVisitLinkNotConfigured',
          'No está configurado el vínculo entre cita y consulta. Contacte al administrador antes de continuar.',
        ),
        [TRIAGE_SIS_FINANCING_REQUIRED]: t(
          'triageSisFinancingRequired',
          'El paciente no tiene una acreditación SIS vigente. Revise el financiamiento en Admisión o derive al paciente a Caja para regularizar el pago o la cobertura antes del triaje.',
        ),
        [TRIAGE_FINANCING_UNDEFINED]: t(
          'triageFinancingUndefined',
          'El paciente no tiene un financiador definido. Admisión debe registrar su financiamiento antes de enviarlo a triaje.',
        ),
        [DECEASED_PATIENT_ARRIVAL_BLOCKED]: t(
          'deceasedPatientArrivalBlocked',
          'No se puede registrar la llegada de un paciente fallecido.',
        ),
        [PATIENT_DEATH_STATUS_UNAVAILABLE]: t(
          'patientVitalStatusCheckFailed',
          'No se pudo verificar el estado vital actual del paciente. Intente nuevamente.',
        ),
      },
      logContext: 'Check in appointment',
    }) as const;

  const getRoutingConfigurationError = () => {
    if (!appointmentLocationUuid) {
      return Object.assign(new Error('The appointment does not have a location.'), {
        code: APPOINTMENT_LOCATION_MISSING,
      });
    }
    if (exactArrivalRules.length > 1) {
      return Object.assign(new Error('Multiple arrival rules match this appointment.'), {
        code: APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS,
      });
    }
    if (!arrivalRule) {
      return Object.assign(new Error('No arrival rule matches this appointment service and location.'), {
        code: APPOINTMENT_ARRIVAL_RULE_MISSING,
      });
    }

    const isQueuePolicy =
      arrivalRule.arrivalPolicy === 'queue-optional' || arrivalRule.arrivalPolicy === 'queue-required';
    const hasCompleteQueue = Boolean(arrivalRule.queueUuid && arrivalRule.queueLocationUuid);
    const hasCompleteTriageRoute = Boolean(
      triageRouting?.enabled &&
        triageRouting.queueUuid &&
        triageRouting.queueLocationUuid &&
        triageRouting.encounterTypeUuid,
    );
    if ((isQueuePolicy && !hasCompleteQueue) || (arrivalRule.arrivalPolicy === 'direct' && hasCompleteQueue)) {
      return Object.assign(new Error('The arrival rule has inconsistent queue fields.'), {
        code: APPOINTMENT_ARRIVAL_RULE_INVALID,
      });
    }
    if (arrivalRule.requiresTriage && (!isQueuePolicy || !hasCompleteTriageRoute)) {
      return Object.assign(new Error('The triage route is incomplete.'), {
        code: APPOINTMENT_ARRIVAL_RULE_INVALID,
      });
    }
    return null;
  };

  const assertArrivalActionIsConfigured = (action: ArrivalAction) => {
    const configurationError = getRoutingConfigurationError();
    if (configurationError) {
      throw configurationError;
    }
    if (!arrivalRule) {
      throw Object.assign(new Error('No arrival rule matches this appointment service and location.'), {
        code: APPOINTMENT_ARRIVAL_RULE_MISSING,
      });
    }
    if ((action === 'queue' && !queueAllowedByRule) || (action === 'direct' && !directAllowedByRule)) {
      throw Object.assign(new Error('The selected arrival action is not allowed by the routing rule.'), {
        code: APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED,
      });
    }
    return arrivalRule;
  };

  // Errores que ocurren cuando el modal ya se cerró (callbacks de los
  // workspaces) siguen llegando al usuario como snackbar, igual que antes.
  const showCheckInFailureSnackbar = (error: unknown) =>
    showSnackbar({
      title: t('checkInFailed', 'No se pudo registrar la llegada'),
      subtitle: getCompatibleUserFacingErrorMessage(
        error,
        t('appointmentCheckInFailed', 'No se pudo registrar la llegada del paciente. Intente nuevamente.'),
        getCheckInErrorMessageOptions(),
        frameworkGetUserFacingErrorMessage,
      ),
      kind: 'error',
      isLowContrast: false,
    });

  const getCurrentCheckInStatus = async () => {
    const currentStatus = await getAppointmentStatus(appointment.uuid);
    if (
      currentStatus !== AppointmentStatus.CHECKEDIN &&
      !canTransition(currentStatus as AppointmentStatus, AppointmentStatus.CHECKEDIN)
    ) {
      throw Object.assign(new Error('Appointment status changed before check-in.'), {
        code: APPOINTMENT_STATUS_CONFLICT,
      });
    }
    return currentStatus;
  };

  const fetchActiveVisits = async () => {
    const response = await getActiveVisitsForPatient(
      patientUuid,
      undefined,
      'custom:(uuid,patient:(uuid),visitType:(uuid,display),location:(uuid,display),startDatetime,stopDatetime,attributes)',
    );
    const activeVisits = response.data?.results ?? [];
    if (activeVisits.length > 1) {
      throw Object.assign(new Error('The patient has multiple active visits.'), {
        code: MULTIPLE_ACTIVE_VISITS,
      });
    }
    return activeVisits;
  };

  // Only resolve the branch eagerly when permissions differ between creating
  // and reusing a visit. Users capable of both paths avoid an extra read, while
  // restricted users see a disabled action and its reason before opening a
  // protected child workspace.
  useEffect(() => {
    let isCurrent = true;

    if (!shouldResolveVisitBranch) {
      setVisitBranchPreflight((current) => (current.status === 'not-needed' ? current : { status: 'not-needed' }));
      return () => {
        isCurrent = false;
      };
    }

    setVisitBranchPreflight({ status: 'loading' });
    void getActiveVisitsForPatient(
      patientUuid,
      undefined,
      'custom:(uuid,patient:(uuid),visitType:(uuid,display),location:(uuid,display),startDatetime,stopDatetime,attributes)',
    )
      .then((response) => {
        if (!isCurrent) {
          return;
        }
        const activeVisits = response.data?.results ?? [];
        if (activeVisits.length > 1) {
          throw Object.assign(new Error('The patient has multiple active visits.'), {
            code: MULTIPLE_ACTIVE_VISITS,
          });
        }
        setVisitBranchPreflight({
          status: 'ready',
          hasActiveVisit: Boolean(activeVisits[0]),
        });
      })
      .catch((error) => {
        if (isCurrent) {
          setVisitBranchPreflight({ status: 'error', error });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [patientUuid, shouldResolveVisitBranch]);

  const assertPatientIsAlive = async () => {
    let vitalStatus: Awaited<ReturnType<typeof fetchFreshPatientVitalStatus>>;
    try {
      vitalStatus = await fetchFreshPatientVitalStatus(patientUuid);
    } catch (error) {
      throw Object.assign(error instanceof Error ? error : new Error('The patient could not be loaded.'), {
        code: PATIENT_DEATH_STATUS_UNAVAILABLE,
      });
    }
    if (vitalStatus.isDeceased) {
      throw Object.assign(new Error('Arrival cannot be registered for a deceased patient.'), {
        code: DECEASED_PATIENT_ARRIVAL_BLOCKED,
      });
    }
  };

  const validateAppointmentStatus = async (allowAlreadyCheckedIn = false) => {
    await assertPatientIsAlive();
    const currentStatus = await getCurrentCheckInStatus();
    if (currentStatus === AppointmentStatus.CHECKEDIN) {
      mutateAppointments?.();
      return allowAlreadyCheckedIn;
    }
    return true;
  };

  const assertVisitMatchesAppointmentLocation = (visit: Visit) => {
    if (!appointmentLocationUuid) {
      throw Object.assign(new Error('The appointment does not have a location.'), {
        code: APPOINTMENT_LOCATION_MISSING,
      });
    }
    if (visit.location?.uuid !== appointmentLocationUuid) {
      throw Object.assign(new Error('The active visit location does not match the appointment location.'), {
        code: ACTIVE_VISIT_LOCATION_MISMATCH,
      });
    }
  };

  const assertVisitTypeIsCompatible = (visit: Visit) => {
    if (!arrivalRule) {
      throw Object.assign(new Error('No approved arrival rule exists for the appointment service.'), {
        code: APPOINTMENT_ARRIVAL_RULE_MISSING,
      });
    }
    if (!visit.visitType?.uuid || visit.visitType.uuid !== arrivalRule.requiredVisitTypeUuid) {
      throw Object.assign(new Error('The active visit type is not compatible with the appointment service.'), {
        code: ACTIVE_VISIT_TYPE_MISMATCH,
      });
    }
  };

  const assertVisitLinkIsConfigured = () => {
    if (!appointmentVisitAttributeTypeUuid) {
      throw Object.assign(new Error('The appointment visit attribute type is not configured.'), {
        code: APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
      });
    }
  };

  const assertPatientHasEligibleFinancingForTriage = async () => {
    if (!arrivalRule?.requiresTriage) {
      return;
    }

    const patientInsurance = await fetchPersonInsurance(patientUuid);
    if (!patientInsurance.insuranceTypeUuid) {
      throw Object.assign(new Error('The patient does not have a financing type assigned.'), {
        code: TRIAGE_FINANCING_UNDEFINED,
      });
    }
    if (
      !isTriageFinancingEligible(
        getSisFinancingState({
          financiadorUuid: patientInsurance.insuranceTypeUuid,
          insuranceNumber: patientInsurance.insuranceCode,
          accreditationStatusUuid: patientInsurance.accreditationStatusUuid,
          accreditationCheckedAt: patientInsurance.accreditationCheckedAt,
        }),
      )
    ) {
      throw Object.assign(new Error('The patient does not have active SIS financing.'), {
        code: TRIAGE_SIS_FINANCING_REQUIRED,
      });
    }
  };

  const openPatientCoverageReview = () => {
    const returnUrl = `${globalThis.location.pathname}${globalThis.location.search}`;
    closeModal();
    navigate({
      to: `${globalThis.spaBase}/patient/${patientUuid}/edit?focusSection=insurance&afterUrl=${encodeURIComponent(returnUrl)}`,
    });
  };

  const getAppointmentLocationUuid = () => {
    if (!appointmentLocationUuid) {
      throw Object.assign(new Error('The appointment does not have a location.'), {
        code: APPOINTMENT_LOCATION_MISSING,
      });
    }
    return appointmentLocationUuid;
  };

  const validateBeforePersistence = async (expectedVisit?: Visit) => {
    try {
      assertVisitLinkIsConfigured();
      if (!(await validateAppointmentStatus(Boolean(expectedVisit)))) {
        return false;
      }

      const [activeVisit] = await fetchActiveVisits();
      if (expectedVisit ? activeVisit?.uuid !== expectedVisit.uuid : Boolean(activeVisit)) {
        throw Object.assign(new Error('The active visit changed before queue persistence.'), {
          code: ACTIVE_VISIT_CHANGED,
        });
      }
      if (expectedVisit && activeVisit) {
        assertVisitMatchesAppointmentLocation(activeVisit);
        assertVisitTypeIsCompatible(activeVisit);
        if (arrivalRule?.requiresTriage) {
          // Older active visits may not yet contain the financing attributes
          // copied from registration. Fill only missing values before deciding.
          await safeCopyFinanciadorToVisit({
            patientUuid: appointment.patient.uuid,
            visitUuid: activeVisit.uuid,
            onlyFillMissing: true,
          });
          const visitInsurance = await fetchVisitInsurance(activeVisit.uuid);
          if (!visitInsurance.financiadorUuid) {
            throw Object.assign(new Error('The visit does not have a financing type assigned.'), {
              code: TRIAGE_SIS_FINANCING_REQUIRED,
            });
          }
          if (!isTriageFinancingEligible(getSisFinancingState(visitInsurance))) {
            throw Object.assign(new Error('The visit does not have active SIS financing.'), {
              code: TRIAGE_SIS_FINANCING_REQUIRED,
            });
          }
        }
        await ensureAppointmentVisitLink(activeVisit.uuid, appointment.uuid, appointmentVisitAttributeTypeUuid);
      }
      return true;
    } catch (error) {
      showCheckInFailureSnackbar(error);
      return false;
    }
  };

  const checkIn = async (subtitle: string) => {
    await assertPatientIsAlive();
    const currentStatus = await getCurrentCheckInStatus();
    if (currentStatus === AppointmentStatus.CHECKEDIN) {
      mutateAppointments?.();
      return;
    }

    await assertPatientIsAlive();
    await changeAppointmentStatus(AppointmentStatus.CHECKEDIN, appointment.uuid);
    showSnackbar({
      title: t('checkedIn', 'Llegada registrada'),
      subtitle,
      kind: 'success',
      isLowContrast: true,
    });
    mutateAppointments?.();
  };

  const checkInFromWorkspaceCallback = async (subtitle: string) => {
    try {
      await checkIn(subtitle);
    } catch (error) {
      showCheckInFailureSnackbar(error);
      throw error;
    }
  };

  const canSearchCompanionPerson = userHasAccess('Get People', session?.user);
  const canRegisterCompanionPerson =
    userHasAccess(companionRegistrationPrivilege, session?.user) && userHasAccess('Add People', session?.user);

  const assertCanInspectActiveVisits = () => {
    if (!canInspectVisits) {
      throw Object.assign(new Error('The operator cannot inspect active visits.'), {
        code: VISIT_INSPECTION_CAPABILITY_MISSING,
      });
    }
  };

  const assertCanCreateVisit = () => {
    if (!canCreateVisit) {
      throw Object.assign(new Error('The operator cannot create visits.'), {
        code: VISIT_CREATION_CAPABILITY_MISSING,
      });
    }
  };

  const assertCanReuseVisit = () => {
    if (!canReuseVisit) {
      throw Object.assign(new Error('The operator cannot edit the active visit or its attributes.'), {
        code: VISIT_REUSE_CAPABILITY_MISSING,
      });
    }
  };

  const assertCanCreateQueueEntry = () => {
    if (!canCreateQueueEntry) {
      throw Object.assign(new Error('The operator cannot create queue entries.'), {
        code: QUEUE_ENTRY_CAPABILITY_MISSING,
      });
    }
  };

  // Both start-visit paths demand an adult companion for minors; without the
  // search or registration capability the operator cannot satisfy that inside
  // the form, so the block is explained here instead of after opening it. This
  // runs only when no reusable active visit exists and fails closed until the
  // patient's age can be determined reliably.
  const assertCompanionCapabilityForMinor = () => {
    if (isPatientLoading) {
      throw Object.assign(new Error('The patient age is still loading.'), {
        code: PATIENT_AGE_LOADING,
      });
    }

    const birthDateValue = fhirPatient?.birthDate;
    const normalizedBirthDate = birthDateValue?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    const birthDate = normalizedBirthDate ? dayjs(normalizedBirthDate).startOf('day') : null;
    const today = dayjs().startOf('day');
    const hasValidBirthDate =
      Boolean(birthDate) &&
      birthDate?.isValid() &&
      birthDate.format('YYYY-MM-DD') === normalizedBirthDate &&
      !birthDate.isAfter(today);

    if (patientError || !hasValidBirthDate) {
      throw Object.assign(new Error('The patient age could not be determined.'), {
        code: PATIENT_AGE_UNAVAILABLE,
      });
    }

    const isMinor = today.diff(birthDate, 'year') < 18;
    if (isMinor && !canSearchCompanionPerson && !canRegisterCompanionPerson) {
      throw Object.assign(new Error('The operator cannot search for or register a companion person.'), {
        code: COMPANION_CAPABILITY_MISSING,
      });
    }
  };

  const navigateToPatientChart = () => {
    if (!canOpenPatientChart) {
      return;
    }
    navigate({ to: customPatientChartUrl, templateParams: { patientUuid } });
  };

  const handleSendToQueue = async () => {
    setPendingAction('queue');
    setInlineError(null);
    try {
      const rule = assertArrivalActionIsConfigured('queue');
      assertVisitLinkIsConfigured();
      await assertPatientHasEligibleFinancingForTriage();
      const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
      if (!(await validateAppointmentStatus())) {
        closeModal();
        return;
      }
      if (!rule.queueUuid || !rule.queueLocationUuid) {
        throw Object.assign(new Error('The queue arrival rule is incomplete.'), {
          code: APPOINTMENT_ARRIVAL_RULE_INVALID,
        });
      }
      const arrivalQueueUuid = rule.requiresTriage ? triageRouting.queueUuid : rule.queueUuid;
      const requiredQueueLocationUuid = rule.requiresTriage ? triageRouting.queueLocationUuid : rule.queueLocationUuid;

      assertCanInspectActiveVisits();
      const activeVisits = await fetchActiveVisits();
      assertCanCreateQueueEntry();

      if (activeVisits[0]) {
        assertCanReuseVisit();
        assertVisitMatchesAppointmentLocation(activeVisits[0]);
        assertVisitTypeIsCompatible(activeVisits[0]);
        if (!checkInButton.showIfActiveVisit) {
          mutateVisits?.();
          closeModal();
          return;
        }
        const workspaceOpened = await launchWorkspace2(addActiveVisitToQueueWorkspace, {
          activeVisit: activeVisits[0],
          currentQueueLocationUuid: requiredQueueLocationUuid,
          currentServiceQueueUuid: arrivalQueueUuid,
          requestedUpssName: appointment.location?.name,
          requestedServiceName: appointment.service.name,
          requiredVisitLocation: {
            uuid: requiredAppointmentLocationUuid,
            display: appointment.location?.name ?? '',
          },
          requiredVisitTypeUuid: rule.requiredVisitTypeUuid,
          selectedPatientUuid: patientUuid,
          startVisitWorkspaceName: appointmentsStartVisitWorkspace,
          visitFormOpenedFrom: 'appointments-check-in',
          onBeforeQueueEntrySave: (visit: Visit) => validateBeforePersistence(visit),
          onQueueEntryAdded: () =>
            checkInFromWorkspaceCallback(
              t(
                rule.requiresTriage
                  ? 'appointmentCheckedInToTriageWithExistingVisit'
                  : 'appointmentCheckedInWithExistingVisit',
                rule.requiresTriage
                  ? 'Se registró la llegada usando la consulta activa y el paciente fue agregado a la cola de triaje.'
                  : 'Se registró la llegada usando la consulta activa y el paciente fue agregado a la cola.',
              ),
            ),
        });
        if (workspaceOpened) {
          closeModal();
        }
        return;
      }

      assertCanCreateVisit();
      assertCompanionCapabilityForMinor();
      const workspaceOpened = await launchWorkspace2(appointmentsStartVisitWorkspace, {
        patientUuid: patientUuid,
        companionPersonRegistrationWorkspaceName: appointmentsCompanionPersonRegistrationWorkspace,
        companionPersonSearchWorkspaceName: appointmentsCompanionPersonSearchWorkspace,
        additionalVisitAttributes: [
          {
            attributeType: appointmentVisitAttributeTypeUuid,
            value: appointment.uuid,
          },
        ],
        visitPersistenceCorrelation: {
          attributeType: appointmentVisitAttributeTypeUuid,
          value: appointment.uuid,
        },
        currentQueueLocationUuid: requiredQueueLocationUuid,
        currentServiceQueueUuid: arrivalQueueUuid,
        requestedUpssName: appointment.location?.name,
        requestedServiceName: appointment.service.name,
        requireActiveSisFinancing: rule.requiresTriage,
        requiredVisitLocation: {
          uuid: requiredAppointmentLocationUuid,
          display: appointment.location?.name ?? '',
        },
        requiredVisitTypeUuid: rule.requiredVisitTypeUuid,
        showPatientHeader: true,
        openedFrom: 'appointments-check-in',
        workspaceTitle: rule.requiresTriage
          ? t('startAppointmentTriageTitle', 'Registrar llegada y enviar a triaje')
          : t('startAppointmentCareTitle', 'Iniciar atención de la cita'),
        workspaceDescription: t(
          rule.requiresTriage ? 'startAppointmentTriageDescription' : 'startAppointmentCareWithQueueDescription',
          rule.requiresTriage
            ? 'Revise los datos de la atención. Al confirmar, se registrará la llegada y el paciente pasará primero a la cola de triaje.'
            : 'Revise los datos de la atención. Al confirmar, se registrará la llegada y el paciente será agregado a la cola seleccionada.',
        ),
        onBeforeVisitSave: (visit?: Visit) => validateBeforePersistence(visit),
        onVisitStarted: async () => {
          mutateVisits?.();
          await checkInFromWorkspaceCallback(
            t(
              rule.requiresTriage
                ? 'appointmentCheckedInAfterTriageVisitStarted'
                : 'appointmentCheckedInAfterVisitStarted',
              rule.requiresTriage
                ? 'La llegada fue registrada y el paciente fue agregado a la cola de triaje.'
                : 'La consulta fue iniciada, el paciente fue agregado a la cola y se registró la llegada a la cita.',
            ),
          );
        },
      });
      if (workspaceOpened) {
        closeModal();
      }
    } catch (error) {
      setInlineError(error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartDirectly = async () => {
    setPendingAction('direct');
    setInlineError(null);
    try {
      const rule = assertArrivalActionIsConfigured('direct');
      if (!canOpenPatientChart) {
        throw Object.assign(new Error('The operator cannot open the patient chart.'), {
          code: CLINICAL_CHART_CAPABILITY_MISSING,
        });
      }
      assertVisitLinkIsConfigured();
      const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
      if (!(await validateAppointmentStatus())) {
        closeModal();
        return;
      }

      assertCanInspectActiveVisits();
      const activeVisits = await fetchActiveVisits();

      if (activeVisits[0]) {
        assertCanReuseVisit();
        assertVisitMatchesAppointmentLocation(activeVisits[0]);
        assertVisitTypeIsCompatible(activeVisits[0]);
        await ensureAppointmentVisitLink(activeVisits[0].uuid, appointment.uuid, appointmentVisitAttributeTypeUuid);
        await checkIn(
          canOpenPatientChart
            ? t(
                'appointmentCheckedInDirectly',
                'Se registró la llegada usando la consulta activa. Puede continuar la atención en la historia del paciente.',
              )
            : t(
                'appointmentCheckedInDirectlyStay',
                'Se registró la llegada usando la consulta activa. La atención continuará desde la historia clínica.',
              ),
        );
        mutateVisits?.();
        closeModal();
        navigateToPatientChart();
        return;
      }

      // Sin parámetros de cola y con un `openedFrom` distinto de
      // 'appointments-check-in', el formulario de inicio de consulta no exige
      // ni crea queue entries (misma vía que 'patient-chart-start-visit').
      assertCanCreateVisit();
      assertCompanionCapabilityForMinor();
      const workspaceOpened = await launchWorkspace2(appointmentsStartVisitWorkspace, {
        patientUuid: patientUuid,
        companionPersonRegistrationWorkspaceName: appointmentsCompanionPersonRegistrationWorkspace,
        companionPersonSearchWorkspaceName: appointmentsCompanionPersonSearchWorkspace,
        additionalVisitAttributes: [
          {
            attributeType: appointmentVisitAttributeTypeUuid,
            value: appointment.uuid,
          },
        ],
        visitPersistenceCorrelation: {
          attributeType: appointmentVisitAttributeTypeUuid,
          value: appointment.uuid,
        },
        requiredVisitLocation: {
          uuid: requiredAppointmentLocationUuid,
          display: appointment.location?.name ?? '',
        },
        requiredVisitTypeUuid: rule.requiredVisitTypeUuid,
        showPatientHeader: true,
        openedFrom: 'appointments-direct-start',
        workspaceTitle: t('startAppointmentCareTitle', 'Iniciar atención de la cita'),
        workspaceDescription: t(
          'startAppointmentCareDirectDescription',
          'Revise los datos de la atención. Al confirmar, se iniciará la consulta y se registrará la llegada sin enviar al paciente a una cola.',
        ),
        onBeforeVisitSave: (visit?: Visit) => validateBeforePersistence(visit),
        onVisitStarted: async () => {
          mutateVisits?.();
          await checkInFromWorkspaceCallback(
            t(
              'appointmentCheckedInAfterDirectVisitStarted',
              'La consulta fue iniciada y se registró la llegada sin pasar por la cola.',
            ),
          );
          navigateToPatientChart();
        },
      });
      if (workspaceOpened) {
        closeModal();
      }
    } catch (error) {
      setInlineError(error);
    } finally {
      setPendingAction(null);
    }
  };

  const routingConfigurationError = getRoutingConfigurationError();
  const deceasedPatientError = isDeceasedPatient
    ? Object.assign(new Error('Arrival cannot be registered for a deceased patient.'), {
        code: DECEASED_PATIENT_ARRIVAL_BLOCKED,
      })
    : null;
  const displayedError = inlineError ?? deceasedPatientError ?? routingConfigurationError;
  const displayedErrorCode =
    displayedError && typeof displayedError === 'object' && 'code' in displayedError
      ? displayedError.code
      : undefined;
  const coverageNeedsReview =
    displayedErrorCode === TRIAGE_FINANCING_UNDEFINED || displayedErrorCode === TRIAGE_SIS_FINANCING_REQUIRED;
  const isVisitBranchLoading =
    shouldResolveVisitBranch &&
    (visitBranchPreflight.status === 'not-needed' || visitBranchPreflight.status === 'loading');
  const visitBranchError =
    shouldResolveVisitBranch && visitBranchPreflight.status === 'error' ? visitBranchPreflight.error : null;
  const directAccessError = showDirectAction
    ? !canOpenPatientChart
      ? Object.assign(new Error('The operator cannot open the patient chart.'), {
          code: CLINICAL_CHART_CAPABILITY_MISSING,
        })
      : !canInspectVisits
        ? Object.assign(new Error('The operator cannot inspect active visits.'), {
            code: VISIT_INSPECTION_CAPABILITY_MISSING,
          })
        : visitBranchError
          ? visitBranchError
          : visitBranchPreflight.status === 'ready' && visitBranchPreflight.hasActiveVisit && !canReuseVisit
            ? Object.assign(new Error('The operator cannot edit the active visit or its attributes.'), {
                code: VISIT_REUSE_CAPABILITY_MISSING,
              })
            : visitBranchPreflight.status === 'ready' && !visitBranchPreflight.hasActiveVisit && !canCreateVisit
              ? Object.assign(new Error('The operator cannot create visits.'), {
                  code: VISIT_CREATION_CAPABILITY_MISSING,
                })
              : null
    : null;
  const queueAccessError = queueAllowedByRule
    ? !canCreateQueueEntry
      ? Object.assign(new Error('The operator cannot create queue entries.'), {
          code: QUEUE_ENTRY_CAPABILITY_MISSING,
        })
      : visitBranchError
        ? visitBranchError
        : visitBranchPreflight.status === 'ready' && !visitBranchPreflight.hasActiveVisit && !canCreateVisit
          ? Object.assign(new Error('The operator cannot create visits.'), {
              code: VISIT_CREATION_CAPABILITY_MISSING,
            })
          : null
    : null;

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('arrivalModalTitle', 'Registrar llegada')} />
      <ModalBody>
        <div className={styles.appointmentSummary}>
          <p className={styles.patientName}>{formatPersonName(appointment.patient.name)}</p>
          <p className={styles.appointmentDetails}>
            {appointment.service?.name}
            {' · '}
            {t('appointmentUpissSummary', 'UPSS: {{location}}', {
              location: appointment.location?.name ?? t('appointmentLocationUnavailable', 'UPSS no disponible'),
            })}
            {' · '}
            {formatDatetime(new Date(appointment.startDateTime))}
          </p>
        </div>
        <p>{t('arrivalModalDescription', 'Seleccione cómo desea registrar la llegada del paciente.')}</p>
        {isPatientLoading ? (
          <InlineLoading description={t('verifyingPatientAge', 'Verificando la edad del paciente...')} />
        ) : null}
        {isVisitBranchLoading ? <InlineLoading description={t('verifyingVisit', 'Verificando consulta…')} /> : null}
        {displayedError ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            role="alert"
            title={t('checkInFailed', 'No se pudo registrar la llegada')}
            subtitle={getCompatibleUserFacingErrorMessage(
              displayedError,
              t('appointmentCheckInFailed', 'No se pudo registrar la llegada del paciente. Intente nuevamente.'),
              getCheckInErrorMessageOptions(),
              frameworkGetUserFacingErrorMessage,
            )}
          />
        ) : null}
        {!displayedError && directAccessError ? (
          <InlineNotification
            hideCloseButton
            kind={queueAllowedByRule && !queueAccessError ? 'warning' : 'error'}
            lowContrast
            role="alert"
            title={t('directCareUnavailable', 'Atención directa no disponible')}
            subtitle={getCompatibleUserFacingErrorMessage(
              directAccessError,
              t('appointmentCheckInFailed', 'No se pudo registrar la llegada del paciente. Intente nuevamente.'),
              getCheckInErrorMessageOptions(),
              frameworkGetUserFacingErrorMessage,
            )}
          />
        ) : null}
        {!displayedError && queueAccessError ? (
          <InlineNotification
            hideCloseButton
            kind={showDirectAction && !directAccessError ? 'warning' : 'error'}
            lowContrast
            role="alert"
            title={t('queueArrivalUnavailable', 'Ingreso a cola no disponible')}
            subtitle={getCompatibleUserFacingErrorMessage(
              queueAccessError,
              t('appointmentCheckInFailed', 'No se pudo registrar la llegada del paciente. Intente nuevamente.'),
              getCheckInErrorMessageOptions(),
              frameworkGetUserFacingErrorMessage,
            )}
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button disabled={isBusy} kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        {coverageNeedsReview && canReviewPatientCoverage ? (
          <Button disabled={isBusy} kind="tertiary" onClick={openPatientCoverageReview}>
            {t('reviewPatientFinancing', 'Revisar financiamiento')}
          </Button>
        ) : null}
        {showDirectAction && !routingConfigurationError ? (
          <Button
            disabled={
              isBusy || isPatientLoading || isVisitBranchLoading || isDeceasedPatient || Boolean(directAccessError)
            }
            kind={queueAllowedByRule ? 'tertiary' : 'primary'}
            onClick={handleStartDirectly}
          >
            {pendingAction === 'direct' ? (
              <InlineLoading description={t('startingDirectCare', 'Iniciando atención') + '...'} />
            ) : (
              t('startCareDirectly', 'Iniciar atención directamente')
            )}
          </Button>
        ) : null}
        {queueAllowedByRule && !routingConfigurationError ? (
          <Button
            disabled={
              isBusy || isPatientLoading || isVisitBranchLoading || isDeceasedPatient || Boolean(queueAccessError)
            }
            kind="primary"
            onClick={handleSendToQueue}
          >
            {pendingAction === 'queue' ? (
              <InlineLoading description={t('sendingToQueue', 'Enviando a cola de espera') + '...'} />
            ) : (
              t('sendToWaitingQueue', 'Enviar a cola de espera')
            )}
          </Button>
        ) : null}
      </ModalFooter>
    </>
  );
};

export default AppointmentArrivalModal;
