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
  PersonAttribute,
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
  links?: Array<{
    rel?: string;
    uri?: string;
  }>;
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

const MAX_FORM_SEARCH_PAGES = 100;

function normalizeFormName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isOpenmrsFormResponse(value: unknown): value is OpenmrsForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<OpenmrsForm>;
  return (
    typeof candidate.uuid === 'string' &&
    candidate.uuid.trim().length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    typeof candidate.published === 'boolean' &&
    typeof candidate.retired === 'boolean' &&
    Array.isArray(candidate.resources)
  );
}

function assertActivePublishedForm(value: unknown): OpenmrsForm {
  if (!isOpenmrsFormResponse(value)) {
    throw new Error('The OpenMRS form response is malformed');
  }
  if (value.published !== true || value.retired !== false) {
    throw new Error('The configured OpenMRS form is unpublished or retired');
  }
  return value;
}

async function fetchAllFormSearchResults(initialUrl: string): Promise<OpenmrsForm[]> {
  const forms: OpenmrsForm[] = [];
  const visitedUrls = new Set<string>();
  let nextUrl: string | undefined = initialUrl;

  for (let page = 0; nextUrl && page < MAX_FORM_SEARCH_PAGES; page++) {
    if (visitedUrls.has(nextUrl)) {
      throw new Error('The OpenMRS form search returned a cyclic pagination link');
    }
    visitedUrls.add(nextUrl);

    const { data } = await openmrsFetch<OpenmrsResultsResponse<unknown>>(nextUrl);
    if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
      throw new Error('The OpenMRS form search returned a malformed response');
    }
    if (data.links != null && !Array.isArray(data.links)) {
      throw new Error('The OpenMRS form search returned malformed pagination metadata');
    }

    for (const candidate of data.results) {
      if (!isOpenmrsFormResponse(candidate)) {
        throw new Error('The OpenMRS form search returned a malformed form');
      }
      forms.push(candidate);
    }

    const nextLinks = (data.links ?? []).filter((link) => link?.rel === 'next');
    if (nextLinks.length > 1 || (nextLinks.length === 1 && !nextLinks[0]?.uri?.trim())) {
      throw new Error('The OpenMRS form search returned malformed pagination metadata');
    }
    nextUrl = nextLinks[0]?.uri?.trim();
  }

  if (nextUrl) {
    throw new Error('The OpenMRS form search exceeded the safe pagination limit');
  }

  return forms;
}

/**
 * Fetches one exact, published and non-retired OpenMRS form using its name or UUID.
 * Empty identifiers resolve to null for backward compatibility. Every configured
 * identifier otherwise fails closed when identity or publication cannot be proven.
 */
export async function fetchOpenMRSForm(nameOrUUID: string): Promise<OpenmrsForm | null> {
  const identifier = nameOrUUID?.trim();
  if (!identifier) {
    return null;
  }

  if (isUuid(identifier)) {
    const { data } = await openmrsFetch<unknown>(`${restBaseUrl}/form/${identifier}?v=full`);
    const form = assertActivePublishedForm(data);
    if (form.uuid.toLowerCase() !== identifier.toLowerCase()) {
      throw new Error('The OpenMRS form response did not match the requested UUID');
    }
    return form;
  }

  const searchParams = new URLSearchParams({ q: identifier, v: 'full', limit: '100' });
  const forms = await fetchAllFormSearchResults(`${restBaseUrl}/form?${searchParams.toString()}`);
  const normalizedIdentifier = normalizeFormName(identifier);
  const matchingForms = forms.filter(
    (form) =>
      form.published === true && form.retired === false && normalizeFormName(form.name) === normalizedIdentifier,
  );

  if (matchingForms.length === 0) {
    throw new Error(`No exact published OpenMRS form was found for "${identifier}"`);
  }
  if (matchingForms.length > 1) {
    throw new Error(`Multiple exact published OpenMRS forms were found for "${identifier}"`);
  }

  return matchingForms[0];
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

export function savePersonAttribute(
  personAttribute: PersonAttribute,
  patientUuid: string,
): Promise<FetchResponse<unknown>> {
  const url = personAttribute.uuid
    ? `${restBaseUrl}/person/${patientUuid}/attribute/${personAttribute.uuid}`
    : `${restBaseUrl}/person/${patientUuid}/attribute`;

  return openmrsFetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: personAttribute,
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
