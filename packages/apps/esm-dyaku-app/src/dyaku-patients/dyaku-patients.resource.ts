import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';

/** OID del sistema de identificación DNI en Perú (Dyaku/RENHICE FHIR) */
export const DNI_SYSTEM = 'urn:oid:2.16.840.1.113883.3.9143.2.1.5';

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
  errors: string[];
}

export function useDyakuPatients(page?: number, size: number = 10) {
  const config = useConfig<ConfigObject>();
  const dyakuConfig = config.dyaku;

  const searchParams = new URLSearchParams();
  if (page) searchParams.append('_page', page.toString());
  searchParams.append('_count', size.toString());

  const url = `${dyakuConfig.fhirBaseUrl}/Patient?${searchParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{ data: DyakuPatientsResponse }, Error>(
    `dyaku-patients-${page}-${size}`,
    () => fetchDyakuPatients(url),
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
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return { data: await response.json() };
}

export async function getDyakuPatientById(patientId: string, fhirBaseUrl: string): Promise<DyakuPatient> {
  const url = `${fhirBaseUrl}/Patient/${patientId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function getDefaultLocation(fallbackLocationUuid: string): Promise<string> {
  try {
    const response = await openmrsFetch('/ws/rest/v1/location?v=default');
    const locations = response.data?.results || [];
    return locations.length > 0 ? locations[0].uuid : fallbackLocationUuid;
  } catch {
    return fallbackLocationUuid;
  }
}

/** Validate and normalize a Peruvian DNI to exactly 8 digits. Returns null if invalid. */
export function validateAndFixPeruvianDNI(dni: string): string | null {
  if (!dni || dni.length < 8) return null;

  const cleanDNI = dni.replace(/\D/g, '');

  if (cleanDNI.length === 8) return cleanDNI;

  // 9-digit: drop the check digit
  if (cleanDNI.length === 9) return cleanDNI.substring(0, 8);

  return null;
}

const CHUNK_SIZE = 10;

/**
 * Sync Dyaku FHIR patients to OpenMRS.
 * Processes patients in parallel chunks (CHUNK_SIZE at a time).
 * Calls onProgress(processed, total) after each patient completes.
 * Pattern from KenyaEMR esm-billing-app bulk import.
 */
export async function syncDyakuPatientsToOpenMRS(
  fhirBaseUrl: string,
  batchSize: number = 50,
  config: ConfigObject,
  onProgress?: (processed: number, total: number) => void,
): Promise<SyncResult> {
  const result: SyncResult = { success: false, synchronized: 0, failed: 0, errors: [] };

  const dyakuResponse = await fetchDyakuPatients(`${fhirBaseUrl}/Patient?_count=${batchSize}`);
  const dyakuPatients = dyakuResponse.data.entry?.map((entry) => entry.resource) || [];
  const total = dyakuPatients.length;

  let processed = 0;

  for (let i = 0; i < dyakuPatients.length; i += CHUNK_SIZE) {
    const chunk = dyakuPatients.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (dyakuPatient) => {
        try {
          const existingPatient = await findPatientByIdentifier(getDniFromDyakuPatient(dyakuPatient));
          if (!existingPatient) {
            await createPatientInOpenMRS(dyakuPatient, config);
          } else {
            await updatePatientInOpenMRS(existingPatient.uuid, dyakuPatient, config);
          }
          result.synchronized++;
        } catch (patientError) {
          result.failed++;
          result.errors.push(
            `Error procesando paciente ${dyakuPatient.id}: ${patientError instanceof Error ? patientError.message : String(patientError)}`,
          );
        } finally {
          processed++;
          onProgress?.(processed, total);
        }
      }),
    );
  }

  result.success = result.failed === 0;
  return result;
}

function getDniFromDyakuPatient(dyakuPatient: DyakuPatient): string | undefined {
  return (
    dyakuPatient.identifier?.find((id) => id.system === DNI_SYSTEM || id.type?.coding?.some((c) => c.code === 'DNI'))
      ?.value ?? dyakuPatient.identifier?.[0]?.value
  );
}

async function findPatientByIdentifier(identifier?: string): Promise<{ uuid: string } | null> {
  if (!identifier) return null;

  try {
    const response = await openmrsFetch(`/ws/rest/v1/patient?identifier=${identifier}&v=default`);
    const patients = response.data?.results || [];
    return patients.length > 0 ? patients[0] : null;
  } catch {
    return null;
  }
}

