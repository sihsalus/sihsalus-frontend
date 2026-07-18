import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  formatDatetime,
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  launchWorkspace2,
  navigate,
  showSnackbar,
  useConfig,
  type Visit,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
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
const ACTIVE_VISIT_CHANGED = 'ACTIVE_VISIT_CHANGED';
const ACTIVE_VISIT_LOCATION_MISMATCH = 'ACTIVE_VISIT_LOCATION_MISMATCH';
const ACTIVE_VISIT_TYPE_MISMATCH = 'ACTIVE_VISIT_TYPE_MISMATCH';
const APPOINTMENT_LOCATION_MISSING = 'APPOINTMENT_LOCATION_MISSING';
const APPOINTMENT_QUEUE_MAPPING_AMBIGUOUS = 'APPOINTMENT_QUEUE_MAPPING_AMBIGUOUS';
const APPOINTMENT_QUEUE_MAPPING_MISSING = 'APPOINTMENT_QUEUE_MAPPING_MISSING';
const APPOINTMENT_VISIT_TYPE_MAPPING_MISSING = 'APPOINTMENT_VISIT_TYPE_MAPPING_MISSING';
const MULTIPLE_ACTIVE_VISITS = 'MULTIPLE_ACTIVE_VISITS';

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
 * 1. «Enviar a cola de espera»: el flujo de admisión existente (visita + queue
 *    entry vía workspaces). Los errores de validación previos al lanzamiento
 *    del workspace (p. ej. cola no configurada para servicio+sede) se muestran
 *    inline dentro del modal sin cerrarlo, dejando disponible la otra opción.
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
  const { appointmentQueueMappings, appointmentVisitAttributeTypeUuid, checkInButton, customPatientChartUrl } =
    useConfig<ConfigObject>();
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();
  const [pendingAction, setPendingAction] = useState<ArrivalAction | null>(null);
  const [inlineErrorMessage, setInlineErrorMessage] = useState<string | null>(null);
  const isBusy = pendingAction !== null;

  const appointmentLocationUuid = appointment.location?.uuid;
  const exactQueueMappings = appointmentLocationUuid
    ? (appointmentQueueMappings ?? []).filter(
        (mapping) =>
          mapping.appointmentServiceUuid === appointment.service.uuid &&
          mapping.appointmentLocationUuid === appointmentLocationUuid,
      )
    : [];
  const queueMapping = exactQueueMappings.length === 1 ? exactQueueMappings[0] : undefined;

  const getCheckInErrorMessageOptions = () =>
    ({
      codeMessages: {
        [APPOINTMENT_STATUS_CONFLICT]: t(
          'appointmentStatusChanged',
          'El estado de la cita cambió. Actualice la lista antes de continuar.',
        ),
        [MULTIPLE_ACTIVE_VISITS]: t(
          'multipleActiveVisits',
          'El paciente tiene más de una consulta activa. Regularice las consultas antes de continuar.',
        ),
        [ACTIVE_VISIT_CHANGED]: t(
          'activeVisitChanged',
          'La consulta activa del paciente cambió. Cierre este formulario y vuelva a iniciar la admisión.',
        ),
        [ACTIVE_VISIT_LOCATION_MISMATCH]: t(
          'activeVisitLocationMismatch',
          'La consulta activa pertenece a otra sede o servicio. Finalícela o regularícela antes de admitir esta cita.',
        ),
        [ACTIVE_VISIT_TYPE_MISMATCH]: t(
          'activeVisitTypeMismatch',
          'El tipo de la consulta activa no corresponde al servicio de la cita. Regularice la consulta antes de continuar.',
        ),
        [APPOINTMENT_VISIT_TYPE_MAPPING_MISSING]: t(
          'appointmentVisitTypeMappingMissing',
          'Este servicio no tiene una regla aprobada para reutilizar una consulta activa. Inicie una nueva atención cuando no exista otra consulta activa.',
        ),
        [APPOINTMENT_LOCATION_MISSING]: t(
          'appointmentLocationMissing',
          'La cita no tiene una sede válida. Regularice la cita antes de iniciar la atención.',
        ),
        [APPOINTMENT_QUEUE_MAPPING_AMBIGUOUS]: t(
          'appointmentQueueMappingAmbiguous',
          'Existe más de una regla de cola para este servicio y sede. Corrija la configuración antes de admitir la cita.',
        ),
        [APPOINTMENT_QUEUE_MAPPING_MISSING]: t(
          'appointmentQueueMappingMissing',
          'No existe una cola configurada para el servicio y la sede de esta cita. Contacte al administrador antes de continuar.',
        ),
        [APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING]: t(
          'appointmentVisitLinkNotConfigured',
          'No está configurado el vínculo entre cita y consulta. Contacte al administrador antes de continuar.',
        ),
      },
      logContext: 'Check in appointment',
    }) as const;

  const getCheckInErrorMessage = (error: unknown) =>
    getCompatibleUserFacingErrorMessage(
      error,
      t('appointmentCheckInFailed', 'No se pudo completar la admisión de la cita. Intente nuevamente.'),
      getCheckInErrorMessageOptions(),
      frameworkGetUserFacingErrorMessage,
    );

  // Errores que ocurren cuando el modal ya se cerró (callbacks de los
  // workspaces) siguen llegando al usuario como snackbar, igual que antes.
  const showCheckInFailureSnackbar = (error: unknown) =>
    showSnackbar({
      title: t('checkInFailed', 'No se pudo admitir la cita'),
      subtitle: getCompatibleUserFacingErrorMessage(
        error,
        t('appointmentCheckInFailed', 'No se pudo completar la admisión de la cita. Intente nuevamente.'),
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

  const assertVisitTypeIsCompatible = (visit: Visit, requireMapping: boolean) => {
    if (!queueMapping) {
      if (requireMapping) {
        throw Object.assign(new Error('No approved visit type mapping exists for the appointment service.'), {
          code: APPOINTMENT_VISIT_TYPE_MAPPING_MISSING,
        });
      }
      return;
    }

    const compatibleVisitTypeUuids = queueMapping.compatibleActiveVisitTypeUuids?.length
      ? queueMapping.compatibleActiveVisitTypeUuids
      : [queueMapping.requiredVisitTypeUuid];
    if (!visit.visitType?.uuid || !compatibleVisitTypeUuids.includes(visit.visitType.uuid)) {
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

  const validateBeforePersistence = async (expectedVisit?: Visit, requireMappedVisitType = false) => {
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
        assertVisitTypeIsCompatible(activeVisit, requireMappedVisitType);
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
      title: t('checkedIn', 'Cita en progreso'),
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

  const navigateToPatientChart = () => {
    navigate({ to: customPatientChartUrl, templateParams: { patientUuid } });
  };

  const handleSendToQueue = async () => {
    setPendingAction('queue');
    setInlineErrorMessage(null);
    try {
      assertVisitLinkIsConfigured();
      if (exactQueueMappings.length > 1) {
        throw Object.assign(new Error('Multiple queue mappings match this appointment.'), {
          code: APPOINTMENT_QUEUE_MAPPING_AMBIGUOUS,
        });
      }
      const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
      if (!(await validateAppointmentStatus())) {
        closeModal();
        return;
      }
      if (!queueMapping) {
        throw Object.assign(new Error('No queue mapping matches this appointment service and location.'), {
          code: APPOINTMENT_QUEUE_MAPPING_MISSING,
        });
      }
      const requiredQueueLocationUuid = queueMapping.queueLocationUuid;

      const activeVisits = await fetchActiveVisits();

      if (activeVisits[0]) {
        assertVisitMatchesAppointmentLocation(activeVisits[0]);
        assertVisitTypeIsCompatible(activeVisits[0], true);
        if (!checkInButton.showIfActiveVisit) {
          mutateVisits?.();
          closeModal();
          return;
        }
        await launchWorkspace2(addActiveVisitToQueueWorkspace, {
          activeVisit: activeVisits[0],
          currentQueueLocationUuid: requiredQueueLocationUuid,
          currentServiceQueueUuid: queueMapping.queueUuid,
          requestedServiceName: appointment.service.name,
          requiredVisitLocation: {
            uuid: requiredAppointmentLocationUuid,
            display: appointment.location?.name ?? '',
          },
          requiredVisitTypeUuid: queueMapping.requiredVisitTypeUuid,
          selectedPatientUuid: patientUuid,
          startVisitWorkspaceName: appointmentsStartVisitWorkspace,
          visitFormOpenedFrom: 'appointments-check-in',
          onBeforeQueueEntrySave: (visit: Visit) => validateBeforePersistence(visit, true),
          onQueueEntryAdded: () =>
            checkInFromWorkspaceCallback(
              t(
                'appointmentCheckedInWithExistingVisit',
                'La cita fue admitida usando la consulta activa y el paciente fue agregado a la cola.',
              ),
            ),
        });
        closeModal();
        return;
      }

      await launchWorkspace2(appointmentsStartVisitWorkspace, {
        patientUuid: patientUuid,
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
        currentServiceQueueUuid: queueMapping.queueUuid,
        requestedServiceName: appointment.service.name,
        requiredVisitLocation: {
          uuid: requiredAppointmentLocationUuid,
          display: appointment.location?.name ?? '',
        },
        requiredVisitTypeUuid: queueMapping.requiredVisitTypeUuid,
        showPatientHeader: true,
        openedFrom: 'appointments-check-in',
        onBeforeVisitSave: (visit?: Visit) => validateBeforePersistence(visit, true),
        onVisitStarted: async () => {
          mutateVisits?.();
          await checkInFromWorkspaceCallback(
            t(
              'appointmentCheckedInAfterVisitStarted',
              'La consulta fue iniciada, el paciente fue agregado a la cola y la cita fue admitida.',
            ),
          );
        },
      });
      closeModal();
    } catch (error) {
      setInlineErrorMessage(getCheckInErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartDirectly = async () => {
    setPendingAction('direct');
    setInlineErrorMessage(null);
    try {
      assertVisitLinkIsConfigured();
      const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
      if (!(await validateAppointmentStatus())) {
        closeModal();
        return;
      }

      const activeVisits = await fetchActiveVisits();

      if (activeVisits[0]) {
        assertVisitMatchesAppointmentLocation(activeVisits[0]);
        assertVisitTypeIsCompatible(activeVisits[0], false);
        await ensureAppointmentVisitLink(activeVisits[0].uuid, appointment.uuid, appointmentVisitAttributeTypeUuid);
        await checkIn(
          t(
            'appointmentCheckedInDirectly',
            'La cita fue admitida usando la consulta activa. Puede continuar la atención en la historia del paciente.',
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
      await launchWorkspace2(appointmentsStartVisitWorkspace, {
        patientUuid: patientUuid,
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
        requiredVisitTypeUuid: queueMapping?.requiredVisitTypeUuid,
        showPatientHeader: true,
        openedFrom: 'appointments-direct-start',
        onBeforeVisitSave: (visit?: Visit) => validateBeforePersistence(visit, false),
        onVisitStarted: async () => {
          mutateVisits?.();
          await checkInFromWorkspaceCallback(
            t(
              'appointmentCheckedInAfterDirectVisitStarted',
              'La consulta fue iniciada y la cita fue admitida sin pasar por la cola.',
            ),
          );
          navigateToPatientChart();
        },
      });
      closeModal();
    } catch (error) {
      setInlineErrorMessage(getCheckInErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <ModalHeader
        className={styles.modalHeader}
        closeModal={closeModal}
        title={t('arrivalModalTitle', 'Registrar llegada')}
      />
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
        {inlineErrorMessage ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            role="alert"
            title={t('checkInFailed', 'No se pudo admitir la cita')}
            subtitle={inlineErrorMessage}
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button disabled={isBusy} kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button disabled={isBusy} kind="tertiary" onClick={handleStartDirectly}>
          {pendingAction === 'direct' ? (
            <InlineLoading description={t('startingDirectCare', 'Iniciando atención') + '...'} />
          ) : (
            t('startCareDirectly', 'Iniciar atención directamente')
          )}
        </Button>
        <Button disabled={isBusy} kind="primary" onClick={handleSendToQueue}>
          {pendingAction === 'queue' ? (
            <InlineLoading description={t('sendingToQueue', 'Enviando a cola de espera') + '...'} />
          ) : (
            t('sendToWaitingQueue', 'Enviar a cola de espera')
          )}
        </Button>
      </ModalFooter>
    </>
  );
};

export default AppointmentArrivalModal;
