import { omrsOfflineCachingStrategyHttpHeaderName, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

import { personDocumentNumberAttributeTypeUuid, personDocumentTypeAttributeTypeUuid } from './identity-documents';

export interface LocalPatientIdentityMatch {
  kind: 'patient';
  uuid: string;
  display: string;
  identifier?: string;
  identifierTypeUuid?: string;
}

export interface LocalPersonIdentityMatch {
  kind: 'person';
  uuid: string;
  display: string;
  documentNumber: string;
  documentTypeConceptUuid?: string;
}

export type LocalIdentityMatch = LocalPatientIdentityMatch | LocalPersonIdentityMatch;

export interface LocalIdentityDocumentFilter {
  patientIdentifierTypeUuid?: string;
  personDocumentTypeConceptUuid?: string;
}

export interface LocalIdentitySearchOptions {
  /**
   * Clinical creation preflights must never accept a service-worker or HTTP
   * cache hit as evidence that an identifier is unused.
   */
  requireFreshNetwork?: boolean;
  signal?: AbortSignal;
}

interface PatientIdentitySearchResult {
  uuid: string;
  display: string;
  person?: { uuid: string; display: string };
  identifiers?: Array<{ identifier: string; identifierType: { uuid: string } }>;
}

interface IdentitySearchPage<T> {
  results?: Array<T>;
  links?: Array<{ rel?: string; uri?: string }>;
}

export interface FreshPatientIdentity {
  uuid: string;
  voided?: boolean;
  identifiers?: Array<{
    identifier?: string;
    location?: string | { uuid?: string } | null;
    preferred?: boolean;
    voided?: boolean;
    identifierType?: { uuid?: string };
  }>;
  person?: {
    uuid?: string;
    voided?: boolean;
    gender?: string;
    birthdate?: string;
    birthdateEstimated?: boolean;
    dead?: boolean;
    names?: Array<{
      preferred?: boolean;
      voided?: boolean;
      givenName?: string;
      middleName?: string;
      familyName?: string;
      familyName2?: string;
    }>;
    addresses?: Array<{
      preferred?: boolean;
      voided?: boolean;
      address4?: string;
      cityVillage?: string;
    }>;
    attributes?: Array<{ voided?: boolean }>;
  };
}

export const freshPatientIdentityErrorMessage = 'The patient identity could not be verified.';
const maxFreshIdentityPages = 20;

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
  filter: LocalIdentityDocumentFilter = {},
  options: LocalIdentitySearchOptions = {},
): Promise<Array<LocalIdentityMatch>> {
  const encodedNumber = encodeURIComponent(normalizedDocumentNumber);
  const patientRepresentation =
    'custom:(uuid,display,person:(uuid,display),identifiers:(identifier,identifierType:(uuid)))';
  const personRepresentation = 'custom:(uuid,display,attributes:(value,attributeType:(uuid)))';

  const patientUrl = `${restBaseUrl}/patient?q=${encodedNumber}&v=${patientRepresentation}`;
  const personUrl = `${restBaseUrl}/person?q=${encodedNumber}&v=${personRepresentation}`;
  const requestOptions = options.requireFreshNetwork
    ? {
        cache: 'no-store' as const,
        headers: {
          [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only' as const,
        },
        rejectOnAuthFailure: true,
        signal: options.signal ?? abortController?.signal,
      }
    : { signal: options.signal ?? abortController?.signal };

  const [patients, persons] = options.requireFreshNetwork
    ? await Promise.all([
        fetchAllFreshIdentityPages<PatientIdentitySearchResult>(patientUrl, requestOptions),
        fetchAllFreshIdentityPages<PersonIdentitySearchResult>(personUrl, requestOptions),
      ])
    : await Promise.all([
        openmrsFetch<IdentitySearchPage<PatientIdentitySearchResult>>(patientUrl, requestOptions).then(
          (response) => response.data.results ?? [],
        ),
        openmrsFetch<IdentitySearchPage<PersonIdentitySearchResult>>(personUrl, requestOptions).then(
          (response) => response.data.results ?? [],
        ),
      ]);

  const matches: Array<LocalIdentityMatch> = [];
  const patientsByPersonUuid = new Map(patients.map((patient) => [patient.person?.uuid ?? patient.uuid, patient]));

  for (const patient of patients) {
    const exactIdentifier = patient.identifiers?.find(
      (identifier) =>
        identifier.identifier?.toUpperCase() === normalizedDocumentNumber.toUpperCase() &&
        (!filter.patientIdentifierTypeUuid || identifier.identifierType.uuid === filter.patientIdentifierTypeUuid),
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

  for (const person of persons) {
    if (matchedPersonUuids.has(person.uuid)) {
      continue;
    }

    const { documentNumber, documentTypeConceptUuid } = getPersonDocumentAttributes(person);

    const isCompatibleDocumentType =
      !filter.personDocumentTypeConceptUuid ||
      !documentTypeConceptUuid ||
      documentTypeConceptUuid === filter.personDocumentTypeConceptUuid;

    if (documentNumber?.toUpperCase() === normalizedDocumentNumber.toUpperCase() && isCompatibleDocumentType) {
      const existingPatient = patientsByPersonUuid.get(person.uuid);
      if (existingPatient) {
        matches.push({
          kind: 'patient',
          uuid: person.uuid,
          display: existingPatient.person?.display ?? existingPatient.display ?? person.display,
          identifier: documentNumber,
          identifierTypeUuid: filter.patientIdentifierTypeUuid,
        });
        matchedPersonUuids.add(person.uuid);
        continue;
      }

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

function getIdentitySearchUrl(url: string, requireFreshNetwork = false) {
  if (!requireFreshNetwork) {
    return url;
  }

  const requestUrl = new URL(url, globalThis.location.origin);
  requestUrl.searchParams.set('_bulkPatientImportCheck', globalThis.crypto.randomUUID());
  return requestUrl.href;
}

async function fetchAllFreshIdentityPages<T>(
  initialUrl: string,
  requestOptions: Parameters<typeof openmrsFetch>[1],
): Promise<Array<T>> {
  const results: Array<T> = [];
  const visited = new Set<string>();
  let nextUrl: string | undefined = initialUrl;
  const restPath = `${new URL(restBaseUrl, globalThis.location.origin).pathname.replace(/\/$/, '')}/`;

  for (let page = 0; nextUrl && page < maxFreshIdentityPages; page++) {
    const linkedUrl = new URL(nextUrl, globalThis.location.origin);
    if (!linkedUrl.pathname.startsWith(restPath)) {
      throw new Error(freshPatientIdentityErrorMessage);
    }
    const canonicalUrl = new URL(`${linkedUrl.pathname}${linkedUrl.search}`, globalThis.location.origin);
    canonicalUrl.searchParams.delete('_bulkPatientImportCheck');
    const pageKey = canonicalUrl.href;
    if (visited.has(pageKey)) {
      throw new Error(freshPatientIdentityErrorMessage);
    }
    visited.add(pageKey);

    const response = await openmrsFetch<IdentitySearchPage<T>>(getIdentitySearchUrl(pageKey, true), requestOptions);
    if (response.ok !== true) {
      throw new Error(freshPatientIdentityErrorMessage);
    }
    results.push(...(response.data.results ?? []));
    nextUrl = response.data.links?.find((link) => link.rel === 'next')?.uri;
  }

  if (nextUrl) {
    throw new Error(freshPatientIdentityErrorMessage);
  }
  return results;
}

/**
 * Reads a patient directly by UUID without accepting cached state. A 404 is a
 * useful absence result during preflight; every other failure remains fatal.
 */
export async function fetchFreshPatientIdentityByUuid(
  patientUuid: string,
  signal?: AbortSignal,
): Promise<FreshPatientIdentity | null> {
  const representation =
    'custom:(uuid,voided,identifiers:(identifier,preferred,voided,identifierType:(uuid),location:(uuid)),' +
    'person:(uuid,voided,gender,birthdate,' +
    'birthdateEstimated,dead,attributes:(voided),' +
    'names:(preferred,voided,givenName,middleName,familyName,familyName2),' +
    'addresses:(preferred,voided,address4,cityVillage)))';
  const url = getIdentitySearchUrl(
    `${restBaseUrl}/patient/${encodeURIComponent(patientUuid)}?v=${representation}`,
    true,
  );

  try {
    const response = await openmrsFetch<FreshPatientIdentity>(url, {
      cache: 'no-store',
      headers: {
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
      rejectOnAuthFailure: true,
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(freshPatientIdentityErrorMessage);
    }

    return response.data;
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      return null;
    }

    throw new Error(freshPatientIdentityErrorMessage);
  }
}

function getHttpStatus(error: unknown) {
  return typeof error === 'object' && error !== null
    ? ((error as { response?: { status?: number }; status?: number }).response?.status ??
        (error as { status?: number }).status)
    : undefined;
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
    const status = getHttpStatus(error);

    if (status === 404 || (error instanceof Error && /\b404\b/.test(error.message))) {
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
