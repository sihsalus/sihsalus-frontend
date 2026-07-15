import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { type Patient } from './patient-registration.types';
import { type PatientCreationIdentifierCheckpoint } from './patient-creation-checkpoint';

export const PATIENT_CREATION_AMBIGUOUS = 'PATIENT_CREATION_AMBIGUOUS';
export const PATIENT_CREATION_CONFLICT = 'PATIENT_CREATION_CONFLICT';
export const PATIENT_CREATION_CHECKPOINT_UNAVAILABLE = 'PATIENT_CREATION_CHECKPOINT_UNAVAILABLE';
export const PATIENT_REGISTRATION_INCOMPLETE = 'PATIENT_REGISTRATION_INCOMPLETE';

export class PatientCreationAmbiguousError extends Error {
  readonly code = PATIENT_CREATION_AMBIGUOUS;

  constructor() {
    super('The patient creation result is pending verification.');
    this.name = 'PatientCreationAmbiguousError';
  }
}

export class PatientCreationConflictError extends Error {
  readonly code = PATIENT_CREATION_CONFLICT;

  constructor() {
    super('The patient creation checkpoint conflicts with an existing patient or the current form.');
    this.name = 'PatientCreationConflictError';
  }
}

export class PatientCreationCheckpointUnavailableError extends Error {
  readonly code = PATIENT_CREATION_CHECKPOINT_UNAVAILABLE;

  constructor() {
    super('The patient creation could not be safely checkpointed.');
    this.name = 'PatientCreationCheckpointUnavailableError';
  }
}

export class PatientRegistrationIncompleteError extends Error {
  readonly code = PATIENT_REGISTRATION_INCOMPLETE;
  readonly patientUuid?: string;

  constructor(patientUuid?: string) {
    super('The patient exists, but the remaining registration writes require manual verification.');
    this.name = 'PatientRegistrationIncompleteError';
    this.patientUuid = patientUuid;
  }
}

class PatientCreationVerificationError extends Error {
  constructor(message = 'The patient creation could not be verified.') {
    super(message);
    this.name = 'PatientCreationVerificationError';
  }
}

interface ReconciliationIdentifier {
  identifier?: string;
  preferred?: boolean;
  voided?: boolean;
  identifierType?: { uuid?: string };
  location?: { uuid?: string };
}

interface ReconciliationName {
  preferred?: boolean;
  voided?: boolean;
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  familyName2?: string | null;
}

interface ReconciliationAddress {
  preferred?: boolean;
  voided?: boolean;
  [field: string]: unknown;
}

interface ReconciliationAttribute {
  voided?: boolean;
  value?: unknown;
  attributeType?: { uuid?: string };
}

interface ReconciliationPatient {
  uuid?: string;
  voided?: boolean;
  identifiers?: Array<ReconciliationIdentifier>;
  person?: {
    uuid?: string;
    voided?: boolean;
    gender?: string;
    birthdate?: string;
    birthdateEstimated?: boolean;
    dead?: boolean;
    deathDate?: string | null;
    causeOfDeath?: { uuid?: string } | string | null;
    causeOfDeathNonCoded?: string | null;
    preferredName?: {
      givenName?: string;
      middleName?: string;
      familyName?: string;
      familyName2?: string;
    };
    names?: Array<ReconciliationName>;
    addresses?: Array<ReconciliationAddress>;
    attributes?: Array<ReconciliationAttribute>;
  };
}

interface PatientSearchResponse {
  results?: Array<ReconciliationPatient>;
}

const representation =
  'custom:(uuid,voided,identifiers:(identifier,preferred,voided,identifierType:(uuid),location:(uuid)),person:(uuid,voided,gender,birthdate,birthdateEstimated,dead,deathDate,causeOfDeath:(uuid),causeOfDeathNonCoded,preferredName:(givenName,middleName,familyName,familyName2),names:(preferred,voided,givenName,middleName,familyName,familyName2),addresses:(preferred,voided,address1,address2,address3,address4,address5,address6,address7,address8,address9,address10,address11,address12,address13,address14,address15,cityVillage,stateProvince,countyDistrict,postalCode,country),attributes:(voided,value,attributeType:(uuid))))';

const addressFields = [
  'address1',
  'address2',
  'address3',
  'address4',
  'address5',
  'address6',
  'address7',
  'address8',
  'address9',
  'address10',
  'address11',
  'address12',
  'address13',
  'address14',
  'address15',
  'cityVillage',
  'stateProvince',
  'countyDistrict',
  'postalCode',
  'country',
] as const;

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase() : '';
const normalizeIdentifier = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFC').trim() : '';
const normalizeDate = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : '');
const normalizeDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? String(timestamp) : value.trim();
};
const normalizeResourceValue = (value: unknown) => {
  if (typeof value === 'object' && value !== null && 'uuid' in value) {
    return normalizeIdentifier((value as { uuid?: unknown }).uuid);
  }
  return normalizeIdentifier(value);
};
const sortedSignatures = <T>(items: Array<T>, signature: (item: T) => string) => items.map(signature).sort();
const signaturesMatch = (left: Array<string>, right: Array<string>) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