async function createPatientInOpenMRS(dyakuPatient: DyakuPatient, config: ConfigObject): Promise<void> {
  const openMRSPatient = await mapDyakuToOpenMRSPatient(dyakuPatient, config);
  await openmrsFetch('/ws/rest/v1/patient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: openMRSPatient,
  });
}

async function updatePatientInOpenMRS(
  patientUuid: string,
  dyakuPatient: DyakuPatient,
  config: ConfigObject,
): Promise<void> {
  const openMRSPatient = await mapDyakuToOpenMRSPatient(dyakuPatient, config);
  await openmrsFetch(`/ws/rest/v1/patient/${patientUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: openMRSPatient,
  });
}

async function generateAutoIdentifier(identifierSourceUuid: string): Promise<string> {
  const response = await openmrsFetch(`/ws/rest/v1/idgen/identifiersource/${identifierSourceUuid}/identifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {},
  });
  return response.data.identifier;
}

async function mapDyakuToOpenMRSPatient(
  dyakuPatient: DyakuPatient,
  config: ConfigObject,
): Promise<Record<string, unknown>> {
  const name = dyakuPatient.name?.[0];
  // Locate DNI by OID system or by type coding — real Dyaku responses use the OID system
  const identifier =
    dyakuPatient.identifier?.find((id) => id.system === DNI_SYSTEM || id.type?.coding?.some((c) => c.code === 'DNI')) ??
    dyakuPatient.identifier?.[0];
  const email = dyakuPatient.telecom?.find((t) => t.system === 'email')?.value;
  const phone = dyakuPatient.telecom?.find((t) => t.system === 'phone')?.value;

  const {
    identifierSourceUuid,
    dniIdentifierTypeUuid,
    hscIdentifierTypeUuid,
    defaultLocationUuid,
    emailAttributeTypeUuid,
    phoneAttributeTypeUuid,
  } = config.dyaku;

  const defaultLocation = await getDefaultLocation(defaultLocationUuid);
  const autoIdentifier = await generateAutoIdentifier(identifierSourceUuid);
  const validatedDNI = identifier?.value ? validateAndFixPeruvianDNI(identifier.value) : null;

  const identifiers: Array<Record<string, unknown>> = [
    {
      identifier: autoIdentifier,
      identifierType: hscIdentifierTypeUuid,
      location: defaultLocation,
      preferred: true,
    },
  ];

  if (validatedDNI) {
    identifiers.push({
      identifier: validatedDNI,
      identifierType: dniIdentifierTypeUuid,
      location: defaultLocation,
      preferred: false,
    });
  }

  return {
    identifiers,
    person: {
      names: name ? [{ givenName: name.given?.join(' ') || '', familyName: name.family || '', preferred: true }] : [],
      gender: dyakuPatient.gender === 'female' ? 'F' : dyakuPatient.gender === 'male' ? 'M' : 'U',
      birthdate: dyakuPatient.birthDate || null,
      attributes: [
        ...(email ? [{ attributeType: emailAttributeTypeUuid, value: email }] : []),
        ...(phone ? [{ attributeType: phoneAttributeTypeUuid, value: phone }] : []),
      ],
    },
  };
}

export async function syncSinglePatientToOpenMRS(
  dyakuPatient: DyakuPatient,
  config: ConfigObject,
): Promise<SyncResult> {
  const result: SyncResult = { success: false, synchronized: 0, failed: 0, errors: [] };

  try {
    const existingPatient = await findPatientByIdentifier(getDniFromDyakuPatient(dyakuPatient));
    if (!existingPatient) {
      await createPatientInOpenMRS(dyakuPatient, config);
    } else {
      await updatePatientInOpenMRS(existingPatient.uuid, dyakuPatient, config);
    }
    result.synchronized = 1;
    result.success = true;
  } catch (error) {
    result.failed = 1;
    result.errors.push(
      `Error procesando paciente ${dyakuPatient.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

export function useDyakuPatientsByIdentifier(identifier: string) {
  const config = useConfig<ConfigObject>();
  const dyakuConfig = config.dyaku;

  // System-scoped search: DNI_SYSTEM|<value> → exact match, no false positives
  const url = identifier
    ? `${dyakuConfig.fhirBaseUrl}/Patient?identifier=${encodeURIComponent(`${DNI_SYSTEM}|${identifier}`)}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: DyakuPatientsResponse }, Error>(
    url ? `dyaku-patients-identifier-${identifier}` : null,
    () => fetchDyakuPatients(url!),
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
