import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface VisitAttributeSummary {
  value?: unknown;
  attributeType?: { uuid?: string };
}

interface VisitQueueTicketSummary {
  uuid: string;
  startDatetime?: string;
  attributes?: Array<VisitAttributeSummary>;
}

interface QueueEntrySummary {
  uuid: string;
  endedAt?: string | null;
  queue?: {
    uuid?: string;
    display?: string;
  };
  visit?: {
    uuid?: string;
    attributes?: Array<VisitAttributeSummary>;
  };
}

interface QueueEntrySearchResponse {
  results?: Array<QueueEntrySummary>;
}

export const ACTIVE_QUEUE_ENTRY_CONFLICT = 'ACTIVE_QUEUE_ENTRY_CONFLICT';
export const ACTIVE_VISIT_QUEUE_CONFLICT = 'ACTIVE_VISIT_QUEUE_CONFLICT';
export const MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES = 'MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES';
export const QUEUE_TICKET_GENERATION_FAILED = 'QUEUE_TICKET_GENERATION_FAILED';
export const QUEUE_ENTRY_CREATION_UNVERIFIED = 'QUEUE_ENTRY_CREATION_UNVERIFIED';

export class ActiveQueueEntryConflictError extends Error {
  readonly code = ACTIVE_QUEUE_ENTRY_CONFLICT;

  constructor() {
    super('The patient already has an active entry in this queue for another visit.');
    this.name = 'ActiveQueueEntryConflictError';
  }
}

export class ActiveVisitQueueConflictError extends Error {
  readonly code = ACTIVE_VISIT_QUEUE_CONFLICT;

  constructor(readonly activeQueueDisplay?: string) {
    super('The visit already has an active entry in another queue.');
    this.name = 'ActiveVisitQueueConflictError';
  }
}

export class QueueTicketGenerationError extends Error {
  readonly code = QUEUE_TICKET_GENERATION_FAILED;

  constructor() {
    super('The queue module did not generate a visit queue number.');
    this.name = 'QueueTicketGenerationError';
  }
}

export class MultipleActiveVisitQueueEntriesError extends Error {
  readonly code = MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES;

  constructor() {
    super('The visit has more than one active queue entry.');
    this.name = 'MultipleActiveVisitQueueEntriesError';
  }
}

export class QueueEntryCreationVerificationError extends Error {
  readonly code = QUEUE_ENTRY_CREATION_UNVERIFIED;

  constructor() {
    super('The new active queue entry could not be verified.');
    this.name = 'QueueEntryCreationVerificationError';
  }
}

interface QueueTicketResponse {
  visitQueueNumber?: unknown;
  queueNumber?: unknown;
  ticketNumber?: unknown;
}

