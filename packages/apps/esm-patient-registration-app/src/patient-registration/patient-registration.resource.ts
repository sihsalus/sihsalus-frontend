import { createAttachment, openmrsFetch, restBaseUrl, type UploadedFile } from '@openmrs/esm-framework';
import dayjs from 'dayjs';

import {
  type AttributeValue,
  type Encounter,
  type Patient,
  type PatientAddress,
  type PatientIdentifier,
  type PersonAttributeResponse,
  type Relationship,
} from './patient-registration.types';

export interface SavePersonPayload {
  names: Array<{
    givenName: string;
    middleName?: string;
    familyName: string;
    familyName2?: string;
    preferred: boolean;
  }>;
  gender: string;
  birthdate?: string;
  birthdateEstimated?: boolean;
  addresses?: Array<PatientAddress>;
  attributes?: Array<AttributeValue>;
}

export interface PersonRegistrationCopyData {
  uuid: string;
  display?: string;
  addresses?: Array<PatientAddress>;
  attributes?: Array<PersonAttributeResponse>;
}

export interface PersonSearchResult {
  uuid: string;
  display?: string;
  age?: number;
  birthdate?: string;
  birthdateEstimated?: boolean;
  person?: {
    uuid?: string;
    display?: string;
    age?: number;
    birthdate?: string;
    birthdateEstimated?: boolean;
  };
}

function dataURItoFile(dataURI: string) {
  const byteString = globalThis.atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  // write the bytes of the string to a typed array
  const buffer = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    buffer[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([buffer], { type: mimeString });
  return new File([blob], 'patient-photo.png', { type: mimeString });
}

export function savePatient(patient: Patient | null, updatePatientUuid?: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/patient/${updatePatientUuid || ''}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: patient,
    signal: abortController.signal,
  });
}

/**
 * Promotes an existing person to patient. `person` must be the person UUID as a plain
 * string — sending a nested `person: { uuid }` object would make the backend try to
 * create a brand-new person. The promoted patient keeps the same UUID as the person.
 */
export function promotePersonToPatient(personUuid: string, identifiers: Array<PatientIdentifier>) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/patient`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: {
      person: personUuid,
      identifiers,
    },
    signal: abortController.signal,
  });
}

export function saveEncounter(encounter: Encounter) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/encounter`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: encounter,
    signal: abortController.signal,
  });
}

export function generateIdentifier(source: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/idgen/identifiersource/${source}/identifier`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: {},
    signal: abortController.signal,
  });
}

export function deletePersonName(nameUuid: string, personUuid: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/person/${personUuid}/name/${nameUuid}`, {
    method: 'DELETE',
    signal: abortController.signal,
  });
}

export function savePerson(person: SavePersonPayload) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/person`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: person,
    signal: abortController.signal,
  });
}

export function saveRelationship(relationship: Relationship) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/relationship`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: relationship,
    signal: abortController.signal,
  });
}

export function updateRelationship(relationshipUuid, relationship: { relationshipType: string }) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/relationship/${relationshipUuid}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: { relationshipType: relationship.relationshipType },
    signal: abortController.signal,
  });
}

export function deleteRelationship(relationshipUuid) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/relationship/${relationshipUuid}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
    signal: abortController.signal,
  });
}

export async function savePatientPhoto(
  patientUuid: string,
  content: string,
  url: string,
  date: string,
  conceptUuid: string,
) {
  const abortController = new AbortController();
  const patientPhoto = dataURItoFile(content);

  const formData = new FormData();
  formData.append('patient', patientUuid);
  formData.append('person', patientUuid);
  formData.append('concept', conceptUuid);
  formData.append('obsDatetime', date);
  formData.append('file', patientPhoto, patientPhoto.name);
  formData.append(
    'json',
    JSON.stringify({
      person: patientUuid,
      concept: conceptUuid,
      groupMembers: [],
      obsDatetime: date,
    }),
  );

  return openmrsFetch(url, {
    method: 'POST',
    signal: abortController.signal,
    body: formData,
  });
}

export function savePatientPhotoAsAttachment(patientUuid: string, content: string) {
  const patientPhoto = dataURItoFile(content);
  const uploadedFile: UploadedFile = {
    base64Content: content,
    file: patientPhoto,
    fileDescription: 'Patient photo',
    fileName: patientPhoto.name,
    fileType: 'image',
  };

  return createAttachment(patientUuid, uploadedFile);
}

export async function fetchPerson(query: string, abortController: AbortController): Promise<Array<PersonSearchResult>> {
  const encodedQuery = encodeURIComponent(query);
  const patientRepresentation = 'custom:(uuid,display,person:(uuid,display,age,birthdate,birthdateEstimated))';
  const personRepresentation = 'custom:(uuid,display,age,birthdate,birthdateEstimated)';
  const [patientsRes, personsRes] = await Promise.all([
    openmrsFetch<{ results: Array<PersonSearchResult> }>(
      `${restBaseUrl}/patient?q=${encodedQuery}&v=${patientRepresentation}`,
      {
        signal: abortController.signal,
      },
    ),
    openmrsFetch<{ results: Array<PersonSearchResult> }>(
      `${restBaseUrl}/person?q=${encodedQuery}&v=${personRepresentation}`,
      {
        signal: abortController.signal,
      },
    ),
  ]);

  const results: Array<PersonSearchResult> = patientsRes.data.results.map((patient) => ({
    ...patient,
    uuid: patient.person?.uuid ?? patient.uuid,
    display: patient.person?.display ?? patient.display,
    age: patient.person?.age ?? patient.age,
    birthdate: patient.person?.birthdate ?? patient.birthdate,
    birthdateEstimated: patient.person?.birthdateEstimated ?? patient.birthdateEstimated,
  }));

  personsRes.data.results.forEach((person) => {
    if (!results.some((patient) => patient.uuid === person.uuid)) {
      results.push(person);
    }
  });

  return results;
}

export async function fetchPersonRegistrationCopyData(personUuid: string) {
  const abortController = new AbortController();
  const representation =
    'custom:(uuid,display,addresses:(uuid,preferred,address1,address2,address3,address4,address5,address6,address7,address8,address9,address10,address11,address12,address13,address14,address15,cityVillage,stateProvince,countyDistrict,postalCode,country),attributes:(uuid,display,attributeType:(uuid,display,format),value))';

  const response = await openmrsFetch<PersonRegistrationCopyData>(
    `${restBaseUrl}/person/${personUuid}?v=${representation}`,
    {
      signal: abortController.signal,
    },
  );

  return response.data;
}

export async function addPatientIdentifier(patientUuid: string, patientIdentifier: PatientIdentifier) {
  const abortController = new AbortController();
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}/identifier/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: patientIdentifier,
  });
}

export async function updatePatientIdentifier(patientUuid: string, identifierUuid: string, identifier: string) {
  const abortController = new AbortController();
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}/identifier/${identifierUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: { identifier },
  });
}

export async function deletePatientIdentifier(patientUuid: string, patientIdentifierUuid: string) {
  const abortController = new AbortController();
  return openmrsFetch(`${restBaseUrl}/patient/${patientUuid}/identifier/${patientIdentifierUuid}?purge`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
  });
}

export function getDatetime(date: Date | string, time: string, timeFormat: 'AM' | 'PM') {
  const datetime = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  const fullHours = timeFormat === 'PM' ? (hours % 12) + 12 : hours % 12;
  return dayjs(datetime).hour(fullHours).minute(minutes).second(0).millisecond(0).toDate();
}
