import { type FetchResponse, type Location, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { queueEntryCustomRepresentation } from '../constants';
import { type Concept, type Provider, type QueueEntry } from '../types';

// see QueueEntryTransition.java in openmrs-module-queue
export interface TransitionQueueEntryParams {
  queueEntryToTransition: string;
  newQueue?: string;
  newStatus?: string;
  newPriority?: string;
  newPriorityComment?: string;
}

export interface QueueEntryTransitionSelection {
  selectedQueue: string;
  selectedStatus: string;
  selectedPriority: string;
  priorityComment: string;
}

export function isQueueEntryTransitionUnchanged(
  queueEntry: QueueEntry,
  selection: QueueEntryTransitionSelection,
): boolean {
  return (
    selection.selectedQueue === queueEntry.queue.uuid &&
    selection.selectedStatus === queueEntry.status.uuid &&
    selection.selectedPriority === queueEntry.priority.uuid &&
    selection.priorityComment === (queueEntry.priorityComment ?? '')
  );
}

interface QueueEntrySearchResponse {
  results?: Array<QueueEntry>;
}

const transitionReconciliationRepresentation =
  'custom:(uuid,endedAt,startedAt,queue:(uuid),status:(uuid),priority:(uuid),priorityComment,visit:(uuid),queueComingFrom:(uuid))';

export const QUEUE_ENTRY_TRANSITION_CONFLICT = 'QUEUE_ENTRY_TRANSITION_CONFLICT';

export class QueueEntryTransitionConflictError extends Error {
  readonly code = QUEUE_ENTRY_TRANSITION_CONFLICT;

  constructor() {
    super('The queue entry was transitioned by another user.');
    this.name = 'QueueEntryTransitionConflictError';
  }
}

class QueueEntryAlreadyEndedError extends Error {
  constructor() {
    super('Cannot transition a queue entry that has already ended');
    this.name = 'QueueEntryAlreadyEndedError';
  }
}

class QueueEntryVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueEntryVerificationError';
  }
}

export function fetchQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry>> {
  const representation = encodeURIComponent(queueEntryCustomRepresentation);
  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}?v=${representation}`, {
    signal: abortController?.signal,
  });
}

function queueEntryMatchesTransition(
  candidate: QueueEntry,
  source: QueueEntry,
  params: TransitionQueueEntryParams,
): boolean {
  const sourceEndedAt = source.endedAt ? new Date(source.endedAt).valueOf() : Number.NaN;
  const candidateStartedAt = candidate.startedAt ? new Date(candidate.startedAt).valueOf() : Number.NaN;
  const expectedPriorityComment = params.newPriorityComment ?? source.priorityComment ?? '';

  return (
    candidate.uuid !== source.uuid &&
    candidate.visit?.uuid === source.visit?.uuid &&
    candidate.queueComingFrom?.uuid === source.queue?.uuid &&
    candidateStartedAt === sourceEndedAt &&
    candidate.queue?.uuid === (params.newQueue ?? source.queue?.uuid) &&
    candidate.status?.uuid === (params.newStatus ?? source.status?.uuid) &&
    candidate.priority?.uuid === (params.newPriority ?? source.priority?.uuid) &&
    (candidate.priorityComment ?? '') === expectedPriorityComment
  );
}

function isPossibleDirectTransitionSuccessor(candidate: QueueEntry, source: QueueEntry): boolean {
  const sourceStartedAt = source.startedAt ? new Date(source.startedAt).valueOf() : Number.NaN;
  const sourceEndedAt = source.endedAt ? new Date(source.endedAt).valueOf() : Number.NaN;
  const candidateStartedAt = candidate.startedAt ? new Date(candidate.startedAt).valueOf() : Number.NaN;

  return (
    candidate.uuid !== source.uuid &&
    candidate.visit?.uuid === source.visit?.uuid &&
    candidate.queueComingFrom?.uuid === source.queue?.uuid &&
    Number.isFinite(sourceEndedAt) &&
    Number.isFinite(candidateStartedAt) &&
    candidateStartedAt <= sourceEndedAt &&
    (!Number.isFinite(sourceStartedAt) || candidateStartedAt >= sourceStartedAt)
  );
}

async function findDirectTransitionSuccessor(
  source: QueueEntry,
  abortController?: AbortController,
): Promise<QueueEntry | null> {
  if (!source.endedAt || !source.visit?.uuid || !source.queue?.uuid) {
    return null;
  }

  const pageSize = 100;
  let startIndex = 0;
  const seenEntries = new Set<string>();

  while (true) {
    const searchParams = new URLSearchParams({
      visit: source.visit.uuid,
      queueComingFrom: source.queue.uuid,
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: transitionReconciliationRepresentation,
    });
    const response = await openmrsFetch<QueueEntrySearchResponse>(
      `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
      { signal: abortController?.signal },
    );
    const page = response.data?.results ?? [];
    const successor = page.find((candidate) => isPossibleDirectTransitionSuccessor(candidate, source));

    if (successor) {
      return successor;
    }

    const newEntries = page.filter((entry) => !seenEntries.has(entry.uuid));
    newEntries.forEach((entry) => {
      seenEntries.add(entry.uuid);
    });
    if (page.length < pageSize || newEntries.length === 0) {
      return null;
    }
    startIndex += page.length;
  }
}

