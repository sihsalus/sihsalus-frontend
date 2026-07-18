export const MIN_PATIENT_SEARCH_CHARACTERS = 3;
export const MAX_PATIENT_SEARCH_CHARACTERS = 100;

export function limitPatientSearchTerm(value: string = '') {
  return value.slice(0, MAX_PATIENT_SEARCH_CHARACTERS);
}

export function normalizePatientSearchTerm(value: string = '') {
  return limitPatientSearchTerm(value.trim());
}

export function isPatientSearchTermValid(value: string = '') {
  const normalizedValue = normalizePatientSearchTerm(value);
  return normalizedValue.length >= MIN_PATIENT_SEARCH_CHARACTERS;
}
