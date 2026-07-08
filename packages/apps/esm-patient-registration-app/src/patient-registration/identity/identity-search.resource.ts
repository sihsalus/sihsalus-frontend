import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { personDocumentNumberAttributeTypeUuid, personDocumentTypeAttributeTypeUuid } from './identity-documents';

export interface LocalPatientIdentityMatch {
  kind: 'patient';
  uuid: string;
  display: string;
  identifier: string;
  identifierTypeUuid: string;
}

export interface LocalPersonIdentityMatch {
  kind: 'person';
  uuid: string;
  display: string;
  documentNumber: string;
  documentTypeConceptUuid?: string;
}

export type LocalIdentityMatch = LocalPatientIdentityMatch | LocalPersonIdentityMatch;

interface PatientIdentitySearchResult {
  uuid: string;
  display: string;
  person?: { uuid: string; display: string };
  identifiers?: Array<{ identifier: string; identifierType: { uuid: string } }>;
}

interface PersonIdentitySearchResult {
  uuid: string;
  display: string;
  attributes?: Array<{
    value: string | { uuid: string; display: string };
    attributeType: { uuid: string };
  }>;
}

function getPersonDocumentAttributes(person: PersonIdentitySearchResult) {
  const documentNumber = person.attributes?.find(
    (attribute) => attribute.attributeType.uuid === personDocumentNumberAttributeTypeUuid,
  )?.value;
  const documentType = person.attributes?.find(
    (attribute) => attribute.attributeType.uuid === personDocumentTypeAttributeTypeUuid,
  )?.value;

  return {
    documentNumber: typeof documentNumber === 'string' ? documentNumber : undefined,
    documentTypeConceptUuid: typeof documentType === 'object' ? documentType?.uuid : undefined,
  };
}

/**
 * Resolves a civil document number against the local database before any external
 * (RENIEC/SIS) source is consulted:
 *
 * 1. patients whose *identifier* matches the number exactly, and
 * 2. persons (not necessarily patients) whose searchable person attribute
 *    "Código de Documento de Identidad" matches the number exactly.
 *
 * Patient matches win: a person that is already a patient is reported once, as a
 * patient. `q` also fuzzy-matches names on the backend, so both result sets are
 * filtered down to exact document matches here.
 */
export async function searchLocalIdentityByDocument(
  normalizedDocumentNumber: string,
  abortController?: AbortController,
): Promise<Array<LocalIdentityMatch>> {
  const encodedNumber = encodeURIComponent(normalizedDocumentNumber);
  const patientRepresentation =
    'custom:(uuid,display,person:(uuid,display),identifiers:(identifier,identifierType:(uuid)))';
  const personRepresentation = 'custom:(uuid,display,attributes:(value,attributeType:(uuid)))';

  const [patientsRes, personsRes] = await Promise.all([
    openmrsFetch<{ results: Array<PatientIdentitySearchResult> }>(
      `${restBaseUrl}/patient?q=${encodedNumber}&v=${patientRepresentation}`,
      { signal: abortController?.signal },
    ),
    openmrsFetch<{ results: Array<PersonIdentitySearchResult> }>(
      `${restBaseUrl}/person?q=${encodedNumber}&v=${personRepresentation}`,
      { signal: abortController?.signal },
    ),
  ]);

  const matches: Array<LocalIdentityMatch> = [];

  for (const patient of patientsRes.data.results ?? []) {
    const exactIdentifier = patient.identifiers?.find(
      (identifier) => identifier.identifier?.toUpperCase() === normalizedDocumentNumber.toUpperCase(),
    );

    if (exactIdentifier) {
      matches.push({
        kind: 'patient',
        uuid: patient.person?.uuid ?? patient.uuid,
        display: patient.person?.display ?? patient.display,
        identifier: exactIdentifier.identifier,
        identifierTypeUuid: exactIdentifier.identifierType.uuid,
      });
    }
  }

  const matchedPersonUuids = new Set(matches.map((match) => match.uuid));

  for (const person of personsRes.data.results ?? []) {
    if (matchedPersonUuids.has(person.uuid)) {
      continue;
    }

    const { documentNumber, documentTypeConceptUuid } = getPersonDocumentAttributes(person);

    if (documentNumber?.toUpperCase() === normalizedDocumentNumber.toUpperCase()) {
      matches.push({
        kind: 'person',
        uuid: person.uuid,
        display: person.display,
        documentNumber,
        documentTypeConceptUuid,
      });
      matchedPersonUuids.add(person.uuid);
    }
  }

  return matches;
}

/**
 * The backend does NOT reject promoting a person who is already a patient: a second
 * `POST /patient` silently appends duplicate identifiers. Callers must run this check
 * right before promoting (see P-007, concurrent promotion).
 */
export async function isPersonAlreadyPatient(personUuid: string): Promise<boolean> {
  try {
    const response = await openmrsFetch(`${restBaseUrl}/patient/${personUuid}?v=custom:(uuid)`);
    return response.ok;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { response?: { status?: number } }).response?.status === 404
    ) {
      return false;
    }

    throw error;
  }
}

export interface PersonForPromotion {
  uuid: string;
  display: string;
  gender?: string;
  birthdate?: string;
  birthdateEstimated?: boolean;
  dead?: boolean;
  names?: Array<{
    uuid: string;
    preferred: boolean;
    givenName?: string;
    middleName?: string;
    familyName?: string;
    familyName2?: string;
  }>;
  addresses?: Array<
    {
      uuid: string;
      preferred: boolean;
    } & Record<string, unknown>
  >;
  attributes?: Array<{
    uuid: string;
    value: string | { uuid: string; display: string };
    attributeType: { uuid: string; format: string };
  }>;
}

export async function fetchPersonForPromotion(
  personUuid: string,
  abortController?: AbortController,
): Promise<PersonForPromotion> {
  const representation =
    'custom:(uuid,display,gender,birthdate,birthdateEstimated,dead,' +
    'names:(uuid,preferred,givenName,middleName,familyName,familyName2),' +
    'addresses:(uuid,preferred,address1,address2,address3,address4,address5,address6,address7,address8,' +
    'address9,address10,address11,address12,address13,address14,address15,cityVillage,stateProvince,' +
    'countyDistrict,postalCode,country),' +
    'attributes:(uuid,value,attributeType:(uuid,format)))';

  const response = await openmrsFetch<PersonForPromotion>(`${restBaseUrl}/person/${personUuid}?v=${representation}`, {
    signal: abortController?.signal,
  });

  return response.data;
}
