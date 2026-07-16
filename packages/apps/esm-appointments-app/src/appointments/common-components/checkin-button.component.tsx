import { Button } from '@carbon/react';
import {
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  launchWorkspace2,
  navigate,
  showSnackbar,
  useConfig,
  type Visit,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
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
import { getActiveVisitsForPatient } from './batch-change-appointment-statuses.resources';

dayjs.extend(utc);
dayjs.extend(isToday);

const appointmentsStartVisitWorkspace = 'appointments-start-visit-workspace';
const addActiveVisitToQueueWorkspace = 'appointments-add-active-visit-to-queue-workspace';
const APPOINTMENT_STATUS_CONFLICT = 'APPOINTMENT_STATUS_CONFLICT';
const ACTIVE_VISIT_CHANGED = 'ACTIVE_VISIT_CHANGED';
const ACTIVE_VISIT_LOCATION_MISMATCH = 'ACTIVE_VISIT_LOCATION_MISMATCH';
const ACTIVE_VISIT_TYPE_MISMATCH = 'ACTIVE_VISIT_TYPE_MISMATCH';
const APPOINTMENT_LOCATION_MISSING = 'APPOINTMENT_LOCATION_MISSING';
const APPOINTMENT_VISIT_TYPE_MAPPING_MISSING = 'APPOINTMENT_VISIT_TYPE_MAPPING_MISSING';
const MULTIPLE_ACTIVE_VISITS = 'MULTIPLE_ACTIVE_VISITS';

interface CheckInButtonProps {
  patientUuid: string;
  appointment: Appointment;
  mutateVisits?: () => void;
}

const CheckInButton: React.FC<CheckInButtonProps> = ({ appointment, patientUuid, mutateVisits }) => {
  const { appointmentQueueMappings, appointmentVisitAttributeTypeUuid, checkInButton } = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const appointmentLocationUuid = appointment.location?.uuid;
  const queueMapping = appointmentLocationUuid
    ? (appointmentQueueMappings ?? []).find(
        (mapping) =>
          mapping.appointmentServiceUuid === appointment.service.uuid &&
          mapping.appointmentLocationUuid === appointmentLocationUuid,
      )
    : undefined;
  const serviceMappings = (appointmentQueueMappings ?? []).filter(
    (mapping) => mapping.appointmentServiceUuid === appointment.service.uuid,
  );
  const visitTypeMapping = queueMapping ?? (serviceMappings.length === 1 ? serviceMappings[0] : undefined);

  const showCheckInFailure = (error: unknown) =>
    showSnackbar({
      title: t('checkInFailed', 'No se pudo admitir la cita'),
      subtitle: getCompatibleUserFacingErrorMessage(
        error,
        t('appointmentCheckInFailed', 'No se pudo completar la admisión de la cita. Intente nuevamente.'),
        {
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
            [APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING]: t(
              'appointmentVisitLinkNotConfigured',
              'No está configurado el vínculo entre cita y consulta. Contacte al administrador antes de continuar.',
            ),
          },
          logContext: 'Check in appointment',
        },
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
      showCheckInFailure(error);
      return false;
    }
  };

  const checkIn = async (subtitle: string) => {
    setIsCheckingIn(true);
    try {
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
    } catch (error) {
      showCheckInFailure(error);
      throw error;
    } finally {
      setIsCheckingIn(false);
    }
  };

  return (
    <>
      {checkInButton.enabled &&
        (dayjs(appointment.startDateTime).isAfter(dayjs()) || dayjs(appointment.startDateTime).isToday()) && (
          <Button
            size="sm"
            kind="tertiary"
            disabled={isCheckingIn}
            onClick={async () => {
              if (checkInButton.customUrl) {
                navigate({
                  to: checkInButton.customUrl,
                  templateParams: { patientUuid: appointment.patient.uuid, appointmentUuid: appointment.uuid },
                });
                return;
              }

              setIsCheckingIn(true);
              try {
                assertVisitLinkIsConfigured();
                const requiredAppointmentLocationUuid = getAppointmentLocationUuid();
                const requiredQueueLocationUuid = queueMapping?.queueLocationUuid ?? requiredAppointmentLocationUuid;
                if (!(await validateAppointmentStatus())) {
                  return;
                }

                const activeVisits = await fetchActiveVisits();

                if (activeVisits[0]) {
                  assertVisitMatchesAppointmentLocation(activeVisits[0]);
                  assertVisitTypeIsCompatible(activeVisits[0], true);
                  if (!checkInButton.showIfActiveVisit) {
                    mutateVisits?.();
                    return;
                  }
                  await launchWorkspace2(addActiveVisitToQueueWorkspace, {
                    activeVisit: activeVisits[0],
                    currentQueueLocationUuid: requiredQueueLocationUuid,
                    currentServiceQueueUuid: queueMapping?.queueUuid,
                    requestedServiceName: appointment.service.name,
                    requiredVisitLocation: {
                      uuid: requiredAppointmentLocationUuid,
                      display: appointment.location?.name ?? '',
                    },
                    requiredVisitTypeUuid: visitTypeMapping?.requiredVisitTypeUuid,
                    selectedPatientUuid: patientUuid,
                    startVisitWorkspaceName: appointmentsStartVisitWorkspace,
                    visitFormOpenedFrom: 'appointments-check-in',
                    onBeforeQueueEntrySave: (visit: Visit) => validateBeforePersistence(visit, true),
                    onQueueEntryAdded: () =>
                      checkIn(
                        t(
                          'appointmentCheckedInWithExistingVisit',
                          'La cita fue admitida usando la consulta activa y el paciente fue agregado a la cola.',
                        ),
                      ),
                  });
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
                  currentServiceQueueUuid: queueMapping?.queueUuid,
                  requestedServiceName: appointment.service.name,
                  requiredVisitLocation: {
                    uuid: requiredAppointmentLocationUuid,
                    display: appointment.location?.name ?? '',
                  },
                  requiredVisitTypeUuid: visitTypeMapping?.requiredVisitTypeUuid,
                  showPatientHeader: true,
                  openedFrom: 'appointments-check-in',
                  onBeforeVisitSave: (visit?: Visit) => validateBeforePersistence(visit, false),
                  onVisitStarted: async () => {
                    mutateVisits?.();
                    await checkIn(
                      t(
                        'appointmentCheckedInAfterVisitStarted',
                        'La consulta fue iniciada, el paciente fue agregado a la cola y la cita fue admitida.',
                      ),
                    );
                  },
                });
              } catch (error) {
                showCheckInFailure(error);
              } finally {
                setIsCheckingIn(false);
              }
            }}
          >
            {t('checkIn', 'Check in')}
          </Button>
        )}
    </>
  );
};

export default CheckInButton;
