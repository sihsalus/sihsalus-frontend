import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import useSWR from 'swr';

import { type AppointmentsFetchResponse } from '../types';

dayjs.extend(isToday);

const appointmentsSearchUrl = `${restBaseUrl}/appointments/search`;
export const APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING = 'APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING';

interface VisitAttributeSummary {
  value?: unknown;
  attributeType?: { uuid?: string };
}

async function getVisitAttributes(visitUuid: string) {
  const { data } = await openmrsFetch<{ attributes?: Array<VisitAttributeSummary> }>(
    `${restBaseUrl}/visit/${visitUuid}?v=custom:(uuid,attributes:(uuid,value,attributeType:(uuid)))`,
  );
  return data?.attributes ?? [];
}

export async function ensureAppointmentVisitLink(
  visitUuid: string,
  appointmentUuid: string,
  appointmentVisitAttributeTypeUuid: string,
) {
  if (!appointmentVisitAttributeTypeUuid) {
    throw Object.assign(new Error('The appointment visit attribute type is not configured.'), {
      code: APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING,
    });
  }

  const hasLink = (attributes: Array<VisitAttributeSummary>) =>
    attributes.some(
      (attribute) =>
        attribute.attributeType?.uuid === appointmentVisitAttributeTypeUuid &&
        String(attribute.value ?? '').trim() === appointmentUuid,
    );

  if (hasLink(await getVisitAttributes(visitUuid))) {
    return { created: false };
  }

  try {
    const response = await openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        attributeType: appointmentVisitAttributeTypeUuid,
        value: appointmentUuid,
      },
    });
    return { created: true, response };
  } catch (error) {
    try {
      if (hasLink(await getVisitAttributes(visitUuid))) {
        return { created: false };
      }
    } catch {
      // Preserve the original write failure if reconciliation also fails.
    }
    throw error;
  }
}

export function usePatientAppointments(patientUuid: string, startDate: string, abortController: AbortController) {
  /*
    SWR isn't meant to make POST requests for data fetching. This is a consequence of the API only exposing this resource via POST.
    This works but likely isn't recommended.
  */
  const fetcher = () =>
    openmrsFetch(appointmentsSearchUrl, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        patientUuid: patientUuid,
        startDate: startDate,
      },
    });

  const { data, error, isLoading, isValidating, mutate } = useSWR<AppointmentsFetchResponse, Error>(
    patientUuid ? [appointmentsSearchUrl, patientUuid, startDate] : null,
    fetcher,
  );

  const appointments = data?.data ?? [];

  const pastAppointments = appointments
    .slice()
    .sort((a, b) => (b.startDateTime > a.startDateTime ? 1 : -1))
    ?.filter(({ status }) => status !== 'Cancelled')
    ?.filter(({ startDateTime }) =>
      dayjs(new Date(startDateTime).toISOString()).isBefore(new Date().setHours(0, 0, 0, 0)),
    );

  const upcomingAppointments = appointments
    .slice()
    .sort((a, b) => (a.startDateTime > b.startDateTime ? 1 : -1))
    ?.filter(({ status }) => status !== 'Cancelled')
    // Upcoming means future days. Appointments later today belong only to todaysAppointments.
    ?.filter(({ startDateTime }) => dayjs(new Date(startDateTime).toISOString()).isAfter(dayjs().endOf('day')));

  const todaysAppointments = appointments
    .slice()
    .sort((a, b) => (a.startDateTime > b.startDateTime ? 1 : -1))
    ?.filter(({ status }) => status !== 'Cancelled')
    ?.filter(({ startDateTime }) => dayjs(new Date(startDateTime).toISOString()).isToday());

  return {
    data: data ? { pastAppointments, upcomingAppointments, todaysAppointments } : null,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

// TODO: move?
export const changeAppointmentStatus = async (toStatus: string, appointmentUuid: string) => {
  const appointmentResponse = await openmrsFetch(`${restBaseUrl}/appointment?uuid=${appointmentUuid}`);
  const serverDateHeader = appointmentResponse.headers?.get?.('Date');
  const parsedServerDate = serverDateHeader ? new Date(serverDateHeader) : null;
  const onDate =
    parsedServerDate && !Number.isNaN(parsedServerDate.valueOf())
      ? parsedServerDate.toISOString()
      : new Date().toISOString();
  const url = `${restBaseUrl}/appointments/${appointmentUuid}/status-change`;
  return await openmrsFetch(url, {
    body: { toStatus, onDate },
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
};

export const getAppointmentStatus = async (appointmentUuid: string) => {
  const url = `${restBaseUrl}/appointment?uuid=${appointmentUuid}`;
  const { data } = await openmrsFetch<{ status?: string }>(url);
  return data?.status;
};
