import { type FetchResponse, openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';
import {
  drainActiveQueueEntriesForPatient,
  drainActiveQueueEntriesForVisit,
  fetchFreshPatientVitalStatus,
  getQueueEntriesForVisit,
  type ActiveQueueEntrySummary,
} from '@openmrs/esm-patient-common-lib';

import { markPatientDeceased } from '../data.resource';

export type DeathCareContext = 'during-care' | 'outside-care';

interface ActiveVisitSummary {
  encounters?: Array<{ encounterDatetime?: string | null }>;
  startDatetime?: string | null;
  stopDatetime?: string | null;
  uuid: string;
}

interface AppointmentSummary {
  status?: string | null;
  uuid: string;
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
  closedQueueEntries: number;
  closedVisits: number;
  completedAppointments: number;
}

const APPOINTMENT_SEARCH_START_DATE = '1900-01-01T00:00:00.000Z';
const terminalAppointmentStatuses = new Set(['cancelled', 'completed', 'missed']);
const cancellableAppointmentStatuses = new Set(['requested', 'waitlist', 'scheduled', 'arrived']);
const nonTerminalAppointmentStatuses = ['Requested', 'WaitList', 'Scheduled', 'Arrived', 'CheckedIn'] as const;

type NonTerminalAppointmentStatus = (typeof nonTerminalAppointmentStatuses)[number];

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

function getVisitStopDate(
  visit: ActiveVisitSummary,
  serverDate: Date,
  queueEntries: Array<ActiveQueueEntrySummary>,
) {
  const safeServerDate = new Date(serverDate.valueOf() + 999);
  const relevantDatetimes = [
    visit.startDatetime,
    ...(visit.encounters ?? []).map(({ encounterDatetime }) => encounterDatetime),
    ...queueEntries.flatMap(({ startedAt, endedAt }) => [startedAt, endedAt]),
  ];

  return relevantDatetimes.reduce((latest, value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.valueOf()) && date > latest ? date : latest;
  }, safeServerDate);
}

async function getActiveVisits(patientUuid: string) {
  const searchParams = new URLSearchParams({
    patient: patientUuid,
    includeInactive: 'false',
    limit: '100',
    v: 'custom:(uuid,startDatetime,stopDatetime,encounters:(encounterDatetime))',
  });

  return openmrsFetch<{ results?: Array<ActiveVisitSummary> }>(`${restBaseUrl}/visit?${searchParams.toString()}`);
}

async function getVisit(visitUuid: string) {
  const searchParams = new URLSearchParams({
    v: 'custom:(uuid,startDatetime,stopDatetime,encounters:(encounterDatetime))',
  });
  return openmrsFetch<ActiveVisitSummary>(`${restBaseUrl}/visit/${visitUuid}?${searchParams.toString()}`);
}

