import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import useSWR from 'swr';

import type { AppointmentsFetchResponse } from '../types';
import type { ConfigObject } from '../config-schema';

export default function useAppointmentsCRED(patientUuid: string) {
  const config = useConfig<ConfigObject>();
  const appointmentServiceUuid = config.credScheduling?.appointmentServiceUuid;
  const startDate = dayjs().startOf('day').toISOString();
  const { data, isLoading, error } = useSWR<AppointmentsFetchResponse, Error>(
    patientUuid ? [`${restBaseUrl}/appointments/search`, patientUuid, startDate] : null,
    ([url]) =>
      openmrsFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          patientUuid,
          startDate,
        },
      }),
  );

  return {
    appointments: appointmentServiceUuid
      ? (data?.data ?? []).filter((appointment) => appointment.service?.uuid === appointmentServiceUuid)
      : [],
    isLoading,
    error,
  };
}
