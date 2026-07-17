import dayjs, { type Dayjs } from 'dayjs';

export type MinorCompanionRequirementState = 'not-required' | 'loading' | 'missing' | 'satisfied';

export function isPatientMinor(birthDateValue?: string | null, referenceDate: Dayjs = dayjs()) {
  if (!birthDateValue) {
    return false;
  }

  const normalizedBirthDate = birthDateValue.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? birthDateValue;
  const birthDate = dayjs(normalizedBirthDate).startOf('day');
  const today = referenceDate.startOf('day');

  return birthDate.isValid() && !birthDate.isAfter(today) && today.diff(birthDate, 'year') < 18;
}

export function getMinorCompanionRequirementState(
  companionRequired: boolean,
  isLoadingCompanions: boolean,
  companionCount: number,
): MinorCompanionRequirementState {
  if (!companionRequired) {
    return 'not-required';
  }

  if (isLoadingCompanions) {
    return 'loading';
  }

  return companionCount > 0 ? 'satisfied' : 'missing';
}