async function closeVisit(visit: ActiveVisitSummary, serverDate: Date) {
  const closedQueueEntries = await drainActiveQueueEntriesForVisit(visit.uuid);
  const queueEntriesResponse = await getQueueEntriesForVisit(visit.uuid);
  const queueEntries = queueEntriesResponse.data?.results ?? [];
  const freshVisitResponse = await getVisit(visit.uuid);
  if (freshVisitResponse.data?.stopDatetime) {
    return { closedQueueEntries, transitioned: false };
  }
  const freshVisit = freshVisitResponse.data;
  const authoritativeDate = getResponseDate(freshVisitResponse);
  const latestServerDate = authoritativeDate > serverDate ? authoritativeDate : serverDate;

  try {
    await openmrsFetch(`${restBaseUrl}/clinicalvisitclosure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        visitUuid: visit.uuid,
        stopDatetime: toOmrsIsoString(getVisitStopDate(freshVisit, latestServerDate, queueEntries)),
      },
    });
  } catch (error) {
    // A lost response can hide a committed closure. Re-read before surfacing an
    // error so the complete workflow remains safe to retry.
    const latestVisit = await getVisit(visit.uuid).catch(() => null);
    if (!latestVisit?.data?.stopDatetime) {
      throw error;
    }
    return { closedQueueEntries, transitioned: true };
  }

  const latestVisit = await getVisit(visit.uuid);
  if (!latestVisit.data?.stopDatetime) {
    throw Object.assign(new Error('The clinical visit closure could not be verified.'), {
      code: 'DECEASED_PATIENT_VISIT_CLOSE_UNVERIFIED',
    });
  }
  return { closedQueueEntries, transitioned: true };
}

async function closeActiveVisits(patientUuid: string) {
  let closedQueueEntries = 0;
  let closedVisits = 0;
  const terminalVisitsSeenInSearch = new Set<string>();

  // The visit search is capped. Close the current active bucket and re-query it
  // until empty instead of assuming that one page represents the full patient.
  while (true) {
    const response = await getActiveVisits(patientUuid);
    const visits = Array.from(
      new Map(
        (response.data?.results ?? []).filter((visit) => !visit.stopDatetime).map((visit) => [visit.uuid, visit]),
      ).values(),
    );
    if (!visits.length) {
      return { closedQueueEntries, closedVisits };
    }

    const serverDate = getResponseDate(response);
    const results = await Promise.allSettled(visits.map((visit) => closeVisit(visit, serverDate)));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      throw failure.reason;
    }

    let madeProgress = false;
    let observedNewTerminalVisit = false;
    results.forEach((result, index) => {
      const outcome = (
        result as PromiseFulfilledResult<{ closedQueueEntries: number; transitioned: boolean }>
      ).value;
      closedQueueEntries += outcome.closedQueueEntries;
      if (outcome.transitioned) {
        closedVisits += 1;
        madeProgress = true;
      } else if (!terminalVisitsSeenInSearch.has(visits[index].uuid)) {
        terminalVisitsSeenInSearch.add(visits[index].uuid);
        observedNewTerminalVisit = true;
      }
    });

    if (!madeProgress && !observedNewTerminalVisit) {
      throw Object.assign(new Error('Active visit search did not advance.'), {
        code: 'DECEASED_PATIENT_VISIT_SEARCH_STALLED',
      });
    }
  }
}

async function searchPatientAppointments(
  patientUuid: string,
  status: NonTerminalAppointmentStatus,
  withoutDates: boolean,
) {
  if (withoutDates) {
    // Bahmni's singular search endpoint is the only API that can return
    // appointments whose start/end dates are null.
    return openmrsFetch<Array<AppointmentSummary>>(`${restBaseUrl}/appointment/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        patientUuids: [patientUuid],
        status,
        withoutDates: true,
      },
    });
  }

  return openmrsFetch<Array<AppointmentSummary>>(`${restBaseUrl}/appointments/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      patientUuid,
      startDate: APPOINTMENT_SEARCH_START_DATE,
      status,
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
  let writeError: unknown;
  try {
    await openmrsFetch(`${restBaseUrl}/appointments/${appointmentUuid}/status-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { toStatus: targetStatus, onDate },
    });
  } catch (error) {
    writeError = error;
  }

  let latestStatus: string;
  try {
    latestStatus = normalizeAppointmentStatus((await getAppointment(appointmentUuid)).data?.status);
  } catch (verificationError) {
    if (writeError) {
      throw writeError;
    }
    throw Object.assign(new Error('The appointment status change could not be verified.'), {
      cause: verificationError,
      code: 'DECEASED_PATIENT_APPOINTMENT_STATUS_CHANGE_UNVERIFIED',
    });
  }

  if (latestStatus !== normalizeAppointmentStatus(targetStatus)) {
    if (writeError) {
      throw writeError;
    }
    throw Object.assign(new Error('The appointment status change was not persisted.'), {
      code: 'DECEASED_PATIENT_APPOINTMENT_STATUS_CHANGE_UNVERIFIED',
    });
  }

  return targetStatus;
}

async function drainAppointmentSearch(
  patientUuid: string,
  status: NonTerminalAppointmentStatus,
  withoutDates: boolean,
  careContext: DeathCareContext,
) {
  let cancelledAppointments = 0;
  let completedAppointments = 0;
  const terminalAppointmentsSeenInSearch = new Set<string>();

  // Appointments 2.1.0 caps both search APIs and exposes no offset. Query one
  // non-terminal status at a time, transition that page to a terminal status,
  // then query again until the status bucket is empty. This is retry-safe and
  // drains any number of dated and undated appointments.
  while (true) {
    const response = await searchPatientAppointments(patientUuid, status, withoutDates);
    const appointments = Array.from(
      new Map((response.data ?? []).map((appointment) => [appointment.uuid, appointment])).values(),
    );

    if (!appointments.length) {
      return { cancelledAppointments, completedAppointments };
    }

    const results = await Promise.allSettled(
      appointments.map((appointment) => transitionAppointment(appointment.uuid, careContext)),
    );
    const failure = results.find((result) => result.status === 'rejected');

    if (failure?.status === 'rejected') {
      throw failure.reason;
    }

    const targetStatuses = results.map((result) => (result as PromiseFulfilledResult<string | null>).value);
    let madeProgress = false;
    let observedNewTerminalAppointment = false;

    targetStatuses.forEach((targetStatus, index) => {
      if (targetStatus === 'Cancelled') {
        cancelledAppointments += 1;
        madeProgress = true;
      } else if (targetStatus === 'Completed') {
        completedAppointments += 1;
        madeProgress = true;
      } else {
        const appointmentUuid = appointments[index].uuid;
        if (!terminalAppointmentsSeenInSearch.has(appointmentUuid)) {
          terminalAppointmentsSeenInSearch.add(appointmentUuid);
          observedNewTerminalAppointment = true;
        }
      }
    });

    // A concurrent transition can legitimately leave one stale page in the
    // search result. If the exact terminal rows keep reappearing, fail instead
    // of looping forever and let the idempotent workflow be retried.
    if (!madeProgress && !observedNewTerminalAppointment) {
      throw Object.assign(new Error(`Appointment search did not advance for status ${status}.`), {
        code: 'DECEASED_PATIENT_APPOINTMENT_SEARCH_STALLED',
      });
    }
  }
}

