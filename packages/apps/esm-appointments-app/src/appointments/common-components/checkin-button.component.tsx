import { Button } from '@carbon/react';
import { launchWorkspace2, navigate, showSnackbar, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { useMutateAppointments } from '../../form/appointments-form.resource';
import {
  changeAppointmentStatus,
  getAppointmentStatus,
} from '../../patient-appointments/patient-appointments.resource';
import { type Appointment, AppointmentStatus } from '../../types';

dayjs.extend(utc);
dayjs.extend(isToday);

const appointmentsStartVisitWorkspace = 'appointments-start-visit-workspace';

interface CheckInButtonProps {
  patientUuid: string;
  appointment: Appointment;
  hasActiveVisit?: boolean;
  mutateVisits?: () => void;
}

const CheckInButton: React.FC<CheckInButtonProps> = ({ appointment, patientUuid, hasActiveVisit, mutateVisits }) => {
  const { checkInButton } = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const { mutateAppointments } = useMutateAppointments();

  const checkIn = async (subtitle: string) => {
    try {
      await changeAppointmentStatus(AppointmentStatus.CHECKEDIN, appointment.uuid);
      showSnackbar({
        title: t('checkedIn', 'Checked in'),
        subtitle,
        kind: 'success',
        isLowContrast: true,
      });
      mutateAppointments?.();
    } catch (error) {
      console.error('Check-in failed:', error);
      showSnackbar({
        title: t('checkInFailed', 'Check-in failed'),
        subtitle:
          error?.message ?? t('appointmentCheckInFailed', 'An error occurred while checking in the appointment'),
        kind: 'error',
        isLowContrast: false,
      });
    }
  };

  return (
    <>
      {checkInButton.enabled &&
        (dayjs(appointment.startDateTime).isAfter(dayjs()) || dayjs(appointment.startDateTime).isToday()) && (
          <Button
            size="sm"
            kind="tertiary"
            onClick={() => {
              if (checkInButton.customUrl) {
                navigate({
                  to: checkInButton.customUrl,
                  templateParams: { patientUuid: appointment.patient.uuid, appointmentUuid: appointment.uuid },
                });
                return;
              }

              if (hasActiveVisit) {
                void checkIn(
                  t('appointmentCheckedInWithExistingVisit', 'Appointment checked in using existing active visit'),
                );
                return;
              }

              launchWorkspace2(appointmentsStartVisitWorkspace, {
                patientUuid: patientUuid,
                showPatientHeader: true,
                openedFrom: 'appointments-check-in',
                onVisitStarted: async () => {
                  mutateVisits?.();
                  try {
                    const appointmentStatus = await getAppointmentStatus(appointment.uuid);
                    if (appointmentStatus === AppointmentStatus.CHECKEDIN) {
                      mutateAppointments?.();
                      return;
                    }
                  } catch (error) {
                    console.error('Could not verify appointment status before check-in:', error);
                  }

                  await checkIn(
                    t(
                      'appointmentCheckedInAfterVisitStarted',
                      'The visit was started and the appointment was checked in',
                    ),
                  );
                },
              });
            }}
          >
            {t('checkIn', 'Check in')}
          </Button>
        )}
    </>
  );
};

export default CheckInButton;
