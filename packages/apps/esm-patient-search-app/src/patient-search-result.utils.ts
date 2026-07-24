import { type SearchedPatient } from './types';

export function isValidSearchedPatient(patient: unknown): patient is SearchedPatient {
  if (!patient || typeof patient !== 'object') {
    return false;
  }

  const candidate = patient as Partial<SearchedPatient>;

  return (
    typeof candidate.uuid === 'string' &&
    candidate.uuid.trim().length > 0 &&
    Array.isArray(candidate.identifiers) &&
    Boolean(candidate.person) &&
    Boolean(candidate.person?.personName)
  );
}
