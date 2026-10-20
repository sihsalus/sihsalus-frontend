import { omrsOfflineCachingStrategyHttpHeaderName, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

/** OID del sistema de identificación DNI en Perú (Dyaku/RENHICE FHIR) */
export const DNI_SYSTEM = 'urn:oid:2.16.840.1.113883.3.9143.2.1.5';
const DNI_TYPE_SYSTEM = 'https://www.gob.pe/minsa/RENHICE/fhir/CodeSystem/IdspersonaPeru';

export interface DyakuPatient {
  resourceType: 'Patient';
  id: string;
  meta?: {
    profile?: string[];
  };
  active?: boolean;
  identifier?: Array<{
    system?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    value?: string;
  }>;
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
  telecom?: Array<{
    system?: 'email' | 'phone';
    value?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface DyakuPatientsResponse {
  resourceType: 'Bundle';
  id: string;
  type: 'searchset';
  total?: number;
  entry?: Array<{
    resource: DyakuPatient;
  }>;
}

export interface SyncResult {
  success: boolean;
  synchronized: number;
  failed: number;
  errors: DyakuSyncErrorCode[];
}

export function useDyakuPatients(page?: number, size: number = 10) {
  const config = useConfig<ConfigObject>();
  const dyakuConfig = config.dyaku;

  const searchParams = new URLSearchParams();
  if (page) searchParams.append('_page', page.toString());
  searchParams.append('_count', size.toString());

  const url = `${dyakuConfig.fhirBaseUrl}/Patient?${searchParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{ data: DyakuPatientsResponse }, Error>(url, () =>
    fetchDyakuPatients(url),
  );

  return {
    data: data?.data?.entry?.map((entry) => entry.resource) || [],
    total: data?.data?.total || 0,
    error,
    isLoading,
    mutate,
  };
}

async function fetchDyakuPatients(url: string): Promise<{ data: DyakuPatientsResponse }> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
    mode: 'cors',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new DyakuSyncError('syncRemoteResponseInvalid');
  }

  const data: DyakuPatientsResponse = await response.json();
  if (
    data?.resourceType !== 'Bundle' ||
    data.type !== 'searchset' ||
    (data.entry !== undefined &&
      (!Array.isArray(data.entry) || data.entry.some((entry) => !isPatientResource(entry?.resource))))
  ) {
    throw new DyakuSyncError('syncRemoteResponseInvalid');
  }
  return { data };
}

export async function getDyakuPatientById(patientId: string, fhirBaseUrl: string): Promise<DyakuPatient> {
  const url = `${fhirBaseUrl}/Patient/${encodeURIComponent(patientId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
    mode: 'cors',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new DyakuSyncError('syncRemoteResponseInvalid');
  }

  const patient: DyakuPatient = await response.json();
  if (!isPatientResource(patient) || patient.id !== patientId) {
    throw new DyakuSyncError('syncRemoteResponseInvalid');
  }
  return patient;
}

export type DyakuSyncErrorCode =
  | 'syncIdentityInvalid'
  | 'syncIdentityAmbiguous'
  | 'syncLocalLookupFailed'
  | 'syncMetadataInvalid'
  | 'syncPatientDataInvalid'
  | 'syncWriteUnconfirmed'
  | 'syncDuplicateInBatch'
  | 'syncRemoteResponseInvalid'
  | 'syncImportFailed';

class DyakuSyncError extends Error {
  constructor(readonly code: DyakuSyncErrorCode) {
    super(code);
  }
}

// Only controlled translation keys leave the resource layer, never remote error
// text, URLs, document numbers, names or resource IDs.
export function getDyakuSyncErrorCode(error: unknown): DyakuSyncErrorCode {
  return error instanceof DyakuSyncError ? error.code : 'syncImportFailed';
}

function isPatientResource(patient: DyakuPatient): boolean {
  const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
  return (
    patient?.resourceType === 'Patient' &&
    typeof patient.id === 'string' &&
    patient.id.length > 0 &&
    (patient.active === undefined || typeof patient.active === 'boolean') &&
    (patient.gender === undefined || ['male', 'female', 'other', 'unknown'].includes(patient.gender)) &&
    optionalString(patient.birthDate) &&
    (patient.name === undefined ||
      (Array.isArray(patient.name) &&
        patient.name.every(
          (name) =>
            name &&
            optionalString(name.family) &&
            (name.given === undefined ||
              (Array.isArray(name.given) && name.given.every((given) => typeof given === 'string'))),
        ))) &&
    (patient.telecom === undefined ||
      (Array.isArray(patient.telecom) &&
        patient.telecom.every((item) => item && optionalString(item.system) && optionalString(item.value)))) &&
    (patient.identifier === undefined ||
      (Array.isArray(patient.identifier) &&
        patient.identifier.every(
          (identifier) =>
            identifier &&
            optionalString(identifier.system) &&
            optionalString(identifier.value) &&
            (identifier.type === undefined ||
              (identifier.type &&
                typeof identifier.type === 'object' &&
                (identifier.type.coding === undefined ||
                  (Array.isArray(identifier.type.coding) &&
                    identifier.type.coding.every(
                      (coding) => coding && optionalString(coding.system) && optionalString(coding.code),
                    ))))),
        )))
  );
}

/** Validation only. Identity values must never be silently repaired or truncated. */
export function validateAndFixPeruvianDNI(dni: string): string | null {
  return typeof dni === 'string' && /^[0-9]{8}$/.test(dni) ? dni : null;
}

/** The legacy identifier OID and the official Peruvian type are explicit DNI evidence. */
export function getDniFromDyakuPatient(patient: DyakuPatient): string | null {
  if (!Array.isArray(patient.identifier)) return null;
  const values = new Set<string>();
  for (const identifier of patient.identifier) {
    if (!identifier || (identifier.type?.coding !== undefined && !Array.isArray(identifier.type.coding))) return null;
    const officialTypes = identifier.type?.coding?.filter((coding) => coding?.system === DNI_TYPE_SYSTEM) ?? [];
    const isDni = identifier?.system === DNI_SYSTEM || officialTypes.some((coding) => coding.code === '1');
    if (!isDni) continue;
    if (officialTypes.some((coding) => coding.code !== '1')) return null;
    const dni = identifier.value && validateAndFixPeruvianDNI(identifier.value);
    if (!dni) return null;
    values.add(dni);
  }
  return values.size === 1 ? [...values][0] : null;
}

const freshReadOptions = {
  cache: 'no-store' as const,
  rejectOnAuthFailure: true,
  headers: { [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only' },
};

interface LocalPatient {
  uuid: string;
  voided: boolean;
  identifiers: Array<{
    identifier: string;
    voided: boolean;
    identifierType: { uuid: string };
  }>;
}

async function findPatientByIdentifier(identifier: string, identifierType: string): Promise<LocalPatient | null> {
  const representation = 'custom:(uuid,voided,identifiers:(identifier,voided,identifierType:(uuid)))';
  const query = new URLSearchParams({
    identifier,
    v: representation,
    // A unique URL also prevents an offline service-worker cache hit from
    // establishing that a patient does not exist. Same pattern as registration.
    _dyakuIdentityCheck: globalThis.crypto.randomUUID(),
  });
  try {
    const response = await openmrsFetch<{
      results: LocalPatient[];
      links?: Array<{ rel: string }>;
    }>(`/ws/rest/v1/patient?${query}`, freshReadOptions);
    if (
      response.ok !== true ||
      !Array.isArray(response.data?.results) ||
      (response.data.links !== undefined &&
        (!Array.isArray(response.data.links) || response.data.links.some((link) => link?.rel === 'next')))
    ) {
      throw new DyakuSyncError('syncLocalLookupFailed');
    }
    const patients = response.data.results;
    if (patients.length === 0) return null;
    // Do not guess among duplicates, fuzzy results, voided patients, malformed
    // data or identifiers of another type, even when the server returned them.
    if (
      patients.length !== 1 ||
      typeof patients[0]?.uuid !== 'string' ||
      !patients[0].uuid.trim() ||
      patients[0].voided !== false ||
      !Array.isArray(patients[0].identifiers) ||
      !patients[0].identifiers.some(
        (id) => id?.voided === false && id.identifier === identifier && id.identifierType?.uuid === identifierType,
      )
    ) {
      throw new DyakuSyncError('syncIdentityAmbiguous');
    }
    return patients[0];
  } catch (error) {
    if (error instanceof DyakuSyncError) throw error;
    throw new DyakuSyncError('syncLocalLookupFailed');
  }
}

function mapPerson(patient: DyakuPatient, config: ConfigObject, creating: boolean): Record<string, unknown> {
  const person: Record<string, unknown> = {};
  if (patient.name !== undefined && !Array.isArray(patient.name)) {
    throw new DyakuSyncError('syncPatientDataInvalid');
  }
  if (patient.name?.length) {
    const name = patient.name[0];
    if (
      !name?.family?.trim() ||
      !Array.isArray(name.given) ||
      !name.given.length ||
      name.given.some((given) => typeof given !== 'string' || !given.trim())
    ) {
      throw new DyakuSyncError('syncPatientDataInvalid');
    }
    person.names = [{ givenName: name.given.join(' '), familyName: name.family, preferred: true }];
  }
  if (patient.gender !== undefined) {
    const gender = { male: 'M', female: 'F', other: 'U', unknown: 'U' }[patient.gender];
    if (!gender) throw new DyakuSyncError('syncPatientDataInvalid');
    person.gender = gender;
  }
  if (patient.birthDate !== undefined) {
    const value = patient.birthDate;
    const date = new Date(`${value}T00:00:00Z`);
    if (
      typeof value !== 'string' ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
      value.startsWith('0000') ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new DyakuSyncError('syncPatientDataInvalid');
    }
    person.birthdate = value;
  }
  if (creating && (!person.names || !person.gender || !person.birthdate)) {
    throw new DyakuSyncError('syncPatientDataInvalid');
  }
  if (patient.telecom !== undefined && !Array.isArray(patient.telecom)) {
    throw new DyakuSyncError('syncPatientDataInvalid');
  }
  const attributes = (['email', 'phone'] as const).flatMap((system) => {
    const value = patient.telecom?.find((telecom) => telecom.system === system)?.value;
    if (value === undefined || value === '') return [];
    if (typeof value !== 'string' || !value.trim()) throw new DyakuSyncError('syncPatientDataInvalid');
    return [
      {
        attributeType: system === 'email' ? config.dyaku.emailAttributeTypeUuid : config.dyaku.phoneAttributeTypeUuid,
        value,
      },
    ];
  });
  if (attributes.length) person.attributes = attributes;
  return person;
}

async function identifierLocation(identifierType: string, configuredLocation: string): Promise<{ location?: string }> {
  const response = await openmrsFetch<{ uuid: string; retired: boolean; locationBehavior: string }>(
    `/ws/rest/v1/patientidentifiertype/${encodeURIComponent(identifierType)}?v=full`,
    freshReadOptions,
  );
  if (response.ok !== true || response.data?.uuid !== identifierType || response.data.retired !== false) {
    throw new DyakuSyncError('syncMetadataInvalid');
  }
  if (response.data.locationBehavior === 'NOT_USED') return {};
  if (response.data.locationBehavior !== 'REQUIRED' || !configuredLocation) {
    throw new DyakuSyncError('syncMetadataInvalid');
  }
  const location = await openmrsFetch<{ uuid: string; retired: boolean }>(
    `/ws/rest/v1/location/${encodeURIComponent(configuredLocation)}?v=default`,
    freshReadOptions,
  );
  if (location.ok !== true || location.data?.uuid !== configuredLocation || location.data.retired !== false) {
    throw new DyakuSyncError('syncMetadataInvalid');
  }
  return { location: configuredLocation };
}

async function createPatientInOpenMRS(patient: DyakuPatient, dni: string, config: ConfigObject): Promise<void> {
  const person = mapPerson(patient, config, true);
  const { identifierSourceUuid, dniIdentifierTypeUuid, hscIdentifierTypeUuid, defaultLocationUuid } = config.dyaku;
  const [hceLocation, dniLocation] = await Promise.all([
    identifierLocation(hscIdentifierTypeUuid, defaultLocationUuid),
    identifierLocation(dniIdentifierTypeUuid, defaultLocationUuid),
  ]);
  const response = await openmrsFetch<{ identifier: string }>(
    `/ws/rest/v1/idgen/identifiersource/${encodeURIComponent(identifierSourceUuid)}/identifier`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: {}, rejectOnAuthFailure: true },
  );
  if (response.ok !== true || typeof response.data?.identifier !== 'string' || !response.data.identifier.trim()) {
    throw new DyakuSyncError('syncWriteUnconfirmed');
  }
  await savePatient({
    person,
    identifiers: [
      { identifier: response.data.identifier, identifierType: hscIdentifierTypeUuid, preferred: true, ...hceLocation },
      { identifier: dni, identifierType: dniIdentifierTypeUuid, preferred: false, ...dniLocation },
    ],
  });
}

async function savePatient(body: Record<string, unknown>, uuid?: string): Promise<void> {
  try {
    const response = await openmrsFetch<{ uuid: string }>(
      `/ws/rest/v1/patient${uuid ? `/${encodeURIComponent(uuid)}` : ''}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        rejectOnAuthFailure: true,
      },
    );
    if (
      response.ok !== true ||
      typeof response.data?.uuid !== 'string' ||
      !response.data.uuid ||
      (uuid && response.data.uuid !== uuid)
    ) {
      throw new DyakuSyncError('syncWriteUnconfirmed');
    }
  } catch {
    // A failed response does not prove the write was rolled back. Never retry
    // automatically; the next user attempt must repeat the fresh identity check.
    throw new DyakuSyncError('syncWriteUnconfirmed');
  }
}

// In-memory only: concurrent buttons in this browser must not race the same DNI.
// Uniqueness across different clients remains the backend's responsibility.
const syncingDnis = new Set<string>();

async function syncPatient(patient: DyakuPatient, config: ConfigObject): Promise<void> {
  if (!isPatientResource(patient)) throw new DyakuSyncError('syncRemoteResponseInvalid');
  const dni = getDniFromDyakuPatient(patient);
  if (patient.active === false || !dni) {
    throw new DyakuSyncError('syncIdentityInvalid');
  }
  if (syncingDnis.has(dni)) throw new DyakuSyncError('syncDuplicateInBatch');
  syncingDnis.add(dni);
  try {
    const existing = await findPatientByIdentifier(dni, config.dyaku.dniIdentifierTypeUuid);
    if (existing) {
      // Do not send identifiers, default demographics or empty collections.
      // OpenMRS retains every local value absent from this update payload.
      const person = mapPerson(patient, config, false);
      if (Object.keys(person).length) await savePatient({ person }, existing.uuid);
    } else {
      await createPatientInOpenMRS(patient, dni, config);
    }
  } finally {
    syncingDnis.delete(dni);
  }
}

const CHUNK_SIZE = 10;

/** Imports at most the requested first page; this is not RENHICE IPS exchange. */
export async function syncDyakuPatientsToOpenMRS(
  fhirBaseUrl: string,
  batchSize: number = 50,
  config: ConfigObject,
  onProgress?: (processed: number, total: number) => void,
): Promise<SyncResult> {
  const result: SyncResult = { success: false, synchronized: 0, failed: 0, errors: [] };
  const response = await fetchDyakuPatients(`${fhirBaseUrl}/Patient?_count=${batchSize}`);
  const patients = response.data.entry?.map((entry) => entry.resource) ?? [];
  const dniCounts = new Map<string, number>();
  const idCounts = new Map<string, number>();
  for (const patient of patients) {
    const dni = getDniFromDyakuPatient(patient);
    if (dni) dniCounts.set(dni, (dniCounts.get(dni) ?? 0) + 1);
    idCounts.set(patient.id, (idCounts.get(patient.id) ?? 0) + 1);
  }
  let processed = 0;
  for (let i = 0; i < patients.length; i += CHUNK_SIZE) {
    await Promise.all(
      patients.slice(i, i + CHUNK_SIZE).map(async (patient) => {
        try {
          const dni = getDniFromDyakuPatient(patient);
          if ((dni && (dniCounts.get(dni) ?? 0) > 1) || (idCounts.get(patient.id) ?? 0) > 1) {
            throw new DyakuSyncError('syncDuplicateInBatch');
          }
          await syncPatient(patient, config);
          result.synchronized++;
        } catch (error) {
          result.failed++;
          result.errors.push(getDyakuSyncErrorCode(error));
        } finally {
          onProgress?.(++processed, patients.length);
        }
      }),
    );
  }
  result.success = result.failed === 0;
  return result;
}

export async function syncSinglePatientToOpenMRS(patient: DyakuPatient, config: ConfigObject): Promise<SyncResult> {
  try {
    await syncPatient(patient, config);
    return { success: true, synchronized: 1, failed: 0, errors: [] };
  } catch (error) {
    return { success: false, synchronized: 0, failed: 1, errors: [getDyakuSyncErrorCode(error)] };
  }
}

export function useDyakuPatientsByIdentifier(identifier: string) {
  const config = useConfig<ConfigObject>();
  const dyakuConfig = config.dyaku;

  // System-scoped search: DNI_SYSTEM|<value> → exact match, no false positives
  const url = identifier
    ? `${dyakuConfig.fhirBaseUrl}/Patient?identifier=${encodeURIComponent(`${DNI_SYSTEM}|${identifier}`)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: DyakuPatientsResponse }, Error>(
    url,
    (key: string) => fetchDyakuPatients(key),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    },
  );

  return {
    data: data?.data?.entry?.map((entry) => entry.resource) || [],
    total: data?.data?.total || 0,
    error,
    isLoading,
    mutate,
  };
}

export function useDyakuSync() {
  const config = useConfig<ConfigObject>();
  const dyakuConfig = config.dyaku;

  const syncPatients = (onProgress?: (processed: number, total: number) => void): Promise<SyncResult> => {
    if (!dyakuConfig.syncEnabled) {
      throw new Error('Sincronización deshabilitada en la configuración');
    }
    return syncDyakuPatientsToOpenMRS(dyakuConfig.fhirBaseUrl, dyakuConfig.syncBatchSize, config, onProgress);
  };

  const syncSinglePatient = (patient: DyakuPatient): Promise<SyncResult> => {
    if (!dyakuConfig.syncEnabled) {
      throw new Error('Sincronización deshabilitada en la configuración');
    }
    return syncSinglePatientToOpenMRS(patient, config);
  };

  return {
    syncPatients,
    syncSinglePatient,
    isEnabled: dyakuConfig.syncEnabled,
    batchSize: dyakuConfig.syncBatchSize,
    intervalMinutes: dyakuConfig.syncIntervalMinutes,
  };
}
