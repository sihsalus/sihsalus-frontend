import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useContext } from 'react';
import useSWR from 'swr';

import { type Appointment, type AppointmentsFetchResponse } from '../types';

import SelectedDateContext from './selectedDateContext';

export function usePatientAppointmentHistory(patientUuid: string) {
  const abortController = new AbortController();
  const appointmentsSearchUrl = `${restBaseUrl}/appointments/search`;
  const { selectedDate } = useContext(SelectedDateContext);
  const fetcher = () =>
    openmrsFetch(appointmentsSearchUrl, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        patientUuid: patientUuid,
        startDate: selectedDate,
      },
    });

  const { data, error, isLoading, isValidating } = useSWR<AppointmentsFetchResponse, Error>(
    patientUuid ? [appointmentsSearchUrl, patientUuid, selectedDate] : null,
    fetcher,
  );

  const missedAppointments = data?.data?.length
    ? data.data.filter((appointment) => appointment.status === 'Missed').length
    : 0;
  const completedAppointments = data?.data?.length
    ? data.data.filter((appointment) => appointment.status === 'Completed').length
    : 0;
  const cancelledAppointments = data?.data?.length
    ? data.data.filter((appointment) => appointment.status === 'Cancelled').length
    : 0;
  const upcomingAppointments = data?.data?.length
    ? data.data?.filter((appointment: Appointment) => dayjs(new Date(appointment.startDateTime)).isAfter(dayjs()))
        .length
    : 0;

  return {
    appointmentsCount: { missedAppointments, completedAppointments, cancelledAppointments, upcomingAppointments },
    error,
    isLoading,
    isValidating,
  };
}
