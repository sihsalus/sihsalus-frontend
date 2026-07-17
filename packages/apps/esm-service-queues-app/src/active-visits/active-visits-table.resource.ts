import { formatDate, openmrsFetch, parseDate, restBaseUrl, type Visit } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import useSWR from 'swr';

import { transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { type Concept, type Identifer, type MappedServiceQueueEntry, type Queue, type QueueEntry } from '../types';

dayjs.extend(isToday);

export interface VisitQueueEntry {
  queueEntry: QueueEntry;
  uuid: string;
  visit: Visit;
}

export interface MappedVisitQueueEntry {
  id: string;
  encounters: Array<MappedEncounter>;
  name: string;
  patientAge: string;
  patientDob: string;
  patientUuid: string;
  queue: Queue;
  priority: Concept;
  priorityComment: string;
  status: Concept;
  startedAt: Date;
  endedAt: Date;
  visitType: string;
  visitUuid?: string;
  visitTypeUuid: string;
  queueUuid: string;
  queueEntryUuid: string;
  queueLocation: string;
  sortWeight: number;
  visitQueueNumber?: string;
  identifiers: Array<Identifer>;
  queueComingFrom: string;
}

interface ObsData {
  concept?: {
    display?: string;
    uuid?: string;
  };
  value?: unknown;
  groupMembers?: Array<{
    concept?: { uuid?: string; display?: string };
    value?: unknown;
  }>;
  obsDatetime?: string;
}

interface Encounter {
  diagnoses?: Array<unknown>;
  encounterDatetime?: string;
  encounterProviders?: Array<{
    provider?: {
      display?: string;
      person?: {
        display?: string;
      };
    };
  }>;
  encounterType?: { display?: string; uuid?: string };
  obs?: Array<ObsData>;
  uuid?: string;
  voided?: boolean;
}

interface MappedEncounter extends Omit<Encounter, 'encounterType' | 'provider'> {
  encounterType: string;
  provider: string;
}

const mapEncounterProperties = (encounter: Encounter): MappedEncounter => ({
  diagnoses: encounter.diagnoses ?? [],
  encounterDatetime: encounter.encounterDatetime ?? '',
  encounterType: encounter.encounterType?.display ?? '',
  obs: encounter.obs ?? [],
  provider:
    encounter.encounterProviders[0]?.provider?.person?.display ?? encounter.encounterProviders[0]?.provider?.display,
  uuid: encounter.uuid ?? '',
  voided: Boolean(encounter.voided),
});

export const mapVisitQueueEntryProperties = (
  queueEntry: QueueEntry,
  visitQueueNumberAttributeUuid: string,
): MappedVisitQueueEntry => ({
  id: queueEntry.uuid,
  encounters: queueEntry.visit?.encounters?.map(mapEncounterProperties) ?? [],
  name: queueEntry.display,
  patientUuid: queueEntry.patient.uuid,
  patientAge: queueEntry.patient.person?.age + '',
  patientDob: queueEntry?.patient?.person?.birthdate
    ? formatDate(parseDate(queueEntry.patient.person.birthdate), { time: false })
    : '--',
  queue: queueEntry.queue,
  priority: queueEntry.priority,
  priorityComment: queueEntry.priorityComment,
  status: queueEntry.status,
  startedAt: dayjs(queueEntry.startedAt).toDate(),
  endedAt: queueEntry.endedAt ? dayjs(queueEntry.endedAt).toDate() : null,
  visitType: queueEntry.visit?.visitType?.display ?? '--',
  queueLocation: queueEntry.queue?.location?.uuid,
  visitTypeUuid: queueEntry.visit?.visitType?.uuid,
  visitUuid: queueEntry.visit?.uuid,
  queueUuid: queueEntry.queue.uuid,
  queueEntryUuid: queueEntry.uuid,
  sortWeight: queueEntry.sortWeight,
  visitQueueNumber: queueEntry.visit?.attributes?.find((e) => e?.attributeType?.uuid === visitQueueNumberAttributeUuid)
    ?.value as string | undefined,
  identifiers: (queueEntry.patient?.identifiers as Identifer[]) ?? [],
  queueComingFrom: queueEntry?.queueComingFrom?.name ?? '--',
});

export async function updateQueueEntry(
  queueEntryUuid: string,
  newQueueUuid: string,
  priority: string,
  status: string,
  priorityComment?: string,
) {
  return transitionQueueEntry({
    queueEntryToTransition: queueEntryUuid,
    newQueue: newQueueUuid,
    newPriority: priority,
    newStatus: status,
    ...(priorityComment !== undefined ? { newPriorityComment: priorityComment } : {}),
  });
}

export function useServiceQueueEntries(service: string, locationUuid: string) {
  const apiUrl = `${restBaseUrl}/visit-queue-entry?status=waiting&service=${service}&location=${locationUuid}&v=full`;
  const { data, error, isLoading, isValidating } = useSWR<{ data: { results: Array<VisitQueueEntry> } }, Error>(
    service && locationUuid ? apiUrl : null,
    openmrsFetch,
  );

  const mapServiceQueueEntryProperties = (visitQueueEntry: VisitQueueEntry): MappedServiceQueueEntry => ({
    id: visitQueueEntry.queueEntry.uuid,
    name: visitQueueEntry.queueEntry.display,
    age: visitQueueEntry.queueEntry.patient ? visitQueueEntry?.queueEntry?.patient?.person?.age + '' : '--',
    returnDate: visitQueueEntry.queueEntry.startedAt,
    visitType: visitQueueEntry.visit?.visitType?.display,
    gender: visitQueueEntry.queueEntry.patient ? visitQueueEntry?.queueEntry?.patient?.person?.gender : '--',
    patientUuid: visitQueueEntry.queueEntry.patient?.uuid ?? '--',
  });

  const mappedServiceQueueEntries = data?.data?.results?.map(mapServiceQueueEntryProperties);

  return {
    serviceQueueEntries: mappedServiceQueueEntries ? mappedServiceQueueEntries : [],
    isLoading,
    error,
    isValidating,
  };
}

export function serveQueueEntry(servicePointName: string, ticketNumber: string, status: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/queueutil/assignticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      servicePointName,
      ticketNumber,
      status,
    },
  });
}
