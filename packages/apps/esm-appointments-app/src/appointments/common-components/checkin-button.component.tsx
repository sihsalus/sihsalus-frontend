import { Button } from '@carbon/react';
import { navigate, showModal, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { type Appointment } from '../../types';

dayjs.extend(utc);
dayjs.extend(isToday);

interface CheckInButtonProps {
  patientUuid: string;
  appointment: Appointment;
  mutateVisits?: () => void;
}

/**
 * Botón «Registrar llegada» de una cita. Abre el modal de llegada, que ofrece
 * enviar al paciente a la cola de espera o iniciar la atención directamente.
 */
const CheckInButton: React.FC<CheckInButtonProps> = ({ appointment, patientUuid, mutateVisits }) => {
  const { checkInButton } = useConfig<ConfigObject>();
  const { t } = useTranslation();

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

              const dispose = showModal('appointment-arrival-modal', {
                appointment,
                patientUuid,
                mutateVisits,
                closeModal: () => dispose(),
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
