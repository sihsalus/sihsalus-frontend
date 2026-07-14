import { type FetchResponse, openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';

export interface ActiveQueueEntrySummary {
  uuid: string;
  endedAt?: string | null;
  startedAt?: string | null;
}

function getAuthoritativeQueueEndDate(response: FetchResponse<ActiveQueueEntrySummary>) {
  const responseDate = response.headers?.get?.('Date');
  const parsedResponseDate = responseDate ? new Date(responseDate) : null;
  const serverDate =
    parsedResponseDate && !Number.isNaN(parsedResponseDate.valueOf()) ? parsedResponseDate : new Date();
  const startedAt = response.data?.startedAt ? new Date(response.data.startedAt) : null;

  return startedAt && !Number.isNaN(startedAt.valueOf()) && startedAt > serverDate ? startedAt : serverDate;
}

function getQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<FetchResponse<ActiveQueueEntrySummary>> {
  const searchParams = new URLSearchParams({ v: 'custom:(uuid,startedAt,endedAt)' });

  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}?${searchParams.toString()}`, {
    signal: abortController?.signal,
  });
}

/** End a queue entry without replacing an end time already persisted by another operator. */
async function endQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<FetchResponse<ActiveQueueEntrySummary>> {
  const freshResponse = await getQueueEntry(queueEntryUuid, abortController);
  if (freshResponse.data.endedAt) {
    return freshResponse;
  }

  try {
    return await openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController?.signal,
      body: { endedAt: getAuthoritativeQueueEndDate(freshResponse).toISOString() },
    });
  } catch (error) {
    try {
      const latestResponse = await getQueueEntry(queueEntryUuid, abortController);
      if (latestResponse.data.endedAt) {
        return latestResponse;
      }
    } catch {
      // Preserve the original write error when the reconciliation read is unavailable.
    }
    throw error;
  }
}

/** Wait for every requested close so a partial failure can be retried safely. */
export async function endActiveQueueEntries(
  entries: Array<ActiveQueueEntrySummary>,
  abortController?: AbortController,
): Promise<Array<ActiveQueueEntrySummary>> {
  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.uuid, entry])).values());
  const results = await Promise.allSettled(uniqueEntries.map((entry) => endQueueEntry(entry.uuid, abortController)));
  const failedResult = results.find((result) => result.status === 'rejected');

  if (failedResult?.status === 'rejected') {
    throw failedResult.reason;
  }

  return results.map((result) => (result as PromiseFulfilledResult<FetchResponse<ActiveQueueEntrySummary>>).value.data);
}

export function getActiveVisitsForPatient(
  patientUuid: string,
  abortController?: AbortController,
  v?: string,
  limit = '2',
): Promise<FetchResponse<{ results: Array<Visit> }>> {
  const custom = v ?? `default`;

  const searchParams = new URLSearchParams({
    patient: patientUuid,
    v: custom,
    includeInactive: 'false',
    limit,
  });

  return openmrsFetch(`${restBaseUrl}/visit?${searchParams.toString()}`, {
    signal: abortController?.signal,
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
  });
}

export function getActiveQueueEntriesForVisit(
  visitUuid: string,
): Promise<FetchResponse<{ results: Array<ActiveQueueEntrySummary> }>> {
  const searchParams = new URLSearchParams({
    visit: visitUuid,
    isEnded: 'false',
    limit: '100',
    v: 'custom:(uuid,startedAt,endedAt)',
  });

  return openmrsFetch(`${restBaseUrl}/queue-entry?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
  });
}
