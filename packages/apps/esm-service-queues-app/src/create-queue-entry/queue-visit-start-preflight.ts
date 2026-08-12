import dayjs from 'dayjs';

export type QueueVisitStartPreflightState =
  | 'not-required'
  | 'visit-capability-missing'
  | 'patient-loading'
  | 'patient-age-unavailable'
  | 'companion-capability-missing'
  | 'ready';

interface QueueVisitStartPreflightInput {
  birthDate?: string | null;
  canStartVisit: boolean;
  hasCompanionCapability: boolean;
  needsNewVisit: boolean;
  patientError?: unknown;
  patientIsLoading: boolean;
  referenceDate?: string | Date;
}

/**
 * Determines whether the queue flow may open its start-visit child. The check
 * only applies to a clinical queue without an active visit. Age fails closed so
 * a minor is never left in a form where no companion path is available.
 */
export function getQueueVisitStartPreflightState({
  birthDate,
  canStartVisit,
  hasCompanionCapability,
  needsNewVisit,
  patientError,
  patientIsLoading,
  referenceDate,
}: QueueVisitStartPreflightInput): QueueVisitStartPreflightState {
  if (!needsNewVisit) {
    return 'not-required';
  }

  if (!canStartVisit) {
    return 'visit-capability-missing';
  }

  if (patientIsLoading) {
    return 'patient-loading';
  }

  const normalizedBirthDate = birthDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const parsedBirthDate = normalizedBirthDate ? dayjs(normalizedBirthDate).startOf('day') : null;
  const today = dayjs(referenceDate).startOf('day');
  const hasValidBirthDate =
    Boolean(parsedBirthDate) &&
    parsedBirthDate?.isValid() &&
    parsedBirthDate.format('YYYY-MM-DD') === normalizedBirthDate &&
    !parsedBirthDate.isAfter(today);

  if (patientError || !hasValidBirthDate) {
    return 'patient-age-unavailable';
  }

  const isMinor = today.diff(parsedBirthDate, 'year') < 18;
  if (isMinor && !hasCompanionCapability) {
    return 'companion-capability-missing';
  }

  return 'ready';
}