function assertValidPatient(patient: ReconciliationPatient) {
  if (
    !patient ||
    typeof patient !== 'object' ||
    typeof patient.uuid !== 'string' ||
    !patient.uuid.trim() ||
    patient.voided !== false ||
    !Array.isArray(patient.identifiers) ||
    !patient.person ||
    patient.person.voided !== false ||
    typeof patient.person.gender !== 'string' ||
    typeof patient.person.birthdate !== 'string' ||
    typeof patient.person.birthdateEstimated !== 'boolean' ||
    typeof patient.person.dead !== 'boolean' ||
    !patient.person.preferredName ||
    !Array.isArray(patient.person.names) ||
    patient.person.names.length === 0 ||
    !Array.isArray(patient.person.addresses) ||
    !Array.isArray(patient.person.attributes)
  ) {
    throw new PatientCreationVerificationError('The patient reconciliation returned an invalid patient.');
  }

  if (
    patient.identifiers.some(
      (identifier) =>
        typeof identifier.identifier !== 'string' ||
        typeof identifier.preferred !== 'boolean' ||
        typeof identifier.voided !== 'boolean' ||
        typeof identifier.identifierType?.uuid !== 'string' ||
        typeof identifier.location?.uuid !== 'string',
    )
  ) {
    throw new PatientCreationVerificationError('The patient reconciliation returned an invalid identifier.');
  }

  if (
    patient.person.names.some(
      (name) => !name || typeof name !== 'object' || typeof name.preferred !== 'boolean' || typeof name.voided !== 'boolean',
    ) ||
    patient.person.addresses.some(
      (address) =>
        !address ||
        typeof address !== 'object' ||
        typeof address.preferred !== 'boolean' ||
        typeof address.voided !== 'boolean',
    ) ||
    patient.person.attributes.some(
      (attribute) =>
        !attribute ||
        typeof attribute !== 'object' ||
        typeof attribute.voided !== 'boolean' || typeof attribute.attributeType?.uuid !== 'string',
    )
  ) {
    throw new PatientCreationVerificationError('The patient reconciliation returned invalid person details.');
  }
}

function patientMatchesDemographics(patient: ReconciliationPatient, payload: Patient) {
  const expectedName = payload.person.names.find((name) => name.preferred) ?? payload.person.names[0];
  const actualName = patient.person?.preferredName;
  if (!expectedName || !actualName) {
    return false;
  }

  const actualNames = sortedSignatures(
    (patient.person?.names ?? []).filter((name) => name.voided === false),
    (name) =>
      [
        name.preferred ? 'preferred' : 'not-preferred',
        normalizeText(name.givenName),
        normalizeText(name.middleName),
        normalizeText(name.familyName),
        normalizeText(name.familyName2),
      ].join('\u001f'),
  );
  const expectedNames = sortedSignatures(payload.person.names, (name) =>
    [
      name.preferred ? 'preferred' : 'not-preferred',
      normalizeText(name.givenName),
      normalizeText(name.middleName),
      normalizeText(name.familyName),
      normalizeText(name.familyName2),
    ].join('\u001f'),
  );
  const actualAddresses = sortedSignatures(
    (patient.person?.addresses ?? []).filter((address) => address.voided === false),
    (address) =>
      [
        address.preferred ? 'preferred' : 'not-preferred',
        ...addressFields.map((field) => normalizeText(address[field])),
      ].join('\u001f'),
  );
  const expectedAddresses = sortedSignatures(payload.person.addresses, (address) =>
    [
      address.preferred ? 'preferred' : 'not-preferred',
      ...addressFields.map((field) => normalizeText(address[field])),
    ].join('\u001f'),
  );
  const actualAttributes = sortedSignatures(
    (patient.person?.attributes ?? []).filter((attribute) => attribute.voided === false),
    (attribute) =>
      `${attribute.attributeType?.uuid ?? ''}\u001f${normalizeResourceValue(attribute.value)}`,
  );
  const expectedAttributes = sortedSignatures(
    payload.person.attributes,
    (attribute) => `${attribute.attributeType}\u001f${normalizeResourceValue(attribute.value)}`,
  );
  const expectedDeath = payload.person as Patient['person'] & { causeOfDeathNonCoded?: string | null };
  const actualCauseOfDeath = normalizeResourceValue(patient.person?.causeOfDeath);
  const expectedCauseOfDeath = normalizeResourceValue(expectedDeath.causeOfDeath);

  return (
    normalizeText(patient.person?.gender) === normalizeText(payload.person.gender) &&
    normalizeDate(patient.person?.birthdate) === normalizeDate(payload.person.birthdate) &&
    patient.person?.birthdateEstimated === payload.person.birthdateEstimated &&
    patient.person?.dead === payload.person.dead &&
    normalizeDateTime(patient.person?.deathDate) === normalizeDateTime(payload.person.deathDate) &&
    actualCauseOfDeath === expectedCauseOfDeath &&
    normalizeText(patient.person?.causeOfDeathNonCoded) === normalizeText(expectedDeath.causeOfDeathNonCoded) &&
    normalizeText(actualName.givenName) === normalizeText(expectedName.givenName) &&
    normalizeText(actualName.middleName) === normalizeText(expectedName.middleName) &&
    normalizeText(actualName.familyName) === normalizeText(expectedName.familyName) &&
    normalizeText(actualName.familyName2) === normalizeText(expectedName.familyName2) &&
    signaturesMatch(actualNames, expectedNames) &&
    signaturesMatch(actualAddresses, expectedAddresses) &&
    signaturesMatch(actualAttributes, expectedAttributes)
  );
}

