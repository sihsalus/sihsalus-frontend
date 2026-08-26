import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

const scheduledAppointmentStatuses = new Set(['scheduled']);
const appointmentSearchTimeoutMs = 10_000;

interface AppointmentReference {
  display?: unknown;
  location?: AppointmentReference;
  name?: unknown;
  person?: AppointmentReference | null;
  response?: unknown;
  uuid?: unknown;
}

interface AppointmentSearchItem {
  uuid?: string;
  startDateTime?: Date | number | string;
  status?: string;
  voided?: boolean;
  location?: AppointmentReference;
  provider?: AppointmentReference;
  providers?: Array<AppointmentReference>;
  patient?: AppointmentReference;
  service?: AppointmentReference;
}

export interface OutpatientScheduledAppointment {
  uuid: string;
  startDateTime: string;
  service: string | null;
  location: string | null;
  provider: string | null;
}

export function isUpcomingScheduledAppointment(
  appointment: OutpatientScheduledAppointment | null | undefined,
  now = new Date(),
): boolean {
  const startDate = toAppointmentDate(appointment?.startDateTime);
  return Boolean(startDate && startDate.valueOf() > now.valueOf());
}

interface FetchNextScheduledAppointmentOptions {
  excludedAppointmentUuids?: ReadonlyArray<string>;
  now?: Date;
}

function toAppointmentDate(value: Date | number | string | undefined): Date | null {
  if (value === undefined) return null;
  let normalizedValue: Date | number | string = value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) normalizedValue = Number(value);
  if (typeof normalizedValue === 'number') {
    normalizedValue = Math.abs(normalizedValue) < 100_000_000_000 ? normalizedValue * 1000 : normalizedValue;
  }
  const parsed = normalizedValue instanceof Date ? new Date(normalizedValue.valueOf()) : new Date(normalizedValue);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function isScheduledAppointment(status: unknown): boolean {
  const normalizedStatus = String(status ?? '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
  return scheduledAppointmentStatuses.has(normalizedStatus);
}

function getReferenceDisplay(reference: AppointmentReference | undefined): string | null {
  const name = typeof reference?.name === 'string' ? reference.name.trim() : '';
  const display = typeof reference?.display === 'string' ? reference.display.trim() : '';
  return name || display || null;
}

function getProviderDisplay(provider: AppointmentReference | undefined): string | null {
  return getReferenceDisplay(provider?.person ?? undefined) ?? getReferenceDisplay(provider);
}

function getAppointmentProvider(appointment: AppointmentSearchItem): string | null {
  const acceptedProvider = appointment.providers?.find(
    (provider) =>
      String(provider.response ?? '')
        .trim()
        .toUpperCase() === 'ACCEPTED' && getProviderDisplay(provider),
  );
  return (
    getProviderDisplay(acceptedProvider) ??
    getProviderDisplay(appointment.provider) ??
    appointment.providers?.map(getProviderDisplay).find(Boolean) ??
    null
  );
}

export function selectNextScheduledAppointment(
  appointments: Array<AppointmentSearchItem>,
  now: Date,
  expectedPatientUuid: string,
  excludedAppointmentUuids: ReadonlyArray<string> = [],
): OutpatientScheduledAppointment | null {
  const normalizedPatientUuid = expectedPatientUuid.trim().toLowerCase();
  if (!normalizedPatientUuid) return null;
  const excludedUuids = new Set(excludedAppointmentUuids.map((uuid) => uuid.trim().toLowerCase()).filter(Boolean));
  const nextAppointment = appointments
    .flatMap((appointment) => {
      const startDate = toAppointmentDate(appointment.startDateTime);
      return appointment.uuid &&
        appointment.patient?.uuid &&
        String(appointment.patient.uuid).trim().toLowerCase() === normalizedPatientUuid &&
        !excludedUuids.has(appointment.uuid.trim().toLowerCase()) &&
        !appointment.voided &&
        isScheduledAppointment(appointment.status) &&
        startDate
        ? [{ appointment, startDate }]
        : [];
    })
    .filter(({ startDate }) => startDate.valueOf() > now.valueOf())
    .sort((left, right) => left.startDate.valueOf() - right.startDate.valueOf())[0];

  if (!nextAppointment) return null;
  const { appointment, startDate } = nextAppointment;
  return {
    uuid: appointment.uuid as string,
    startDateTime: startDate.toISOString(),
    service: getReferenceDisplay(appointment.service),
    location: getReferenceDisplay(appointment.location) ?? getReferenceDisplay(appointment.service?.location),
    provider: getAppointmentProvider(appointment),
  };
}

export async function fetchNextScheduledAppointment(
  patientUuid: string,
  options: FetchNextScheduledAppointmentOptions = {},
): Promise<OutpatientScheduledAppointment | null> {
  const requestStartedAt = options.now ?? new Date();
  const abortController = new AbortController();
  const timeout = globalThis.setTimeout(() => abortController.abort(), appointmentSearchTimeoutMs);
  try {
    const { data } = await openmrsFetch<Array<AppointmentSearchItem>>(`${restBaseUrl}/appointments/search`, {
      method: 'POST',
      signal: abortController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: {
        patientUuid,
        startDate: requestStartedAt.toISOString(),
      },
    });

    const selectionTime = options.now ?? new Date();
    return selectNextScheduledAppointment(data ?? [], selectionTime, patientUuid, options.excludedAppointmentUuids);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
