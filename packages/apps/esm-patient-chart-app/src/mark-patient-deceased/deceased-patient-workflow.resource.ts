import { type FetchResponse, openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';

import { markPatientDeceased } from '../data.resource';

export type DeathCareContext = 'during-care' | 'outside-care';

interface ActiveVisitSummary {
  startDatetime?: string | null;
  stopDatetime?: string | null;
  uuid: string;
}

interface AppointmentSummary {
  status?: string | null;
  uuid: string;
}

interface AppointmentSearchResponse {
  data?: Array<AppointmentSummary>;
}

export interface DeceasedPatientWorkflowInput {
  careContext: DeathCareContext;
  causeOfDeath?: string;
  deathDate: Date;
  nonCodedCauseOfDeath?: string;
  patientUuid: string;
}

export interface DeceasedPatientWorkflowResult {
  cancelledAppointments: number;
  closedVisits: number;
  completedAppointments: number;
}

const APPOINTMENT_SEARCH_START_DATE = '1900-01-01T00:00:00.000Z';
const terminalAppointmentStatuses = new Set(['cancelled', 'completed', 'missed']);
const cancellableAppointmentStatuses = new Set(['requested', 'waitlist', 'scheduled', 'arrived']);

function normalizeAppointmentStatus(status: string | null | undefined) {
  return String(status ?? '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
}

function getResponseDate(response: Pick<FetchResponse<unknown>, 'headers'>) {
  const headerValue = response.headers?.get?.('Date');
  const date = headerValue ? new Date(headerValue) : null;
  return date && !Number.isNaN(date.valueOf()) ? date : new Date();
}

function getVisitStopDate(visit: ActiveVisitSummary, serverDate: Date) {
  const startDate = visit.startDatetime ? new Date(visit.startDatetime) : null;
  return startDate && !Number.isNaN(startDate.valueOf()) && startDate > serverDate ? startDate : serverDate;
}

async function getActiveVisits(patientUuid: string) {
  const searchParams = new URLSearchParams({
    patient: patientUuid,
    includeInactive: 'false',
    limit: '100',
    v: 'custom:(uuid,startDatetime,stopDatetime)',
  });

  return openmrsFetch<{ results?: Array<ActiveVisitSummary> }>(`${restBaseUrl}/visit?${searchParams.toString()}`);
}

async function getVisit(visitUuid: string) {
  const searchParams = new URLSearchParams({ v: 'custom:(uuid,startDatetime,stopDatetime)' });
  return openmrsFetch<ActiveVisitSummary>(`${restBaseUrl}/visit/${visitUuid}?${searchParams.toString()}`);
}

async function closeVisit(visit: ActiveVisitSummary, serverDate: Date) {
  try {
    await openmrsFetch(`${restBaseUrl}/clinicalvisitclosure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        visitUuid: visit.uuid,
        stopDatetime: toOmrsIsoString(getVisitStopDate(visit, serverDate)),
      },
    });
  } catch (error) {
    // A lost response can hide a committed closure. Re-read before surfacing an
    // error so the complete workflow remains safe to retry.
    const latestVisit = await getVisit(visit.uuid).catch(() => null);
    if (!latestVisit?.data?.stopDatetime) {
      throw error;
    }
  }
}

async function closeActiveVisits(patientUuid: string) {
  const response = await getActiveVisits(patientUuid);
  const visits = Array.from(
    new Map(
      (response.data?.results ?? []).filter((visit) => !visit.stopDatetime).map((visit) => [visit.uuid, visit]),
    ).values(),
  );
  const serverDate = getResponseDate(response);
  const results = await Promise.allSettled(visits.map((visit) => closeVisit(visit, serverDate)));
  const failure = results.find((result) => result.status === 'rejected');

  if (failure?.status === 'rejected') {
    throw failure.reason;
  }

  return visits.length;
}

async function searchPatientAppointments(patientUuid: string) {
  return openmrsFetch<AppointmentSearchResponse>(`${restBaseUrl}/appointments/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      patientUuid,
      startDate: APPOINTMENT_SEARCH_START_DATE,
    },
  });
}

async function getAppointment(appointmentUuid: string) {
  return openmrsFetch<AppointmentSummary>(`${restBaseUrl}/appointment?uuid=${encodeURIComponent(appointmentUuid)}`);
}

function getTargetAppointmentStatus(status: string | null | undefined, careContext: DeathCareContext) {
  const normalizedStatus = normalizeAppointmentStatus(status);

  if (terminalAppointmentStatuses.has(normalizedStatus)) {
    return null;
  }

  if (normalizedStatus === 'checkedin') {
    return careContext === 'during-care' ? 'Completed' : 'Cancelled';
  }

  if (cancellableAppointmentStatuses.has(normalizedStatus)) {
    return 'Cancelled';
  }

  throw Object.assign(new Error(`Unsupported appointment status: ${status ?? '(missing)'}`), {
    code: 'DECEASED_PATIENT_UNSUPPORTED_APPOINTMENT_STATUS',
  });
}

async function transitionAppointment(appointmentUuid: string, careContext: DeathCareContext) {
  const currentResponse = await getAppointment(appointmentUuid);
  const targetStatus = getTargetAppointmentStatus(currentResponse.data?.status, careContext);

  if (!targetStatus) {
    return null;
  }

  const onDate = getResponseDate(currentResponse).toISOString();
  try {
    await openmrsFetch(`${restBaseUrl}/appointments/${appointmentUuid}/status-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { toStatus: targetStatus, onDate },
    });
  } catch (error) {
    const latestStatus = await getAppointment(appointmentUuid)
      .then(({ data }) => normalizeAppointmentStatus(data?.status))
      .catch(() => '');
    if (latestStatus !== normalizeAppointmentStatus(targetStatus)) {
      throw error;
    }
  }

  return targetStatus;
}

async function reconcileAppointments(patientUuid: string, careContext: DeathCareContext) {
  const response = await searchPatientAppointments(patientUuid);
  const appointments = Array.from(
    new Map(
      (response.data?.data ?? [])
        .filter((appointment) => !terminalAppointmentStatuses.has(normalizeAppointmentStatus(appointment.status)))
        .map((appointment) => [appointment.uuid, appointment]),
    ).values(),
  );
  const results = await Promise.allSettled(
    appointments.map((appointment) => transitionAppointment(appointment.uuid, careContext)),
  );
  const failure = results.find((result) => result.status === 'rejected');

  if (failure?.status === 'rejected') {
    throw failure.reason;
  }

  const targetStatuses = results.map((result) => (result as PromiseFulfilledResult<string | null>).value);
  return {
    cancelledAppointments: targetStatuses.filter((status) => status === 'Cancelled').length,
    completedAppointments: targetStatuses.filter((status) => status === 'Completed').length,
  };
}

/**
 * Records the death and reconciles operational state left behind by the patient.
 * Every step is idempotent or fresh-reads state before writing, so a partial
 * failure can be retried from the same form without repeating terminal changes.
 */
export async function reconcileDeceasedPatientWorkflow({
  careContext,
  causeOfDeath,
  deathDate,
  nonCodedCauseOfDeath,
  patientUuid,
}: DeceasedPatientWorkflowInput): Promise<DeceasedPatientWorkflowResult> {
  await markPatientDeceased(deathDate, patientUuid, causeOfDeath, nonCodedCauseOfDeath);

  const [visitsResult, appointmentsResult] = await Promise.allSettled([
    closeActiveVisits(patientUuid),
    reconcileAppointments(patientUuid, careContext),
  ]);
  const failures = [visitsResult, appointmentsResult].filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (failures.length) {
    throw Object.assign(
      new AggregateError(
        failures.map(({ reason }) => reason),
        'Death workflow reconciliation failed',
      ),
      {
        code: 'DECEASED_PATIENT_RECONCILIATION_FAILED',
      },
    );
  }

  if (visitsResult.status !== 'fulfilled' || appointmentsResult.status !== 'fulfilled') {
    throw new Error('Death workflow reconciliation did not return a result');
  }

  return {
    closedVisits: visitsResult.value,
    ...appointmentsResult.value,
  };
}
