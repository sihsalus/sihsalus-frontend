import { getConfig, openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';
import {
  copyFinanciadorToVisit,
  fetchPersonInsurance,
  fetchVisitInsurance,
  FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID,
  getSisFinancingState,
  INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID,
  SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID,
  getCodedValueUuid,
  getTextValue,
  type PersonInsurance,
} from '@openmrs/esm-patient-common-lib';
import { useEffect } from 'react';
import useSWR from 'swr';

import { transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { type QueueEntry } from '../types';

const appointmentsModuleName = '@sihsalus/esm-appointments-app';
const serviceQueuesModuleName = '@sihsalus/esm-service-queues-app';

type AttributeValue = string | { uuid?: string; display?: string } | null | undefined;

interface AppointmentRoutingRule {
  appointmentLocationUuid: string;
  appointmentServiceUuid: string;
  queueLocationUuid?: string;
  queueUuid?: string;
  requiresTriage?: boolean;
}

export interface AppointmentTriageConfig {
  appointmentArrivalRules: Array<AppointmentRoutingRule>;
  appointmentVisitAttributeTypeUuid: string;
  triageRouting: {
    enabled: boolean;
    encounterTypeUuid: string;
    queueLocationUuid: string;
    queueUuid: string;
  };
}

interface ServiceQueuesRoutingConfig {
  concepts: {
    defaultStatusConceptUuid: string;
  };
}

interface AppointmentSummary {
  uuid: string;
  startDateTime?: string;
  location?: { uuid?: string; name?: string };
  service?: { uuid?: string; name?: string };
}

export type TriageState = 'pending' | 'completed' | 'notRequired';
export type SisState = 'active' | 'inactive' | 'pending' | 'notConsulted' | 'missing' | 'notApplicable';

export interface QueueWorkflowMetadata {
  appointmentStartDateTime?: string;
  appointmentUuid?: string;
  destinationQueueUuid?: string;
  isTriageQueue: boolean;
  sisState: SisState;
  triageState: TriageState;
}

function getAttributeValue(queueEntry: QueueEntry, attributeTypeUuid: string): AttributeValue {
  const attributes = (queueEntry.visit?.attributes ?? []) as Array<{
    attributeType?: { uuid?: string };
    value?: AttributeValue;
  }>;
  return attributes.find((attribute) => attribute.attributeType?.uuid === attributeTypeUuid)?.value;
}

export function getLinkedAppointmentUuid(queueEntry: QueueEntry, config?: AppointmentTriageConfig): string | null {
  if (!config?.appointmentVisitAttributeTypeUuid) {
    return null;
  }
  return getCodedValueUuid(getAttributeValue(queueEntry, config.appointmentVisitAttributeTypeUuid));
}

export function getSisState(queueEntry: QueueEntry): SisState {
  const funderUuid = getCodedValueUuid(getAttributeValue(queueEntry, FINANCIADOR_VISIT_ATTRIBUTE_TYPE_UUID));
  const insuranceNumber = getTextValue(getAttributeValue(queueEntry, INSURANCE_NUMBER_VISIT_ATTRIBUTE_TYPE_UUID));
  const statusUuid = getCodedValueUuid(
    getAttributeValue(queueEntry, SIS_ACCREDITATION_STATUS_VISIT_ATTRIBUTE_TYPE_UUID),
  );
  const accreditationCheckedAt = getTextValue(
    getAttributeValue(queueEntry, SIS_ACCREDITATION_CHECKED_AT_VISIT_ATTRIBUTE_TYPE_UUID),
  );
  return getSisFinancingState({
    financiadorUuid: funderUuid,
    insuranceNumber,
    accreditationStatusUuid: statusUuid,
    accreditationCheckedAt,
  });
}

/**
 * The patient affiliation is the freshest insurance information available.
 * A visit keeps its own financing snapshot, but queue decisions must not keep
 * presenting that snapshot as current after Admission corrects the patient.
 */
export function getPersonSisState(personInsurance: PersonInsurance): SisState {
  return getSisFinancingState({
    financiadorUuid: personInsurance.insuranceTypeUuid,
    insuranceNumber: personInsurance.insuranceCode,
    accreditationStatusUuid: personInsurance.accreditationStatusUuid,
    accreditationCheckedAt: personInsurance.accreditationCheckedAt,
  });
}

/**
 * Refreshes the visit financing from the current patient affiliation and then
 * reads it back. Triage uses the persisted result, not an optimistic value, so
 * downstream billing and FUA consumers see the same coverage decision.
 */
export async function refreshVisitSisStateFromPerson(queueEntry: QueueEntry): Promise<SisState> {
  const patientUuid = queueEntry.patient?.uuid;
  const visitUuid = queueEntry.visit?.uuid;
  if (!patientUuid || !visitUuid) {
    throw new Error('La entrada de cola no tiene un paciente y una atención asociados para validar el SIS.');
  }

  const currentPersonState = getPersonSisState(await fetchPersonInsurance(patientUuid));
  await copyFinanciadorToVisit({ patientUuid, visitUuid, onlyFillMissing: false });
  const persistedVisitState = getSisFinancingState(await fetchVisitInsurance(visitUuid));

  if (persistedVisitState !== currentPersonState) {
    throw new Error('El estado SIS actual del paciente no pudo sincronizarse con la atención.');
  }

  return persistedVisitState;
}

/**
 * Reads the current affiliation even when the user cannot mutate visits. This
 * keeps the clinical gate correct without turning an RBAC difference into a
 * broken triage button.
 */
export async function revalidateCurrentSisState(
  queueEntry: QueueEntry,
  canSynchronizeVisit: boolean,
): Promise<SisState> {
  if (canSynchronizeVisit) {
    return refreshVisitSisStateFromPerson(queueEntry);
  }

  const patientUuid = queueEntry.patient?.uuid;
  if (!patientUuid) {
    throw new Error('La entrada de cola no tiene un paciente asociado para validar el SIS.');
  }

  return getPersonSisState(await fetchPersonInsurance(patientUuid));
}

export function getTriageState(
  queueEntry: QueueEntry,
  config?: AppointmentTriageConfig,
  appointment?: AppointmentSummary,
): TriageState {
  if (!config?.triageRouting?.enabled || !getLinkedAppointmentUuid(queueEntry, config)) {
    return 'notRequired';
  }
  const requiresTriage =
    queueEntry.queue?.uuid === config.triageRouting.queueUuid || Boolean(getDestinationQueueUuid(appointment, config));
  if (!requiresTriage) {
    return 'notRequired';
  }
  const completed = queueEntry.visit?.encounters?.some(
    (encounter) => !encounter.voided && encounter.encounterType?.uuid === config.triageRouting.encounterTypeUuid,
  );
  return completed ? 'completed' : 'pending';
}

export async function getAppointmentTriageConfig(): Promise<AppointmentTriageConfig> {
  return (await getConfig(appointmentsModuleName)) as unknown as AppointmentTriageConfig;
}

async function fetchAppointment(appointmentUuid: string): Promise<AppointmentSummary> {
  const response = await openmrsFetch<AppointmentSummary>(`${restBaseUrl}/appointments/${appointmentUuid}`);
  return response.data;
}

function getDestinationQueueUuid(
  appointment: AppointmentSummary | undefined,
  config: AppointmentTriageConfig | undefined,
): string | undefined {
  if (!appointment?.service?.uuid || !appointment.location?.uuid || !config) {
    return undefined;
  }
  const matchingRules = config.appointmentArrivalRules.filter(
    (rule) =>
      rule.requiresTriage &&
      rule.appointmentServiceUuid === appointment.service?.uuid &&
      rule.appointmentLocationUuid === appointment.location?.uuid,
  );
  return matchingRules.length === 1 ? matchingRules[0].queueUuid : undefined;
}

export function useQueueWorkflowMetadata(queueEntries: Array<QueueEntry>) {
  const appointmentConfig = useSWR<AppointmentTriageConfig, Error>(
    'sihsalus-appointment-triage-config',
    getAppointmentTriageConfig,
  );
  const appointmentUuids = Array.from(
    new Set(
      queueEntries
        .map((entry) => getLinkedAppointmentUuid(entry, appointmentConfig.data))
        .filter((uuid): uuid is string => Boolean(uuid)),
    ),
  ).sort();
  const appointments = useSWR<Map<string, AppointmentSummary>, Error>(
    appointmentConfig.data && appointmentUuids.length > 0
      ? ['sihsalus-queue-appointments', appointmentUuids.join(',')]
      : null,
    async () => {
      const results = await Promise.all(appointmentUuids.map((uuid) => fetchAppointment(uuid)));
      return new Map(results.map((appointment) => [appointment.uuid, appointment]));
    },
  );
  const patientUuids = Array.from(
    new Set(queueEntries.map((entry) => entry.patient?.uuid).filter((uuid): uuid is string => Boolean(uuid))),
  ).sort();
  const patientSisStates = useSWR<Map<string, SisState>, Error>(
    patientUuids.length > 0 ? ['sihsalus-queue-patient-insurance', patientUuids.join(',')] : null,
    async () => {
      const states = await Promise.all(
        patientUuids.map(
          async (patientUuid) => [patientUuid, getPersonSisState(await fetchPersonInsurance(patientUuid))] as const,
        ),
      );
      return new Map(states);
    },
    { refreshInterval: 30_000, revalidateOnFocus: true },
  );

  useEffect(() => {
    const refreshCurrentCoverage = () => {
      void patientSisStates.mutate();
    };
    globalThis.addEventListener('queue-entry-updated', refreshCurrentCoverage);
    return () => globalThis.removeEventListener('queue-entry-updated', refreshCurrentCoverage);
  }, [patientSisStates.mutate]);

  const entries = queueEntries.map((entry) => {
    const appointmentUuid = getLinkedAppointmentUuid(entry, appointmentConfig.data) ?? undefined;
    const appointment = appointmentUuid ? appointments.data?.get(appointmentUuid) : undefined;
    const workflow: QueueWorkflowMetadata = {
      appointmentStartDateTime: appointment?.startDateTime,
      appointmentUuid,
      destinationQueueUuid: getDestinationQueueUuid(appointment, appointmentConfig.data),
      isTriageQueue: entry.queue?.uuid === appointmentConfig.data?.triageRouting?.queueUuid,
      // Never advertise an old visit snapshot as active while current patient
      // coverage is loading or could not be read. This is intentionally
      // fail-closed because the value gates clinical triage.
      sisState: patientSisStates.data?.get(entry.patient?.uuid) ?? 'notConsulted',
      triageState: getTriageState(entry, appointmentConfig.data, appointment),
    };
    return { ...entry, workflow };
  });

  return {
    appointmentConfig: appointmentConfig.data,
    entries,
    error: appointmentConfig.error ?? appointments.error ?? patientSisStates.error,
    isLoading:
      appointmentConfig.isLoading ||
      (appointmentUuids.length > 0 && appointments.isLoading) ||
      (patientUuids.length > 0 && patientSisStates.isLoading),
  };
}

export async function transitionTriagedPatient(queueEntry: QueueEntry): Promise<FetchResponse<QueueEntry>> {
  const config = await getAppointmentTriageConfig();
  const appointmentUuid = getLinkedAppointmentUuid(queueEntry, config);
  if (!appointmentUuid) {
    throw new Error('La consulta no conserva el vínculo con la cita que originó el triaje.');
  }
  const appointment = await fetchAppointment(appointmentUuid);
  const destinationQueueUuid = getDestinationQueueUuid(appointment, config);
  if (!destinationQueueUuid || destinationQueueUuid === config.triageRouting.queueUuid) {
    throw new Error('No existe una cola clínica de destino única para el servicio de esta cita.');
  }
  const serviceQueuesConfig = (await getConfig(serviceQueuesModuleName)) as unknown as ServiceQueuesRoutingConfig;

  return transitionQueueEntry({
    queueEntryToTransition: queueEntry.uuid,
    newQueue: destinationQueueUuid,
    newPriority: queueEntry.priority?.uuid,
    newStatus: serviceQueuesConfig.concepts.defaultStatusConceptUuid,
  });
}
