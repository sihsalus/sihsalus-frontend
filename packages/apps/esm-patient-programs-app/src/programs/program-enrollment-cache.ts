import { mutate } from 'swr';

function getCacheKeyStrings(key: unknown): Array<string> {
  if (typeof key === 'string') {
    return [key];
  }

  if (Array.isArray(key)) {
    return key.filter((entry): entry is string => typeof entry === 'string');
  }

  return [];
}

export function isPatientProgramEnrollmentCacheKey(key: unknown, patientUuid: string): boolean {
  if (!patientUuid) {
    return false;
  }

  return getCacheKeyStrings(key).some((cacheKey) => {
    if (!cacheKey.includes('/programenrollment?')) {
      return false;
    }

    const queryString = cacheKey.split('?')[1] ?? '';
    return new URLSearchParams(queryString).get('patient') === patientUuid;
  });
}

export function mutatePatientProgramEnrollments(patientUuid: string) {
  return mutate((key) => isPatientProgramEnrollmentCacheKey(key, patientUuid));
}
