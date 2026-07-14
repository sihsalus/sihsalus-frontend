import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

interface QueueEntrySummary {
  uuid: string;
  endedAt?: string | null;
  visit?: { uuid?: string };
}

interface QueueEntrySearchResponse {
  results?: Array<QueueEntrySummary>;
}

export const ACTIVE_QUEUE_ENTRY_CONFLICT = 'ACTIVE_QUEUE_ENTRY_CONFLICT';

export class ActiveQueueEntryConflictError extends Error {
  readonly code = ACTIVE_QUEUE_ENTRY_CONFLICT;

  constructor() {
    super('The patient already has an active entry in this queue for another visit.');
    this.name = 'ActiveQueueEntryConflictError';
  }
}

async function findActiveQueueEntry(params: Record<string, string>): Promise<QueueEntrySummary | undefined> {
  const searchParams = new URLSearchParams({
    ...params,
    isEnded: 'false',
    v: 'custom:(uuid,endedAt,visit:(uuid))',
  });
  const response = await openmrsFetch<QueueEntrySearchResponse>(
    `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
  );

  return response.data?.results?.find((entry) => !entry.endedAt);
}

export async function generateVisitQueueNumber(
  location: string,
  visitUuid: string,
  queueUuid: string,
  visitQueueNumberAttributeUuid: string,
) {
  const abortController = new AbortController();

  await openmrsFetch(
    `${restBaseUrl}/queue-entry-number?location=${location}&queue=${queueUuid}&visit=${visitUuid}&visitAttributeType=${visitQueueNumberAttributeUuid}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
    },
  );
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
) {
  const existingForVisit = await findActiveQueueEntry({ visit: visitUuid, queue: queueUuid });
  if (existingForVisit) {
    return { created: false, queueEntry: existingForVisit };
  }

  const existingForPatient = await findActiveQueueEntry({ patient: patientUuid, queue: queueUuid });
  if (existingForPatient) {
    throw new ActiveQueueEntryConflictError();
  }

  if (!visitQueueNumberAttributeUuid) {
    throw new Error('visitQueueNumberAttributeUuid is required to generate the queue ticket.');
  }

  const abortController = new AbortController();

  await generateVisitQueueNumber(locationUuid, visitUuid, queueUuid, visitQueueNumberAttributeUuid);

  try {
    const response = await openmrsFetch(`${restBaseUrl}/visit-queue-entry`, {
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
          startedAt: new Date(),
          sortWeight,
        },
      },
    });

    return { created: true, response };
  } catch (error) {
    try {
      const entryCreatedConcurrently = await findActiveQueueEntry({ visit: visitUuid, queue: queueUuid });
      if (entryCreatedConcurrently) {
        return { created: false, queueEntry: entryCreatedConcurrently };
      }
    } catch {
      // Preserve the original write failure if the reconciliation read also fails.
    }

    throw error;
  }
}
