import { openmrsFetch, restBaseUrl, updateVisit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import useSWR from 'swr';

import { omrsDateFormat, timeZone } from '../constants';
import { endQueueEntry as endQueueEntrySafely } from '../modals/queue-entry-actions.resource';
import { type Appointment, type AppointmentsFetchResponse, type EndVisitPayload } from '../types';

export async function endQueueEntry(
  queueEntryUuid: string,
  endCurrentVisitPayload: Omit<EndVisitPayload, 'stopDatetime'> | null,
  visitUuid: string,
  appointments: Array<Appointment> | null,
) {
  const abortController = new AbortController();

  if (endCurrentVisitPayload) {
    if (appointments?.length) {
      await Promise.all(
        appointments.map(async (appointment) => {
          await changeAppointmentStatus('Completed', appointment.uuid);
        }),
      );
    }

    const queueEndResponse = await endQueueEntrySafely(queueEntryUuid, abortController);
    const authoritativeEndedAt = new Date(queueEndResponse.data?.endedAt);
    if (Number.isNaN(authoritativeEndedAt.valueOf())) {
      throw new Error('The queue entry end response did not include an authoritative end time.');
    }
    return updateVisit(visitUuid, { ...endCurrentVisitPayload, stopDatetime: authoritativeEndedAt }, abortController);
  }

  return endQueueEntrySafely(queueEntryUuid, abortController);
}

export function useCheckedInAppointments(patientUuid: string, startDate: string) {
  const abortController = new AbortController();

  const appointmentsSearchUrl = `${restBaseUrl}/appointments/search`;
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

  const { data, error, isLoading, isValidating } = useSWR<AppointmentsFetchResponse, Error>(
    appointmentsSearchUrl,
    fetcher,
  );

  const appointments = data?.data?.length
    ? data.data.filter((appointment) => appointment.status === 'CheckedIn')
    : null;

  return {
    data: data ? appointments : null,
    error,
    isLoading,
    isValidating,
  };
}

export async function changeAppointmentStatus(toStatus: string, appointmentUuid: string) {
  const url = `${restBaseUrl}/appointments/${appointmentUuid}/status-change`;
  return openmrsFetch(url, {
    body: { toStatus, onDate: dayjs().format(omrsDateFormat), timeZone: timeZone },
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