function patientMatchesIdentifiers(
  patient: ReconciliationPatient,
  expectedIdentifiers: Array<PatientCreationIdentifierCheckpoint>,
) {
  const actualIdentifiers = patient.identifiers ?? [];
  for (const expected of expectedIdentifiers) {
    const sameValue = actualIdentifiers.filter(
      (identifier) => normalizeIdentifier(identifier.identifier) === normalizeIdentifier(expected.identifier),
    );
    const exact = sameValue.filter(
      (identifier) =>
        identifier.voided === false &&
        identifier.identifierType?.uuid === expected.identifierTypeUuid &&
        identifier.location?.uuid === expected.locationUuid &&
        identifier.preferred === expected.preferred,
    );
    if (sameValue.length !== 1 || exact.length !== 1) {
      return false;
    }
  }
  return true;
}

function classifyPatient(
  patient: ReconciliationPatient,
  expectedIdentifiers: Array<PatientCreationIdentifierCheckpoint>,
  payload: Patient,
) {
  const primary = expectedIdentifiers.find((identifier) => identifier.preferred) ?? expectedIdentifiers[0];
  const hasPrimaryValue = patient.identifiers?.some(
    (identifier) => normalizeIdentifier(identifier.identifier) === normalizeIdentifier(primary.identifier),
  );
  if (!hasPrimaryValue) {
    return false;
  }
  if (!patientMatchesIdentifiers(patient, expectedIdentifiers) || !patientMatchesDemographics(patient, payload)) {
    throw new PatientCreationConflictError();
  }
  return true;
}

export async function fetchAndVerifyCreatedPatient(
  patientUuid: string,
  identifiers: Array<PatientCreationIdentifierCheckpoint>,
  payload: Patient,
): Promise<FetchResponse<ReconciliationPatient>> {
  const response = await openmrsFetch<ReconciliationPatient>(
    `${restBaseUrl}/patient/${patientUuid}?v=${encodeURIComponent(representation)}`,
  );
  assertValidPatient(response.data);
  if (response.data.uuid !== patientUuid || !classifyPatient(response.data, identifiers, payload)) {
    throw new PatientCreationConflictError();
  }
  return response;
}

export async function reconcilePatientCreation(
  identifiers: Array<PatientCreationIdentifierCheckpoint>,
  payload: Patient,
): Promise<FetchResponse<ReconciliationPatient> | null> {
  const primary = identifiers.find((identifier) => identifier.preferred) ?? identifiers[0];
  if (!primary) {
    throw new PatientCreationVerificationError('No patient identifier is available for reconciliation.');
  }

  const pageSize = 100;
  const seen = new Set<string>();
  const matches: Array<ReconciliationPatient> = [];
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const params = new URLSearchParams({
      q: primary.identifier,
      limit: String(pageSize),
      startIndex: String(pageNumber * pageSize),
      v: representation,
    });
    const response = await openmrsFetch<PatientSearchResponse>(`${restBaseUrl}/patient?${params.toString()}`);
    const page = response.data?.results;
    if (!Array.isArray(page)) {
      throw new PatientCreationVerificationError('The patient reconciliation search returned an invalid response.');
    }
    page.forEach(assertValidPatient);

    let added = 0;
    for (const patient of page) {
      if (seen.has(patient.uuid as string)) {
        continue;
      }
      seen.add(patient.uuid as string);
      added += 1;
      if (classifyPatient(patient, identifiers, payload)) {
        matches.push(patient);
      }
    }
    if (page.length < pageSize || added === 0) {
      break;
    }
    if (pageNumber === 99) {
      throw new PatientCreationVerificationError('The patient reconciliation search exceeded its safe page limit.');
    }
  }

  if (matches.length > 1) {
    throw new PatientCreationConflictError();
  }
  if (!matches.length) {
    return null;
  }
  return fetchAndVerifyCreatedPatient(matches[0].uuid as string, identifiers, payload);
}

export function isDefinitivePatientCreateRejection(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { status?: unknown; responseStatus?: unknown; response?: { status?: unknown } };
  const status = candidate.status ?? candidate.responseStatus ?? candidate.response?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && ![408, 425, 429, 499].includes(status);
}