async function reconcileAppointments(patientUuid: string, careContext: DeathCareContext) {
  let cancelledAppointments = 0;
  let completedAppointments = 0;

  for (const status of nonTerminalAppointmentStatuses) {
    for (const withoutDates of [false, true]) {
      const result = await drainAppointmentSearch(patientUuid, status, withoutDates, careContext);
      cancelledAppointments += result.cancelledAppointments;
      completedAppointments += result.completedAppointments;
    }
  }

  return { cancelledAppointments, completedAppointments };
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
  const vitalStatus = await fetchFreshPatientVitalStatus(patientUuid);
  if (!vitalStatus.isDeceased) {
    let markError: unknown;
    try {
      await markPatientDeceased(deathDate, patientUuid, causeOfDeath, nonCodedCauseOfDeath);
    } catch (error) {
      markError = error;
    }

    let confirmedVitalStatus: Awaited<ReturnType<typeof fetchFreshPatientVitalStatus>>;
    try {
      confirmedVitalStatus = await fetchFreshPatientVitalStatus(patientUuid);
    } catch (verificationError) {
      if (markError) {
        throw markError;
      }
      throw Object.assign(new Error('The patient death could not be verified.'), {
        cause: verificationError,
        code: 'DECEASED_PATIENT_MARK_UNVERIFIED',
      });
    }

    if (!confirmedVitalStatus.isDeceased) {
      if (markError) {
        throw markError;
      }
      throw Object.assign(new Error('The patient death was not persisted.'), {
        code: 'DECEASED_PATIENT_MARK_UNVERIFIED',
      });
    }
  }

  // Attach the rejection handler immediately so a fast appointment failure is
  // not reported as unhandled while queue reconciliation is still in flight.
  const appointmentsResultPromise = Promise.allSettled([reconcileAppointments(patientUuid, careContext)]);
  const [queueEntriesResult] = await Promise.allSettled([drainActiveQueueEntriesForPatient(patientUuid)]);

  let visitsResult: PromiseSettledResult<{ closedQueueEntries: number; closedVisits: number }> | null = null;
  let finalQueueEntriesResult: PromiseSettledResult<number> | null = null;
  if (queueEntriesResult.status === 'fulfilled') {
    [visitsResult] = await Promise.allSettled([closeActiveVisits(patientUuid)]);
    // Verify/drain the patient bucket once more after visit work. This catches
    // visitless entries or successors created during visit reconciliation.
    [finalQueueEntriesResult] = await Promise.allSettled([drainActiveQueueEntriesForPatient(patientUuid)]);
  }

  const [appointmentsResult] = await appointmentsResultPromise;
  const failures = [queueEntriesResult, visitsResult, finalQueueEntriesResult, appointmentsResult].filter(
    (result): result is PromiseRejectedResult => result?.status === 'rejected',
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

  if (
    queueEntriesResult.status !== 'fulfilled' ||
    visitsResult?.status !== 'fulfilled' ||
    finalQueueEntriesResult?.status !== 'fulfilled' ||
    appointmentsResult.status !== 'fulfilled'
  ) {
    throw new Error('Death workflow reconciliation did not return a result');
  }

  return {
    closedQueueEntries:
      queueEntriesResult.value + visitsResult.value.closedQueueEntries + finalQueueEntriesResult.value,
    closedVisits: visitsResult.value.closedVisits,
    ...appointmentsResult.value,
  };
}
