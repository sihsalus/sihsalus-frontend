import {
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
  type Visit,
} from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

import { type ConfigObject } from '../config-schema';
import { fetchQueueEntry, transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { getLinkedAppointmentUuid, getTriageState } from '../triage-workflow/triage-workflow.resource';
import { type Appointment, type QueueEntry } from '../types';

export type ObstetricCareMode = 'outpatient' | 'inpatient';

export function getObstetricCareMode(
  queueEntry: QueueEntry,
  config: ConfigObject['obstetricCare'],
): ObstetricCareMode | null {
  if (
    !config?.enabled ||
    !config.outpatientAppointmentServiceUuid?.trim() ||
    !config.outpatientQueueUuid?.trim() ||
    !config.inpatientQueueUuid?.trim() ||
    config.outpatientQueueUuid === config.inpatientQueueUuid
  ) {
    return null;
  }
  if (queueEntry.queue?.uuid === config.inpatientQueueUuid) {
    return 'inpatient';
  }
  return queueEntry.queue?.uuid === config.outpatientQueueUuid &&
    queueEntry.workflow?.appointmentServiceUuid === config.outpatientAppointmentServiceUuid
    ? 'outpatient'
    : null;
}

let freshReadSequence = 0;

/** Confirms the persisted care context before changing queue state or opening the patient chart. */
export async function startObstetricCare(
  queueEntry: QueueEntry,
  mode: ObstetricCareMode,
  config: ConfigObject,
): Promise<QueueEntry> {
  const inServiceStatus = config.concepts?.defaultTransitionStatus;
  const allowedStatuses = [
    config.concepts?.defaultStatusConceptUuid,
    config.concepts?.finishedServiceStatusConceptUuid,
    inServiceStatus,
  ];
  if (
    getObstetricCareMode(queueEntry, config.obstetricCare) !== mode ||
    allowedStatuses.some((status) => !status?.trim()) ||
    new Set(allowedStatuses).size !== allowedStatuses.length
  ) {
    throw new Error('The obstetric queue configuration could not be verified.');
  }

  const { data: freshEntry } = await fetchQueueEntry(queueEntry.uuid);
  const patientUuid = queueEntry.patient?.uuid;
  const visitUuid = queueEntry.visit?.uuid;
  if (
    !patientUuid ||
    !visitUuid ||
    freshEntry?.uuid !== queueEntry.uuid ||
    freshEntry.patient?.uuid !== patientUuid ||
    freshEntry.visit?.uuid !== visitUuid ||
    freshEntry.queue?.uuid !== queueEntry.queue?.uuid ||
    !freshEntry.priority?.uuid ||
    !allowedStatuses.includes(freshEntry.status?.uuid) ||
    (freshEntry.endedAt && freshEntry.status?.uuid === inServiceStatus) ||
    (Array.isArray(freshEntry.queue.allowedStatuses) &&
      !freshEntry.queue.allowedStatuses.some((status) => status.uuid === inServiceStatus))
  ) {
    throw new Error('The obstetric queue entry changed or does not allow this status.');
  }

  const freshReadNonce = `${Date.now()}-${++freshReadSequence}`;
  const freshReadOptions = {
    cache: 'no-store' as const,
    headers: {
      'Cache-Control': 'no-store',
      [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
    },
  };
  const { data: visit } = await openmrsFetch<Visit>(
    `${restBaseUrl}/visit/${encodeURIComponent(visitUuid)}?v=full&_=${freshReadNonce}`,
    freshReadOptions,
  );
  if (
    visit?.uuid !== visitUuid ||
    visit.patient?.uuid !== patientUuid ||
    visit.stopDatetime !== null ||
    visit.voided ||
    visit.auditInfo?.voided
  ) {
    throw new Error('The active obstetric visit could not be verified.');
  }

  // The patient chart selects the patient's active visit on mount. Refuse an
  // ambiguous context so the dashboard cannot record care against another visit.
  const activeVisitParams = new URLSearchParams({
    patient: patientUuid,
    includeInactive: 'false',
    limit: '2',
    v: 'custom:(uuid,patient:(uuid),stopDatetime)',
    _: freshReadNonce,
  });
  const { data: activeVisits } = await openmrsFetch<{
    results?: Array<Pick<Visit, 'uuid' | 'patient' | 'stopDatetime'>>;
    links?: Array<{ rel?: string }>;
  }>(`${restBaseUrl}/visit?${activeVisitParams.toString()}`, freshReadOptions);
  if (
    activeVisits?.results?.length !== 1 ||
    activeVisits.links?.some((link) => link.rel === 'next') ||
    activeVisits.results[0].uuid !== visitUuid ||
    activeVisits.results[0].patient?.uuid !== patientUuid ||
    activeVisits.results[0].stopDatetime !== null
  ) {
    throw new Error('A unique active obstetric visit could not be verified.');
  }

  if (mode === 'outpatient') {
    const triageConfig = config.appointmentTriage;
    const attributes = visit.attributes?.filter(
      (attribute) =>
        !attribute.voided && attribute.attributeType?.uuid === triageConfig?.appointmentVisitAttributeTypeUuid,
    );
    const entryWithVisit = { ...freshEntry, visit: { ...visit, attributes } };
    const appointmentUuid = getLinkedAppointmentUuid(entryWithVisit, triageConfig);
    if (
      attributes?.length !== 1 ||
      !appointmentUuid ||
      !triageConfig?.triageRouting?.enabled ||
      !triageConfig.triageRouting.encounterTypeUuid?.trim()
    ) {
      throw new Error('The linked obstetric appointment and triage could not be verified.');
    }
    const { data: appointment } = await openmrsFetch<Pick<Appointment, 'uuid' | 'patient' | 'service' | 'location'>>(
      `${restBaseUrl}/appointments/${encodeURIComponent(appointmentUuid)}?_=${freshReadNonce}`,
      freshReadOptions,
    );
    const matchingRoutes = triageConfig.appointmentArrivalRules?.filter(
      (rule) =>
        rule.appointmentServiceUuid === appointment?.service?.uuid &&
        rule.appointmentLocationUuid === appointment?.location?.uuid,
    );
    if (
      appointment?.uuid !== appointmentUuid ||
      appointment.patient?.uuid !== patientUuid ||
      appointment.service?.uuid !== config.obstetricCare.outpatientAppointmentServiceUuid ||
      !visit.location?.uuid ||
      appointment.location?.uuid !== visit.location.uuid ||
      matchingRoutes?.length !== 1 ||
      matchingRoutes[0].queueUuid !== freshEntry.queue.uuid ||
      getTriageState(entryWithVisit, triageConfig, appointment) !== 'completed'
    ) {
      throw new Error('The obstetric appointment route or saved triage could not be verified.');
    }
  }

  if (!freshEntry.endedAt && freshEntry.status.uuid === inServiceStatus) {
    await assertFreshPatientIsAlive(patientUuid);
    return { ...freshEntry, visit };
  }

  // A retry may refer to the closed source row. The existing transition resource
  // reconciles its direct successor instead of creating another queue entry.
  const { data: attendingEntry } = await transitionQueueEntry({
    queueEntryToTransition: freshEntry.uuid,
    newQueue: freshEntry.queue.uuid,
    newStatus: inServiceStatus,
  });
  if (
    !attendingEntry?.uuid ||
    attendingEntry.endedAt ||
    attendingEntry.patient?.uuid !== patientUuid ||
    attendingEntry.visit?.uuid !== visitUuid ||
    attendingEntry.queue?.uuid !== freshEntry.queue.uuid ||
    attendingEntry.status?.uuid !== inServiceStatus
  ) {
    throw new Error('The active obstetric queue transition could not be verified.');
  }
  return { ...attendingEntry, visit };
}
