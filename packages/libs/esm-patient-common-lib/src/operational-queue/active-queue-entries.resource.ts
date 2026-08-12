import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export const ACTIVE_QUEUE_ENTRY_SEARCH_STALLED = 'ACTIVE_QUEUE_ENTRY_SEARCH_STALLED';
export const ACTIVE_QUEUE_ENTRY_CLOSE_UNVERIFIED = 'ACTIVE_QUEUE_ENTRY_CLOSE_UNVERIFIED';

export interface ActiveQueueEntrySummary {
  uuid: string;
  endedAt?: string | null;
  startedAt?: string | null;
  visit?: { stopDatetime?: string | null; uuid?: string | null } | null;
}

interface QueueEntrySearchResponse {
  results?: Array<ActiveQueueEntrySummary>;
}

interface QueueEntryEndOutcome {
  entry: ActiveQueueEntrySummary;
  transitioned: boolean;
}

const queueEntryPageSize = 100;
const queueEntryRepresentation = 'custom:(uuid,startedAt,endedAt,visit:(uuid,stopDatetime))';

function getAuthoritativeQueueEndDate(response: FetchResponse<ActiveQueueEntrySummary>) {
  const responseDate = response.headers?.get?.('Date');
  const parsedResponseDate = responseDate ? new Date(responseDate) : null;
  const serverDate =
    parsedResponseDate && !Number.isNaN(parsedResponseDate.valueOf()) ? parsedResponseDate : new Date();
  const startedAt = response.data?.startedAt ? new Date(response.data.startedAt) : null;
  const visitStopValue = response.data?.visit?.stopDatetime;
  const visitStop = visitStopValue ? new Date(visitStopValue) : null;

  if (visitStopValue && (!visitStop || Number.isNaN(visitStop.valueOf()))) {
    throw Object.assign(new Error('The linked visit has an invalid stop date.'), {
      code: 'ACTIVE_QUEUE_ENTRY_VISIT_STOP_INVALID',
    });
  }
  if (
    visitStop &&
    startedAt &&
    !Number.isNaN(startedAt.valueOf()) &&
    visitStop.valueOf() < startedAt.valueOf()
  ) {
    throw Object.assign(new Error('The linked visit ended before the queue entry started.'), {
      code: 'ACTIVE_QUEUE_ENTRY_END_DATE_INVALID',
    });
  }

  const unconstrainedEnd =
    startedAt && !Number.isNaN(startedAt.valueOf()) && startedAt > serverDate ? startedAt : serverDate;
  return visitStop && visitStop < unconstrainedEnd ? visitStop : unconstrainedEnd;
}

function getQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<FetchResponse<ActiveQueueEntrySummary>> {
  const searchParams = new URLSearchParams({ v: queueEntryRepresentation });

  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}?${searchParams.toString()}`, {
    signal: abortController?.signal,
  });
}

/** End one entry from a fresh read, and verify ambiguous writes before returning. */
async function endQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<QueueEntryEndOutcome> {
  const freshResponse = await getQueueEntry(queueEntryUuid, abortController);
  if (freshResponse.data.endedAt) {
    return { entry: freshResponse.data, transitioned: false };
  }
  const endedAt = getAuthoritativeQueueEndDate(freshResponse).toISOString();

  try {
    await openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController?.signal,
      body: { endedAt },
    });
  } catch (error) {
    try {
      const latestResponse = await getQueueEntry(queueEntryUuid, abortController);
      if (latestResponse.data.endedAt) {
        return { entry: latestResponse.data, transitioned: true };
      }
    } catch {
      // Preserve the original write error when its outcome cannot be verified.
    }
    throw error;
  }

  const latestResponse = await getQueueEntry(queueEntryUuid, abortController);
  if (!latestResponse.data.endedAt) {
    throw Object.assign(new Error('The queue entry close could not be verified.'), {
      code: ACTIVE_QUEUE_ENTRY_CLOSE_UNVERIFIED,
    });
  }

  return { entry: latestResponse.data, transitioned: true };
}

async function endActiveQueueEntryOutcomes(
  entries: Array<ActiveQueueEntrySummary>,
  abortController?: AbortController,
): Promise<Array<QueueEntryEndOutcome>> {
  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.uuid, entry])).values());
  const results = await Promise.allSettled(
    uniqueEntries.map((entry) => endQueueEntry(entry.uuid, abortController)),
  );
  const failedResult = results.find((result) => result.status === 'rejected');

  if (failedResult?.status === 'rejected') {
    throw failedResult.reason;
  }

  return results.map((result) => (result as PromiseFulfilledResult<QueueEntryEndOutcome>).value);
}

/** Wait for every requested close so a partial failure can be retried safely. */
export async function endActiveQueueEntries(
  entries: Array<ActiveQueueEntrySummary>,
  abortController?: AbortController,
): Promise<Array<ActiveQueueEntrySummary>> {
  const outcomes = await endActiveQueueEntryOutcomes(entries, abortController);
  return outcomes.map(({ entry }) => entry);
}

function searchQueueEntries(
  criteria: Record<string, string>,
  startIndex = 0,
  abortController?: AbortController,
) {
  const searchParams = new URLSearchParams({
    ...criteria,
    limit: String(queueEntryPageSize),
    startIndex: String(startIndex),
    v: queueEntryRepresentation,
  });

  return openmrsFetch<QueueEntrySearchResponse>(`${restBaseUrl}/queue-entry?${searchParams.toString()}`, {
    signal: abortController?.signal,
    method: 'GET',
    headers: { 'Content-type': 'application/json' },
  });
}

async function getAllQueueEntries(
  criteria: Record<string, string>,
  abortController?: AbortController,
): Promise<FetchResponse<{ results: Array<ActiveQueueEntrySummary> }>> {
  const entriesByUuid = new Map<string, ActiveQueueEntrySummary>();
  let firstResponse: FetchResponse<QueueEntrySearchResponse> | null = null;

  for (let startIndex = 0; ; startIndex += queueEntryPageSize) {
    const response = await searchQueueEntries(criteria, startIndex, abortController);
    firstResponse ??= response;
    const page = response.data?.results ?? [];
    let newEntryCount = 0;

    for (const entry of page) {
      if (!entriesByUuid.has(entry.uuid)) {
        entriesByUuid.set(entry.uuid, entry);
        newEntryCount += 1;
      }
    }

    if (page.length < queueEntryPageSize) {
      break;
    }
    if (newEntryCount === 0) {
      throw Object.assign(new Error('Queue entry pagination did not advance.'), {
        code: ACTIVE_QUEUE_ENTRY_SEARCH_STALLED,
      });
    }
  }

  if (!firstResponse) {
    throw new Error('Queue entry search did not return a response.');
  }

  return {
    ...firstResponse,
    data: { ...firstResponse.data, results: [...entriesByUuid.values()] },
  } as FetchResponse<{ results: Array<ActiveQueueEntrySummary> }>;
}

/** Retrieves every active queue entry for appointment checkout. */
export function getActiveQueueEntriesForVisit(visitUuid: string, abortController?: AbortController) {
  return getAllQueueEntries({ visit: visitUuid, isEnded: 'false' }, abortController);
}

/** Retrieves active and historical queue timestamps used to close a visit safely. */
export function getQueueEntriesForVisit(visitUuid: string, abortController?: AbortController) {
  return getAllQueueEntries({ visit: visitUuid }, abortController);
}

/**
 * Drains the patient's active bucket rather than trusting one capped page. This
 * also catches visitless entries and entries whose visit was closed earlier.
 */
async function drainActiveQueueEntries(criteria: Record<string, string>): Promise<number> {
  let transitionedEntries = 0;
  const terminalEntriesSeenInSearch = new Set<string>();

  while (true) {
    const response = await searchQueueEntries({ ...criteria, isEnded: 'false' });
    const entries = Array.from(
      new Map(
        (response.data?.results ?? []).filter((entry) => !entry.endedAt).map((entry) => [entry.uuid, entry]),
      ).values(),
    );

    if (!entries.length) {
      return transitionedEntries;
    }

    const outcomes = await endActiveQueueEntryOutcomes(entries);
    let madeProgress = false;
    let observedNewTerminalEntry = false;

    outcomes.forEach(({ entry, transitioned }) => {
      if (transitioned) {
        transitionedEntries += 1;
        madeProgress = true;
      } else if (!terminalEntriesSeenInSearch.has(entry.uuid)) {
        terminalEntriesSeenInSearch.add(entry.uuid);
        observedNewTerminalEntry = true;
      }
    });

    if (!madeProgress && !observedNewTerminalEntry) {
      throw Object.assign(new Error('Active queue entry search did not advance.'), {
        code: ACTIVE_QUEUE_ENTRY_SEARCH_STALLED,
      });
    }
  }
}

export function drainActiveQueueEntriesForPatient(patientUuid: string) {
  return drainActiveQueueEntries({ patient: patientUuid });
}

/** Drains successors created concurrently while an appointment visit is closing. */
export function drainActiveQueueEntriesForVisit(visitUuid: string) {
  return drainActiveQueueEntries({ visit: visitUuid });
}
