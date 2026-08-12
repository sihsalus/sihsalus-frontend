import {
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
} from '@openmrs/esm-framework';

export const PATIENT_VITAL_STATUS_UNAVAILABLE = 'PATIENT_VITAL_STATUS_UNAVAILABLE';
export const DECEASED_PATIENT_OPERATION_BLOCKED = 'DECEASED_PATIENT_OPERATION_BLOCKED';

interface PatientVitalStatusResponse {
  person?: {
    dead?: boolean;
    deathDate?: string | null;
    uuid?: string;
  };
}

export interface PatientVitalStatus {
  dead: boolean;
  deathDate?: string | null;
  isDeceased: boolean;
}

const patientVitalStatusRepresentation = 'custom:(uuid,person:(uuid,dead,deathDate))';
let freshRequestSequence = 0;

function getFreshRequestNonce() {
  freshRequestSequence += 1;
  return `${Date.now()}-${freshRequestSequence}`;
}

/**
 * Reads the authoritative REST patient record without allowing an offline
 * patient cache to satisfy the guard. The nonce keeps the request outside any
 * dynamically registered cache route; the explicit strategy then fails closed
 * when the network request cannot be completed.
 */
export async function fetchFreshPatientVitalStatus(patientUuid: string): Promise<PatientVitalStatus> {
  const searchParams = new URLSearchParams({
    v: patientVitalStatusRepresentation,
    _: getFreshRequestNonce(),
  });
  const response = await openmrsFetch<PatientVitalStatusResponse>(
    `${restBaseUrl}/patient/${encodeURIComponent(patientUuid)}?${searchParams.toString()}`,
    {
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
    },
  );
  const person = response.data?.person;

  if (!person || typeof person.dead !== 'boolean') {
    throw Object.assign(new Error('The patient vital status could not be loaded.'), {
      code: PATIENT_VITAL_STATUS_UNAVAILABLE,
    });
  }

  return {
    dead: person.dead,
    deathDate: person.deathDate,
    isDeceased: person.dead || Boolean(person.deathDate),
  };
}

/** Fails closed unless a unique authoritative read confirms the patient is alive. */
export async function assertFreshPatientIsAlive(patientUuid: string): Promise<PatientVitalStatus> {
  const vitalStatus = await fetchFreshPatientVitalStatus(patientUuid);
  if (vitalStatus.isDeceased) {
    throw Object.assign(new Error('The operation is not permitted for a deceased patient.'), {
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });
  }
  return vitalStatus;
}