async function findActiveQueueEntries(params: Record<string, string>): Promise<Array<QueueEntrySummary>> {
  const searchParams = new URLSearchParams({
    ...params,
    isEnded: 'false',
    v: 'custom:(uuid,endedAt,queue:(uuid,display),visit:(uuid,attributes:(value,attributeType:(uuid))))',
  });
  const response = await openmrsFetch<QueueEntrySearchResponse>(
    `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
  );

  return response.data?.results?.filter((entry) => !entry.endedAt) ?? [];
}

function getVisitQueueNumber(
  attributes: Array<VisitAttributeSummary> | undefined,
  visitQueueNumberAttributeUuid: string,
): string | null {
  const value = attributes?.find((attribute) => attribute.attributeType?.uuid === visitQueueNumberAttributeUuid)?.value;
  const queueNumber = value === null || value === undefined ? '' : String(value).trim();
  return queueNumber || null;
}

function getAuthoritativeStartedAt(
  serverDateHeader: string | null | undefined,
  visitStartDatetime?: string | Date,
): Date {
  const serverDate = serverDateHeader ? new Date(serverDateHeader) : null;
  const visitStart = visitStartDatetime ? new Date(visitStartDatetime) : null;
  const requestTime = serverDate && !Number.isNaN(serverDate.valueOf()) ? serverDate : new Date();

  return visitStart && !Number.isNaN(visitStart.valueOf()) && visitStart > requestTime ? visitStart : requestTime;
}

async function getPersistedVisitQueueTicket(
  visitUuid: string,
  visitQueueNumberAttributeUuid: string,
  visitStartDatetime?: string | Date,
): Promise<{ queueNumber: string | null; startedAt: Date }> {
  const representation = encodeURIComponent('custom:(uuid,startDatetime,attributes:(value,attributeType:(uuid)))');
  const response = await openmrsFetch<VisitQueueTicketSummary>(`${restBaseUrl}/visit/${visitUuid}?v=${representation}`);

  return {
    queueNumber: getVisitQueueNumber(response.data?.attributes, visitQueueNumberAttributeUuid),
    startedAt: getAuthoritativeStartedAt(
      response.headers?.get?.('Date'),
      visitStartDatetime ?? response.data?.startDatetime,
    ),
  };
}

export async function generateVisitQueueNumber(
  location: string,
  visitUuid: string,
  queueUuid: string,
  visitQueueNumberAttributeUuid: string,
  visitStartDatetime?: string | Date,
) {
  const abortController = new AbortController();
  const url = `${restBaseUrl}/queue-entry-number?${new URLSearchParams({
    location,
    queue: queueUuid,
    visit: visitUuid,
    visitAttributeType: visitQueueNumberAttributeUuid,
  })}`;

  let response: FetchResponse<QueueTicketResponse>;
  let usedLegacyMethod = false;

  try {
    response = await openmrsFetch<QueueTicketResponse>(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
    });
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== 404 && status !== 405) {
      throw error;
    }

    // Some queue-module versions expose this endpoint as POST.
    usedLegacyMethod = true;
    response = await openmrsFetch<QueueTicketResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
    });
  }

  let queueNumber = getQueueNumberFromResponse(response);
  if (queueNumber) {
    return {
      queueNumber,
      startedAt: getAuthoritativeStartedAt(response.headers?.get?.('Date'), visitStartDatetime),
    };
  }

  // Some queue-module versions return an empty GET response while still generating
  // the number as a side effect. Try the alternate method before reading the visit.
  if (!usedLegacyMethod) {
    try {
      const legacyResponse = await openmrsFetch<QueueTicketResponse>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      });
      queueNumber = getQueueNumberFromResponse(legacyResponse);
      if (queueNumber) {
        return {
          queueNumber,
          startedAt: getAuthoritativeStartedAt(legacyResponse.headers?.get?.('Date'), visitStartDatetime),
        };
      }
    } catch (error) {
      const status = getErrorStatus(error);
      if (status !== 404 && status !== 405) {
        throw error;
      }
    }
  }

  // Some queue-module versions persist the attribute but return an empty body.
  const persistedTicket = await getPersistedVisitQueueTicket(
    visitUuid,
    visitQueueNumberAttributeUuid,
    visitStartDatetime,
  );
  if (persistedTicket.queueNumber) {
    return persistedTicket;
  }

  // The queue module may generate the number during this request without returning
  // it. The following visit-queue-entry request is still required to complete the flow.
  return persistedTicket;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { status?: unknown; response?: { status?: unknown } };
  const status = candidate.status ?? candidate.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function getQueueNumberFromResponse(response: FetchResponse<QueueTicketResponse>): string | null {
  const value = [response.data?.visitQueueNumber, response.data?.queueNumber, response.data?.ticketNumber].find(
    (candidate) => candidate !== null && candidate !== undefined && String(candidate).trim(),
  );

  return value ? String(value).trim() : null;
}

export async function postQueueEntry(
  visitUuid: string,
  queueUuid: string,
  patientUuid: string,
  priority: string,
  status: string,
  sortWeight: number,
  locationUuid: string,
  visitQueueNumberAttributeUuid: string | null,
  visitStartDatetime?: string | Date,
) {
  if (!visitQueueNumberAttributeUuid) {
    throw new Error('visitQueueNumberAttributeUuid is required to generate the queue ticket.');
  }

  const existingEntriesForVisit = await findActiveQueueEntries({ visit: visitUuid });
  if (existingEntriesForVisit.length > 1) {
    throw new MultipleActiveVisitQueueEntriesError();
  }
  const existingForVisit = existingEntriesForVisit[0];
  if (existingForVisit) {
    if (existingForVisit.queue?.uuid !== queueUuid) {
      throw new ActiveVisitQueueConflictError(existingForVisit.queue?.display);
    }

    const hasQueueNumber = existingForVisit.visit?.attributes?.some(
      (attribute) =>
        attribute.attributeType?.uuid === visitQueueNumberAttributeUuid &&
        attribute.value !== null &&
        attribute.value !== undefined &&
        String(attribute.value).trim().length > 0,
    );
    if (!hasQueueNumber) {
      await generateVisitQueueNumber(
        locationUuid,
        visitUuid,
        queueUuid,
        visitQueueNumberAttributeUuid,
        visitStartDatetime,
      );
    }
    return { created: false, queueEntry: existingForVisit };
  }

  const [existingForPatient] = await findActiveQueueEntries({ patient: patientUuid, queue: queueUuid });
  if (existingForPatient) {
    throw new ActiveQueueEntryConflictError();
  }

  const abortController = new AbortController();

  const persistedTicket = await getPersistedVisitQueueTicket(
    visitUuid,
    visitQueueNumberAttributeUuid,
    visitStartDatetime,
  );
  const { startedAt } = persistedTicket.queueNumber
    ? { startedAt: persistedTicket.startedAt }
    : await generateVisitQueueNumber(
        locationUuid,
        visitUuid,
        queueUuid,
        visitQueueNumberAttributeUuid,
        visitStartDatetime,
      );

  let response: FetchResponse<{ uuid?: string }>;
  try {
    response = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/visit-queue-entry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: {
        visit: { uuid: visitUuid },
        queueEntry: {
          status: { uuid: status },
          priority: { uuid: priority },
          queue: { uuid: queueUuid },
          patient: { uuid: patientUuid },
          startedAt,
          sortWeight,
        },
      },
    });
  } catch (error) {
    try {
      const entriesCreatedConcurrently = await findActiveQueueEntries({ visit: visitUuid });
      if (entriesCreatedConcurrently.length > 1) {
        throw new MultipleActiveVisitQueueEntriesError();
      }
      const entryCreatedConcurrently = entriesCreatedConcurrently[0];
      if (entryCreatedConcurrently?.queue?.uuid === queueUuid) {
        return { created: false, queueEntry: entryCreatedConcurrently };
      }
    } catch (reconciliationError) {
      if (reconciliationError instanceof MultipleActiveVisitQueueEntriesError) {
        throw reconciliationError;
      }
      // Preserve the original write failure if the reconciliation read also fails.
    }

    throw error;
  }

  const activeEntriesAfterCreate = await findActiveQueueEntries({ visit: visitUuid });
  if (activeEntriesAfterCreate.length > 1) {
    throw new MultipleActiveVisitQueueEntriesError();
  }
  if (activeEntriesAfterCreate.length !== 1 || activeEntriesAfterCreate[0].queue?.uuid !== queueUuid) {
    throw new QueueEntryCreationVerificationError();
  }

  return { created: true, response };
}
