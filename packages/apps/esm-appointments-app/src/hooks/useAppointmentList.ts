import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { useContext } from 'react';
import useSWR from 'swr';

import { omrsDateFormat } from '../constants';
import { type AppointmentsFetchResponse } from '../types';

import SelectedDateContext from './selectedDateContext';

export const useAppointmentList = (appointmentStatus: string, date?: string) => {
  const { selectedDate } = useContext(SelectedDateContext);
  const startDate = dayjs(date ?? selectedDate)
    .startOf('day')
    .format(omrsDateFormat);
  const endDate = dayjs(startDate).endOf('day').format(omrsDateFormat);
  const searchUrl = `${restBaseUrl}/appointments/search`;
  const abortController = new AbortController();

  const fetcher = ([url, startDate, endDate, status]) =>
    openmrsFetch(url, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        startDate: startDate,
        endDate: endDate,
        status: status,
      },
    });

  const { data, error, isLoading, mutate } = useSWR<AppointmentsFetchResponse, Error>(
    [searchUrl, startDate, endDate, appointmentStatus],
    fetcher,
    { errorRetryCount: 2 },
  );

  return { appointmentList: data?.data ?? [], isLoading, error, mutate };
};

export const useEarlyAppointmentList = (startDate?: string) => {
  const { selectedDate } = useContext(SelectedDateContext);
  const forDate = startDate ? startDate : selectedDate;
  const url = `${restBaseUrl}/appointment/earlyAppointment?forDate=${forDate}`;

  const { data, error, isLoading } = useSWR<AppointmentsFetchResponse, Error>(url, openmrsFetch, {
    errorRetryCount: 2,
  });

  return { earlyAppointmentList: data?.data ?? [], isLoading, error };
};
