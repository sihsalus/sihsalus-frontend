import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';

import type { CREDControlWithStatus } from '../../hooks/useCREDSchedule';
import type { AppointmentPayload } from '../../types';

interface CreateCREDAppointmentsResult {
  created: string[];
  errors: Array<{ controlNumber: number; error: Error }>;
}

/**
 * Crea citas CRED para los controles proporcionados usando la API de Appointments.
 * Solo crea citas para controles que no tienen encounter ni appointment existente.
 */
export async function createCREDAppointments(
  patientUuid: string,
  controls: CREDControlWithStatus[],
  serviceUuid: string,
  locationUuid: string,
  durationMins: number,
): Promise<CreateCREDAppointmentsResult> {
  const created: string[] = [];
  const errors: Array<{ controlNumber: number; error: Error }> = [];
  const dateFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';

  for (const control of controls) {
    const startDate = dayjs(control.targetDate).hour(8).minute(0).second(0);
    const endDate = startDate.add(durationMins, 'minute');

    if (!startDate.isAfter(dayjs())) {
      errors.push({
        controlNumber: control.controlNumber,
        error: new Error('No se puede crear una cita CRED en una fecha pasada.'),
      });
      continue;
    }

    const payload: AppointmentPayload = {
      patientUuid,
      serviceUuid,
      dateAppointmentScheduled: dayjs().format(dateFormat),
      startDateTime: startDate.format(dateFormat),
      endDateTime: endDate.format(dateFormat),
      appointmentKind: 'Scheduled',
      locationUuid,
      comments: `Control Crecimiento y Desarrollo #${control.controlNumber} - ${control.label}`,
      status: 'Scheduled',
    };

    try {
      const response = await openmrsFetch(`${restBaseUrl}/appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      created.push(response?.data?.uuid ?? control.controlNumber.toString());
    } catch (err) {
      errors.push({ controlNumber: control.controlNumber, error: err as Error });
    }
  }

  return { created, errors };
}