async function assertQueueEntryWasNotTransitioned(
  source: QueueEntry,
  abortController?: AbortController,
): Promise<void> {
  if (await findDirectTransitionSuccessor(source, abortController)) {
    throw new QueueEntryTransitionConflictError();
  }
}

async function verifyQueueEntryClosedWithoutTransition(
  response: FetchResponse<QueueEntry>,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry>> {
  if (!response.data.endedAt) {
    throw new QueueEntryVerificationError('The queue entry close could not be verified.');
  }
  await assertQueueEntryWasNotTransitioned(response.data, abortController);
  return response;
}

async function reconcileTransition(
  source: QueueEntry,
  params: TransitionQueueEntryParams,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry> | null> {
  if (!source.endedAt || !source.visit?.uuid || !source.queue?.uuid) {
    return null;
  }

  const pageSize = 100;
  let startIndex = 0;
  const seenEntries = new Set<string>();

  while (true) {
    const searchParams = new URLSearchParams({
      visit: source.visit.uuid,
      queueComingFrom: source.queue.uuid,
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: transitionReconciliationRepresentation,
    });
    const response = await openmrsFetch<QueueEntrySearchResponse>(
      `${restBaseUrl}/queue-entry?${searchParams.toString()}`,
      { signal: abortController?.signal },
    );
    const page = response.data?.results ?? [];
    const matchingEntry = page.find((candidate) => queueEntryMatchesTransition(candidate, source, params));

    if (matchingEntry) {
      return { ...response, data: matchingEntry } as FetchResponse<QueueEntry>;
    }

    const newEntries = page.filter((entry) => !seenEntries.has(entry.uuid));
    newEntries.forEach((entry) => {
      seenEntries.add(entry.uuid);
    });
    if (page.length < pageSize || newEntries.length === 0) {
      return null;
    }
    startIndex += page.length;
  }
}

/**
 * A transition is defined as an action that ends a current queue entry and immediately starts a new one
 * with (slightly) different values. For now, this could be used to transition the queue entry's status,
 * priority or queue. This allows us to keep a history of queue entries through a patient's visit.
 * Note that there are some use cases (like RDE or data correction) where a transition is NOT appropriate.
 * @param params
 * @param abortController
 * @returns
 */
export async function transitionQueueEntry(
  params: TransitionQueueEntryParams,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry>> {
  const freshResponse = await fetchQueueEntry(params.queueEntryToTransition, abortController);
  const freshEntry = freshResponse.data;

  if (freshEntry.endedAt) {
    const reconciledResponse = await reconcileTransition(freshEntry, params, abortController);
    if (reconciledResponse) {
      return reconciledResponse;
    }
    throw new QueueEntryAlreadyEndedError();
  }

  try {
    return await openmrsFetch(`${restBaseUrl}/queue-entry/transition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController?.signal,
      body: params,
    });
  } catch (error) {
    try {
      const latestResponse = await fetchQueueEntry(params.queueEntryToTransition, abortController);
      const reconciledResponse = await reconcileTransition(latestResponse.data, params, abortController);
      if (reconciledResponse) {
        return reconciledResponse;
      }
    } catch {
      // Preserve the original write failure when reconciliation is unavailable.
    }
    throw error;
  }
}

function getAuthoritativeEndDate(response: FetchResponse<QueueEntry>): Date {
  const headerValue = response.headers?.get?.('Date');
  const headerDate = headerValue ? new Date(headerValue) : null;
  const serverDate = headerDate && !Number.isNaN(headerDate.valueOf()) ? headerDate : new Date();
  const startedAt = response.data?.startedAt ? new Date(response.data.startedAt) : null;

  if (startedAt && !Number.isNaN(startedAt.valueOf()) && serverDate < startedAt) {
    return startedAt;
  }
  return serverDate;
}

/** End an active entry without replacing an existing historical endedAt value. */
export async function endQueueEntry(
  queueEntryUuid: string,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry>> {
  const freshResponse = await fetchQueueEntry(queueEntryUuid, abortController);
  if (freshResponse.data.endedAt) {
    return verifyQueueEntryClosedWithoutTransition(freshResponse, abortController);
  }

  const endedAt = getAuthoritativeEndDate(freshResponse).toISOString();
  try {
    await openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController?.signal,
      body: { endedAt },
    });
  } catch (error) {
    try {
      const latestResponse = await fetchQueueEntry(queueEntryUuid, abortController);
      if (latestResponse.data.endedAt) {
        return await verifyQueueEntryClosedWithoutTransition(latestResponse, abortController);
      }
    } catch (reconciliationError) {
      if (reconciliationError instanceof QueueEntryTransitionConflictError) {
        throw reconciliationError;
      }
      // Preserve the original write failure when reconciliation is unavailable.
    }
    throw error;
  }

  const latestResponse = await fetchQueueEntry(queueEntryUuid, abortController);
  return verifyQueueEntryClosedWithoutTransition(latestResponse, abortController);
}

export interface BatchEndQueueEntriesResult {
  total: number;
  cleared: number;
  alreadyEnded: number;
  failed: number;
}

/** Re-reads the selected entries and attempts every active close, even after individual failures. */
export async function batchEndQueueEntries(
  queueEntries: Array<Pick<QueueEntry, 'uuid'>>,
): Promise<BatchEndQueueEntriesResult> {
  const uniqueEntries = Array.from(new Map(queueEntries.map((entry) => [entry.uuid, entry])).values());
  const freshResults = await Promise.allSettled(uniqueEntries.map((entry) => fetchQueueEntry(entry.uuid)));
  const activeEntries: Array<QueueEntry> = [];
  const endedResponses: Array<FetchResponse<QueueEntry>> = [];
  let alreadyEnded = 0;
  let failed = 0;

  freshResults.forEach((result) => {
    if (result.status === 'rejected') {
      failed += 1;
    } else if (result.value.data.endedAt) {
      endedResponses.push(result.value);
    } else {
      activeEntries.push(result.value.data);
    }
  });

  const endedVerificationResults = await Promise.allSettled(
    endedResponses.map((response) => verifyQueueEntryClosedWithoutTransition(response)),
  );
  alreadyEnded = endedVerificationResults.filter((result) => result.status === 'fulfilled').length;
  failed += endedVerificationResults.length - alreadyEnded;

  const endResults = await Promise.allSettled(activeEntries.map((entry) => endQueueEntry(entry.uuid)));
  const cleared = endResults.filter((result) => result.status === 'fulfilled').length;
  failed += endResults.length - cleared;

  return {
    total: uniqueEntries.length,
    cleared,
    alreadyEnded,
    failed,
  };
}

// see QueueEntryResource.java#getUpdatableProperties() in openmrs-module-queue
export interface UpdateQueueEntryParams {
  status?: Concept;
  priority?: Concept;
  priorityComment?: string;
  sortWeight?: number;
  startedAt?: string;
  endedAt?: string;
  locationWaitingFor?: Location;
  providerWaitingFor?: Provider;
}

function queueEntryMatchesUpdate(queueEntry: QueueEntry, params: UpdateQueueEntryParams): boolean {
  return (
    (params.status === undefined || queueEntry.status?.uuid === params.status.uuid) &&
    (params.priority === undefined || queueEntry.priority?.uuid === params.priority.uuid) &&
    (params.priorityComment === undefined || (queueEntry.priorityComment ?? '') === params.priorityComment) &&
    (params.sortWeight === undefined || queueEntry.sortWeight === params.sortWeight) &&
    (params.startedAt === undefined ||
      new Date(queueEntry.startedAt).valueOf() === new Date(params.startedAt).valueOf()) &&
    (params.endedAt === undefined || new Date(queueEntry.endedAt).valueOf() === new Date(params.endedAt).valueOf()) &&
    (params.locationWaitingFor === undefined ||
      queueEntry.locationWaitingFor?.uuid === params.locationWaitingFor.uuid) &&
    (params.providerWaitingFor === undefined || queueEntry.providerWaitingFor?.uuid === params.providerWaitingFor.uuid)
  );
}

/** Updates mutable metadata only while the entry is active, with response-loss reconciliation. */
export async function updateActiveQueueEntry(
  queueEntryUuid: string,
  params: UpdateQueueEntryParams,
  abortController?: AbortController,
): Promise<FetchResponse<QueueEntry>> {
  const freshResponse = await fetchQueueEntry(queueEntryUuid, abortController);
  if (freshResponse.data.endedAt) {
    if (await findDirectTransitionSuccessor(freshResponse.data, abortController)) {
      throw new QueueEntryTransitionConflictError();
    }
    throw new QueueEntryAlreadyEndedError();
  }

  try {
    await updateQueueEntry(queueEntryUuid, params, abortController);
  } catch (error) {
    try {
      const latestResponse = await fetchQueueEntry(queueEntryUuid, abortController);
      if (latestResponse.data.endedAt) {
        if (await findDirectTransitionSuccessor(latestResponse.data, abortController)) {
          throw new QueueEntryTransitionConflictError();
        }
        throw new QueueEntryAlreadyEndedError();
      }
      if (queueEntryMatchesUpdate(latestResponse.data, params)) {
        return latestResponse;
      }
    } catch (reconciliationError) {
      if (
        reconciliationError instanceof QueueEntryTransitionConflictError ||
        reconciliationError instanceof QueueEntryAlreadyEndedError
      ) {
        throw reconciliationError;
      }
      // Preserve the original write failure when reconciliation is unavailable.
    }
    throw error;
  }

  const latestResponse = await fetchQueueEntry(queueEntryUuid, abortController);
  if (latestResponse.data.endedAt) {
    if (await findDirectTransitionSuccessor(latestResponse.data, abortController)) {
      throw new QueueEntryTransitionConflictError();
    }
    throw new QueueEntryAlreadyEndedError();
  }
  if (!queueEntryMatchesUpdate(latestResponse.data, params)) {
    throw new QueueEntryVerificationError('The queue entry update could not be verified.');
  }
  return latestResponse;
}

export function updateQueueEntry(
  queueEntryUuid: string,
  params: UpdateQueueEntryParams,
  abortController?: AbortController,
) {
  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController?.signal,
    body: params,
  });
}
interface UndoTransitionParams {
  queueEntry: string;
}

export function undoTransition(params: UndoTransitionParams, abortController?: AbortController) {
  return openmrsFetch(`${restBaseUrl}/queue-entry/transition`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController?.signal,
    body: params,
  });
}

export function voidQueueEntry(queueEntryUuid: string, abortController?: AbortController) {
  return openmrsFetch(`${restBaseUrl}/queue-entry/${queueEntryUuid}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController?.signal,
  });
}
