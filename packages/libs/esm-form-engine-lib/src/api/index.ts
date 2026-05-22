import {
  attachmentUrl,
  type FetchResponse,
  fhirBaseUrl,
  type OpenmrsResource,
  openmrsFetch,
  restBaseUrl,
} from '@openmrs/esm-framework/src/internal';
import { encounterRepresentation } from '../constants';
import type {
  AttachmentFieldValue,
  FHIRObsResource,
  FormSchema,
  OpenmrsEncounter,
  OpenmrsForm,
  PatientDeathPayload,
  PatientIdentifier,
  PatientProgram,
  PatientProgramPayload,
  ProgramsFetchResponse,
} from '../types';
import { isUuid } from '../utils/boolean-utils';

interface FhirEncounterBundle {
  entry?: Array<{
    resource?: {
      id?: string;
    };
  }>;
}

interface OpenmrsResultsResponse<T> {
  results?: T[];
}

interface PatientSearchIdentifier {
  identifier?: string;
  identifierType?: {
    uuid?: string;
  };
}

interface PatientSearchResult {
  uuid?: string;
  identifiers?: PatientSearchIdentifier[];
}

interface FhirObservationBundle {
  entry?: Array<{
    resource?: FHIRObsResource;
  }>;
}

export function saveEncounter(
  abortController: AbortController,
  payload: OpenmrsEncounter,
  encounterUuid?: string,
): Promise<FetchResponse<OpenmrsEncounter>> {
  const url = encounterUuid
    ? `${restBaseUrl}/encounter/${encounterUuid}?v=${encounterRepresentation}`
    : `${restBaseUrl}/encounter?v=${encounterRepresentation}`;

  return openmrsFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: payload,
    signal: abortController.signal,
  });
}

export async function createAttachment(
  patientUuid: string,
  encounterUUID: string,
  attachment: AttachmentFieldValue,
): Promise<FetchResponse<unknown>> {
  const formData = new FormData();

  formData.append('fileCaption', attachment.fileDescription);
  formData.append('patient', patientUuid);

  if (attachment.file) {
    formData.append('file', attachment.file, attachment.fileName);
  } else {
    formData.append('file', new File([''], attachment.fileName), attachment.fileName);
    formData.append('base64Content', attachment.base64Content);
  }
  formData.append('encounter', encounterUUID);
  formData.append('formFieldNamespace', attachment.formFieldNamespace);
  formData.append('formFieldPath', attachment.formFieldPath);

  return openmrsFetch(`${attachmentUrl}`, {
    method: 'POST',
    body: formData,
  });
}

export function getConcept(conceptUuid: string, v: string): Promise<OpenmrsResource[]> {
  return openmrsFetch<OpenmrsResultsResponse<OpenmrsResource>>(`${restBaseUrl}/concept/${conceptUuid}?v=${v}`).then(
    ({ data }) => data.results ?? [],
  );
}

export function getLocationsByTag(tag: string): Promise<OpenmrsResource[]> {
  return openmrsFetch<OpenmrsResultsResponse<OpenmrsResource>>(
    `${restBaseUrl}/location?tag=${tag}&v=custom:(uuid,display)`,
  ).then(({ data }) => data.results ?? []);
}

export function getAllLocations(): Promise<OpenmrsResource[]> {
  return openmrsFetch<OpenmrsResultsResponse<OpenmrsResource>>(`${restBaseUrl}/location?v=custom:(uuid,display)`).then(
    ({ data }) => data.results ?? [],
  );
}

export async function getPreviousEncounter(
  patientUuid: string,
  encounterType: string,
): Promise<OpenmrsEncounter | null> {
  const query = `patient=${patientUuid}&_sort=-date&_count=1&type=${encounterType}`;
  const fhirResponse = await openmrsFetch<FhirEncounterBundle>(`${fhirBaseUrl}/Encounter?${query}`);
  if (fhirResponse.data.entry?.length) {
    const latestEncounter = fhirResponse.data.entry[0]?.resource?.id;
    if (!latestEncounter) {
      return null;
    }
    const encounterResponse = await openmrsFetch<OpenmrsEncounter>(
      `${restBaseUrl}/encounter/${latestEncounter}?v=${encounterRepresentation}`,
    );
    return encounterResponse.data;
  }
  return null;
}

export async function getLatestObs(
  patientUuid: string,
  conceptUuid: string,
  encounterTypeUuid?: string,
): Promise<FHIRObsResource | null> {
  let params = `patient=${patientUuid}&code=${conceptUuid}${
    encounterTypeUuid ? `&encounter.type=${encounterTypeUuid}` : ''
  }`;
  // the latest obs
  params += '&_sort=-date&_count=1';
  const { data } = await openmrsFetch<FhirObservationBundle>(`${fhirBaseUrl}/Observation?${params}`);
  return data.entry?.[0]?.resource ?? null;
}

