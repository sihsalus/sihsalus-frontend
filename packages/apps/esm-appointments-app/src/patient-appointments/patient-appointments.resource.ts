import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import useSWR from 'swr';

import { type AppointmentsFetchResponse } from '../types';

dayjs.extend(isToday);

const appointmentsSearchUrl = `${restBaseUrl}/appointments/search`;
export const APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING = 'APPOINTMENT_VISIT_LINK_CONFIGURATION_MISSING';

const pendingAppointmentStatuses = new Set(['requested', 'scheduled', 'waitlist']);

export function toAppointmentDate(value: Date | number | string): Date | null {
  let normalizedValue: Date | number | string = value;

  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    normalizedValue = Number(value);
  }

  if (typeof normalizedValue === 'number') {
    // Appointment APIs may return Unix timestamps in either seconds or milliseconds.
    normalizedValue = Math.abs(normalizedValue) < 100_000_000_000 ? normalizedValue * 1000 : normalizedValue;
  }

  const date = normalizedValue instanceof Date ? new Date(normalizedValue.valueOf()) : new Date(normalizedValue);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function isPendingAppointment(status: unknown) {
  const normalizedStatus = String(status ?? '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
  return pendingAppointmentStatuses.has(normalizedStatus);
}

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
    .sort(
      (a, b) =>
        (toAppointmentDate(b.startDateTime)?.valueOf() ?? 0) - (toAppointmentDate(a.startDateTime)?.valueOf() ?? 0),
    )
    ?.filter(({ status }) => status !== 'Cancelled')
    ?.filter(({ startDateTime }) => {
      const appointmentDate = toAppointmentDate(startDateTime);
      return appointmentDate && dayjs(appointmentDate).isBefore(new Date().setHours(0, 0, 0, 0));
    });

  const upcomingAppointments = appointments
    .slice()
    .sort(
      (a, b) =>
        (toAppointmentDate(a.startDateTime)?.valueOf() ?? 0) - (toAppointmentDate(b.startDateTime)?.valueOf() ?? 0),
    )
    ?.filter(({ status }) => isPendingAppointment(status))
    // Upcoming means future days. Appointments later today belong only to todaysAppointments.
    ?.filter(({ startDateTime }) => {
      const appointmentDate = toAppointmentDate(startDateTime);
      return appointmentDate && dayjs(appointmentDate).isAfter(dayjs().endOf('day'));
    });

  const todaysAppointments = appointments
    .slice()
    .sort(
      (a, b) =>
        (toAppointmentDate(a.startDateTime)?.valueOf() ?? 0) - (toAppointmentDate(b.startDateTime)?.valueOf() ?? 0),
    )
    ?.filter(({ status }) => isPendingAppointment(status))
    ?.filter(({ startDateTime }) => {
      const appointmentDate = toAppointmentDate(startDateTime);
      return appointmentDate && dayjs(appointmentDate).isToday();
    });

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
