import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { uniqBy } from 'lodash-es';
import { useContext, useMemo } from 'react';
import useSWR from 'swr';

import { omrsDateFormat } from '../constants';
import {
  flattenAppointmentSummary,
  getHighestAppointmentServiceLoad,
  getServiceCountByAppointmentType,
} from '../helpers';
import { type Appointment, type AppointmentSummary } from '../types';

import SelectedDateContext from './selectedDateContext';

const filterAppointmentsByService = (
  appointments: Array<Appointment>,
  appointmentServiceTypeUuids: Array<string>,
) =>
  appointmentServiceTypeUuids.length > 0
    ? appointments.filter(({ service }) => service && appointmentServiceTypeUuids.includes(service.uuid))
    : appointments;

export const useClinicalMetrics = (appointmentServiceTypeUuids: Array<string> = []) => {
  const { selectedDate } = useContext(SelectedDateContext);
  const startDate = dayjs(selectedDate).startOf('day').format(omrsDateFormat);
  const endDate = dayjs(selectedDate).endOf('day').format(omrsDateFormat);
  const url = `${restBaseUrl}/appointment/appointmentSummary?startDate=${startDate}&endDate=${endDate}`;
  const { data, error, isLoading } = useSWR<{
    data: Array<AppointmentSummary>;
  }>(url, openmrsFetch);
  const appointmentSummary =
    appointmentServiceTypeUuids.length > 0
      ? (data?.data ?? []).filter(({ appointmentService }) =>
          appointmentServiceTypeUuids.includes(appointmentService.uuid),
        )
      : (data?.data ?? []);

  const totalAppointments = getServiceCountByAppointmentType(appointmentSummary, 'allAppointmentsCount');

  const missedAppointments = getServiceCountByAppointmentType(appointmentSummary, 'missedAppointmentsCount');

  const transformedAppointments = flattenAppointmentSummary(appointmentSummary);
  const highestServiceLoad = getHighestAppointmentServiceLoad(transformedAppointments);

  return {
    isLoading,
    error,
    totalAppointments,
    missedAppointments,
    highestServiceLoad,
  };
};

export const useAppointmentsForDate = () => {
  const { selectedDate } = useContext(SelectedDateContext);
  const startDate = dayjs(selectedDate).startOf('day').format(omrsDateFormat);
  const endDate = dayjs(selectedDate).endOf('day').format(omrsDateFormat);
  const searchUrl = `${restBaseUrl}/appointments/search`;
  const key = selectedDate ? [searchUrl, startDate, endDate] : null;
  const fetcher = ([url, requestStartDate, requestEndDate]: Array<string>) =>
    openmrsFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        startDate: requestStartDate,
        endDate: requestEndDate,
      },
    });

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Array<Appointment> }, Error>(
    key,
    fetcher,
    { errorRetryCount: 2 },
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
};

export const useAllAppointmentsByDate = (appointmentServiceTypeUuids: Array<string> = []) => {
  const { data, error, isLoading, isValidating, mutate } = useAppointmentsForDate();

  const filteredAppointments = useMemo(
    () => filterAppointmentsByService(data?.data ?? [], appointmentServiceTypeUuids),
    [data?.data, appointmentServiceTypeUuids],
  );
  const providersArray = filteredAppointments.flatMap(({ providers }) => providers ?? []);
  const validProviders = providersArray.filter((provider) => provider.response === 'ACCEPTED');
  const uniqueProviders = uniqBy(validProviders, (provider) => provider.uuid);
  const providersCount = uniqueProviders.length;

  return {
    error,
    isLoading,
    isValidating,
    mutate,
    totalProviders: providersCount ? providersCount : 0,
  };
};

export const useScheduledAppointments = (appointmentServiceTypeUuids: string[]) => {
  const { data, error, isLoading } = useAppointmentsForDate();

  const totalScheduledAppointments = useMemo(() => {
    return filterAppointmentsByService(data?.data ?? [], appointmentServiceTypeUuids).length;
  }, [data?.data, appointmentServiceTypeUuids]);

  return {
    error,
    isLoading,
    totalScheduledAppointments,
  };
};