export async function getLatestObsForConceptSet(
  patientUuid: string,
  conceptUuid: string,
  encounterTypeUuid?: string,
): Promise<FHIRObsResource[]> {
  const latestObs = await getLatestObs(patientUuid, conceptUuid, encounterTypeUuid);
  if (!latestObs) {
    return [];
  }

  const encounterId = latestObs.encounter?.reference?.split('/').pop();
  if (!encounterId) {
    return [latestObs];
  }

  const params = `patient=${patientUuid}&code=${conceptUuid}&encounter=${encounterId}`;
  const { data } = await openmrsFetch<FhirObservationBundle>(`${fhirBaseUrl}/Observation?${params}`);
  return data.entry?.map((entry) => entry.resource).filter((resource): resource is FHIRObsResource => !!resource) ?? [];
}

/**
 * Fetches an OpenMRS form using either its name or UUID.
 * @param {string} nameOrUUID - The form's name or UUID.
 * @returns {Promise<OpenmrsForm | null>} - A Promise that resolves to the fetched OpenMRS form or null if not found.
 */
export async function fetchOpenMRSForm(nameOrUUID: string): Promise<OpenmrsForm | null> {
  if (!nameOrUUID) {
    return null;
  }

  const { url, isUUID } = isUuid(nameOrUUID)
    ? { url: `${restBaseUrl}/form/${nameOrUUID}?v=full`, isUUID: true }
    : { url: `${restBaseUrl}/form?q=${nameOrUUID}&v=full`, isUUID: false };

  if (isUUID) {
    const { data: openmrsFormResponse } = await openmrsFetch<OpenmrsForm>(url);
    return openmrsFormResponse;
  }

  const { data: openmrsFormResponse } = await openmrsFetch<OpenmrsResultsResponse<OpenmrsForm>>(url);
  if (openmrsFormResponse.results?.length) {
    const form = openmrsFormResponse.results.find((form) => form.retired === false);
    if (form) {
      return form;
    }
  }
  throw new Error(`Form with ID "${nameOrUUID}" was not found`);
}

/**
 * Fetches ClobData for a given OpenMRS form.
 * @param {OpenmrsForm} form - The OpenMRS form object.
 * @returns {Promise<FormSchema | null>} - A Promise that resolves to the fetched ClobData or null if not found.
 */
export async function fetchClobData(form: OpenmrsForm): Promise<FormSchema | null> {
  if (!form) {
    return null;
  }

  const jsonSchemaResource = form.resources?.find(({ name }) => name === 'JSON schema');
  if (!jsonSchemaResource) {
    return null;
  }

  const clobDataUrl = `${restBaseUrl}/clobdata/${jsonSchemaResource.valueReference}`;
  const { data: clobDataResponse } = await openmrsFetch<FormSchema>(clobDataUrl);

  return clobDataResponse;
}

// Program Enrollment
export function getPatientEnrolledPrograms(patientUuid: string): Promise<ProgramsFetchResponse | null> {
  return openmrsFetch<ProgramsFetchResponse>(
    `${restBaseUrl}/programenrollment?patient=${patientUuid}&v=custom:(uuid,display,program:(uuid,name,allWorkflows),dateEnrolled,dateCompleted,location:(uuid,display),states:(state:(uuid,name,concept:(uuid),programWorkflow:(uuid)))`,
  ).then(({ data }) => {
    if (data) {
      return data;
    }
    return null;
  });
}

export function saveProgramEnrollment(
  payload: PatientProgramPayload,
  abortController: AbortController,
): Promise<FetchResponse<PatientProgram>> {
  if (!payload) {
    throw new Error('Program enrollment cannot be created because no payload is supplied');
  }
  const url = payload.uuid ? `${restBaseUrl}/programenrollment/${payload.uuid}` : `${restBaseUrl}/programenrollment`;
  return openmrsFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    signal: abortController.signal,
  });
}

export function savePatientIdentifier(
  patientIdentifier: PatientIdentifier,
  patientUuid: string,
): Promise<FetchResponse<unknown>> {
  let url: string;

  if (patientIdentifier.uuid) {
    url = `${restBaseUrl}/patient/${patientUuid}/identifier/${patientIdentifier.uuid}`;
  } else {
    url = `${restBaseUrl}/patient/${patientUuid}/identifier`;
  }

  return openmrsFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(patientIdentifier),
  });
}

export function findPatientsByIdentifier(identifier: string): Promise<PatientSearchResult[]> {
  return openmrsFetch<OpenmrsResultsResponse<PatientSearchResult>>(
    `${restBaseUrl}/patient?q=${encodeURIComponent(identifier)}&v=custom:(uuid,identifiers:(identifier,identifierType:(uuid)))`,
  ).then(({ data }) => data.results ?? []);
}

export function markPatientAsDeceased(
  t: (key: string, defaultValue: string) => string,
  patientUUID: string,
  payload: PatientDeathPayload,
  abortController: AbortController,
): Promise<FetchResponse<unknown>> {
  if (!payload) {
    throw new Error(
      t(
        'patientCannotBeMarkedAsDeceasedBecauseNoPayloadSupplied',
        'Patient cannot be marked as deceased because no payload is supplied',
      ),
    );
  }
  const url = `${restBaseUrl}/person/${patientUUID}`;
  return openmrsFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    signal: abortController.signal,
  });
}
