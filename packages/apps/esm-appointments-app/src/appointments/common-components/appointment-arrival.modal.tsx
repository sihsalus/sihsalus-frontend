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
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import {
  fetchVisitInsurance,
  getSisFinancingState,
  safeCopyFinanciadorToVisit,
} from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import {
  appointmentsCompanionPersonRegistrationWorkspace,
  appointmentsCompanionPersonSearchWorkspace,
  appointmentsPrivilege,
  appointmentsEditPrivilege,
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
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

const appointmentsStartVisitWorkspace = 'appointments-start-visit-workspace';
const addActiveVisitToQueueWorkspace = 'appointments-add-active-visit-to-queue-workspace';
const APPOINTMENT_STATUS_CONFLICT = 'APPOINTMENT_STATUS_CONFLICT';
const COMPANION_CAPABILITY_MISSING = 'COMPANION_CAPABILITY_MISSING';
const ACTIVE_VISIT_CHANGED = 'ACTIVE_VISIT_CHANGED';
const ACTIVE_VISIT_LOCATION_MISMATCH = 'ACTIVE_VISIT_LOCATION_MISMATCH';
const ACTIVE_VISIT_TYPE_MISMATCH = 'ACTIVE_VISIT_TYPE_MISMATCH';
const APPOINTMENT_LOCATION_MISSING = 'APPOINTMENT_LOCATION_MISSING';
const APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS = 'APPOINTMENT_ARRIVAL_RULE_AMBIGUOUS';
const APPOINTMENT_ARRIVAL_RULE_INVALID = 'APPOINTMENT_ARRIVAL_RULE_INVALID';
const APPOINTMENT_ARRIVAL_RULE_MISSING = 'APPOINTMENT_ARRIVAL_RULE_MISSING';
const APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED = 'APPOINTMENT_ARRIVAL_ACTION_NOT_ALLOWED';
const MULTIPLE_ACTIVE_VISITS = 'MULTIPLE_ACTIVE_VISITS';
const TRIAGE_SIS_FINANCING_REQUIRED = 'TRIAGE_SIS_FINANCING_REQUIRED';

type ArrivalAction = 'queue' | 'direct';

interface AppointmentArrivalModalProps {
  appointment: Appointment;
  patientUuid: string;
  closeModal: () => void;
  mutateVisits?: () => void;
}

/**
 * Modal de registro de llegada de una cita. Ofrece dos rutas:
 *
 * 1. «Enviar a cola de espera»: el flujo de admisión existente (consulta + queue
 *    entry vía workspaces). Los errores de validación previos al lanzamiento
 *    del workspace se muestran inline dentro del modal sin cerrarlo. La política
 *    configurada determina si esta ruta es obligatoria, opcional o no aplica.
 * 2. «Iniciar atención directamente»: marca la cita como admitida y asegura
 *    una consulta activa (reutiliza la activa o abre el formulario de inicio de
 *    consulta sin parámetros de cola) sin crear queue entry, y navega a la
 *    historia del paciente.
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
  const { patient: fhirPatient } = usePatient(patientUuid);
  const canOpenPatientChart = userHasAccess(clinicalChartPrivilege, session?.user);
  const { mutateAppointments } = useMutateAppointments();
  const [pendingAction, setPendingAction] = useState<ArrivalAction | null>(null);
  const [inlineError, setInlineError] = useState<unknown>(null);
  const isBusy = pendingAction !== null;

  const appointmentLocationUuid = appointment.location?.uuid;
  const exactArrivalRules = appointmentLocationUuid
    ? (appointmentArrivalRules ?? []).filter(
        (rule) =>
          rule.appointmentServiceUuid === appointment.service.uuid &&
          rule.appointmentLocationUuid === appointmentLocationUuid,
      )
    : [];
  const arrivalRule = exactArrivalRules.length === 1 ? exactArrivalRules[0] : undefined;
  const canSendToQueue =
    arrivalRule?.arrivalPolicy === 'queue-optional' || arrivalRule?.arrivalPolicy === 'queue-required';
  const canStartDirectly =
    canOpenPatientChart &&
    (arrivalRule?.arrivalPolicy === 'queue-optional' || arrivalRule?.arrivalPolicy === 'direct');

  const getCheckInErrorMessageOptions = () =>
    ({
      codeMessages: {
        [APPOINTMENT_STATUS_CONFLICT]: t(
          'appointmentStatusChanged',
          'El estado de la cita cambió. Actualice la lista antes de continuar.',
        ),
        [COMPANION_CAPABILITY_MISSING]: t(
          'companionCapabilityMissing',
          'El paciente es menor de edad y requiere un acompañante, pero su usuario no tiene permisos para buscar personas. Solicite el registro de la llegada a un usuario con ese acceso.',
        ),
        [MULTIPLE_ACTIVE_VISITS]: t(
          'multipleActiveVisits',
          'El paciente tiene más de una consulta activa. Regularice las consultas antes de continuar.',
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
          'No se puede continuar con el triaje porque esta atención no tiene SIS vigente. Derive al paciente a Caja para regularizar el pago o la cobertura.',
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
    if ((action === 'queue' && !canSendToQueue) || (action === 'direct' && !canStartDirectly)) {
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

  const validateAppointmentStatus = async (allowAlreadyCheckedIn = false) => {
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
          if (getSisFinancingState(visitInsurance) !== 'active') {
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
    const currentStatus = await getCurrentCheckInStatus();
    if (currentStatus === AppointmentStatus.CHECKEDIN) {
      mutateAppointments?.();
      return;
    }

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

  const canSearchCompanionPerson = userHasAccess(
    [appointmentsPrivilege, appointmentsEditPrivilege, 'Get People'],
    session?.user,
  );

  // Both start-visit paths demand an adult companion for minors; without the
  // search capability the operator cannot satisfy that inside the form, so the
  // block is explained here instead of after opening it. Runs only when no
  // reusable active visit exists, and fails open when the birth date is unknown
  // because the form still enforces the requirement.
  const assertCompanionCapabilityForMinor = () => {
    const birthDate = fhirPatient?.birthDate;
    if (!birthDate) {
      return;
    }
    const isMinor = dayjs().startOf('day').diff(dayjs(birthDate).startOf('day'), 'year') < 18;
    if (isMinor && !canSearchCompanionPerson) {
      throw Object.assign(new Error('The operator cannot search for a companion person.'), {
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

      const activeVisits = await fetchActiveVisits();

      if (activeVisits[0]) {
        assertVisitMatchesAppointmentLocation(activeVisits[0]);
        assertVisitTypeIsCompatible(activeVisits[0]);
        if (!checkInButton.showIfActiveVisit) {
          mutateVisits?.();
          closeModal();
          return;
        }
        await launchWorkspace2(addActiveVisitToQueueWorkspace, {
          activeVisit: activeVisits[0],
          currentQueueLocationUuid: requiredQueueLocationUuid,
          currentServiceQueueUuid: arrivalQueueUuid,
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
        closeModal();
        return;
      }

      assertCompanionCapabilityForMinor();
      await launchWorkspace2(appointmentsStartVisitWorkspace, {
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
      closeModal();
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
      assertVisitLinkIsConfigured();
      const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
      if (!(await validateAppointmentStatus())) {
        closeModal();
        return;
      }

      const activeVisits = await fetchActiveVisits();

      if (activeVisits[0]) {
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
      assertCompanionCapabilityForMinor();
      await launchWorkspace2(appointmentsStartVisitWorkspace, {
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
      closeModal();
    } catch (error) {
      setInlineError(error);
    } finally {
      setPendingAction(null);
    }
  };

  const routingConfigurationError = getRoutingConfigurationError();
  const displayedError = inlineError ?? routingConfigurationError;

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('arrivalModalTitle', 'Registrar llegada')} />
      <ModalBody>
        <div className={styles.appointmentSummary}>
          <p className={styles.patientName}>{appointment.patient.name}</p>
          <p className={styles.appointmentDetails}>
            {appointment.service?.name}
            {' · '}
            {formatDatetime(new Date(appointment.startDateTime))}
          </p>
        </div>
        <p>{t('arrivalModalDescription', 'Seleccione cómo desea registrar la llegada del paciente.')}</p>
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
      </ModalBody>
      <ModalFooter>
        <Button disabled={isBusy} kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        {canStartDirectly && !routingConfigurationError ? (
          <Button disabled={isBusy} kind={canSendToQueue ? 'tertiary' : 'primary'} onClick={handleStartDirectly}>
            {pendingAction === 'direct' ? (
              <InlineLoading description={t('startingDirectCare', 'Iniciando atención') + '...'} />
            ) : (
              t('startCareDirectly', 'Iniciar atención directamente')
            )}
          </Button>
        ) : null}
        {canSendToQueue && !routingConfigurationError ? (
          <Button disabled={isBusy} kind="primary" onClick={handleSendToQueue}>
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
