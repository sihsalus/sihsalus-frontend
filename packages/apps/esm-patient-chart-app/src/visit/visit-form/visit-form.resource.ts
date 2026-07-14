import {
  type FetchResponse,
  type NewVisitPayload,
  openmrsFetch,
  restBaseUrl,
  useConnectivity,
  useVisitTypes,
  type Visit,
} from '@openmrs/esm-framework';
import { type amPm } from '@openmrs/esm-patient-common-lib';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import { useOfflineVisitType } from '../hooks/useOfflineVisitType';

const addressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';
const birthAddressMarkerField = 'address15';
const birthAddressMarker = 'SIHSALUS_BIRTH_ADDRESS';
const defaultAddressFieldsForVisitAttribute = ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'];

export const VISIT_PERSISTENCE_CORRELATION_CONFLICT = 'VISIT_PERSISTENCE_CORRELATION_CONFLICT';

export interface VisitPersistenceCorrelation {
  attributeType: string;
  value: string;
}

interface CorrelatedVisitAttribute {
  attributeType?: { uuid?: string };
  value?: unknown;
}

function getAttributeValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (value && typeof value === 'object' && 'uuid' in value) {
    return String((value as { uuid?: unknown }).uuid ?? '').trim();
  }

  return '';
}

/**
 * Finds a just-created visit by an explicit, domain-unique correlation
 * attribute. This is intentionally not a patient/time heuristic.
 */
export async function reconcileVisitCreation(
  patientUuid: string,
  payload: NewVisitPayload,
  correlation: VisitPersistenceCorrelation,
) {
  const pageSize = 100;
  const visitsByUuid = new Map<string, Visit>();

  for (let startIndex = 0; ; startIndex += pageSize) {
    const searchParams = new URLSearchParams({
      patient: patientUuid,
      includeInactive: 'true',
      limit: String(pageSize),
      startIndex: String(startIndex),
      v: 'custom:(uuid,patient:(uuid),visitType:(uuid,display),location:(uuid,display),startDatetime,stopDatetime,attributes:(uuid,value,attributeType:(uuid)))',
    });
    const response = await openmrsFetch<{ results?: Array<Visit> }>(
      `${restBaseUrl}/visit?${searchParams.toString()}`,
    );
    const page = response.data?.results ?? [];
    let newVisitCount = 0;

    for (const visit of page) {
      if (!visitsByUuid.has(visit.uuid)) {
        visitsByUuid.set(visit.uuid, visit);
        newVisitCount += 1;
      }
    }

    if (page.length < pageSize || newVisitCount === 0) {
      break;
    }
  }

  const correlatedVisits = [...visitsByUuid.values()].filter((visit) =>
    (visit.attributes as Array<CorrelatedVisitAttribute> | undefined)?.some(
      (attribute) =>
        attribute.attributeType?.uuid === correlation.attributeType &&
        getAttributeValue(attribute.value) === correlation.value,
    ),
  );

  if (correlatedVisits.length !== 1) {
    if (correlatedVisits.length === 0) {
      return null;
    }

    throw Object.assign(new Error('More than one visit has the same persistence correlation.'), {
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  }

  const [visit] = correlatedVisits;
  const requestedVisitIsStopped = Boolean(payload.stopDatetime);
  const correlatedVisitIsStopped = Boolean(visit.stopDatetime);
  if (
    visit.patient?.uuid !== patientUuid ||
    visit.location?.uuid !== payload.location ||
    visit.visitType?.uuid !== payload.visitType ||
    correlatedVisitIsStopped !== requestedVisitIsStopped
  ) {
    throw Object.assign(new Error('The correlated visit does not match the visit creation request.'), {
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  }

  return visit;
}

export type VisitFormData = {
  visitStartDate: Date;
  visitStartTime: string;
  visitStartTimeFormat: amPm;
  visitStopDate: Date;
  visitStopTime: string;
  visitStopTimeFormat: amPm;
  programType: string;
  visitType: string;
  visitLocation: {
    display?: string;
    uuid?: string;
  };
  visitAttributes: {
    [x: string]: string;
  };
};

export function sanitizeVisitTimeInput(value: string) {
  const cleanedValue = value.replace(/[^\d:]/g, '');

  if (cleanedValue.includes(':')) {
    const [rawHours = '', rawMinutes = ''] = cleanedValue.split(':');
    return `${rawHours.slice(0, 2)}:${rawMinutes.slice(0, 2)}`;
  }

  const digits = cleanedValue.slice(0, 4);

  if (digits.length === 3) {
    return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  }

  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  return digits;
}

export function normalizeVisitTimeInput(value: string) {
  const sanitizedValue = sanitizeVisitTimeInput(value);
  const match = sanitizedValue.match(/^(\d{1,2}):(\d{1,2})$/);

  if (!match) {
    return sanitizedValue;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return sanitizedValue;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function normalizeVisitTimeFormatInput(value: unknown): amPm | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toUpperCase();

  return normalizedValue === 'AM' || normalizedValue === 'PM' ? normalizedValue : undefined;
}

export type PatientAddressVisitAttributeDefault = {
  visitAttributeTypeUuid: string;
  addressKind?: 'residence' | 'birth' | string;
  addressFields?: Array<string>;
  separator?: string;
};

export function useConditionalVisitTypes() {
  const isOnline = useConnectivity();

  const visitTypesHook = isOnline ? useVisitTypes : useOfflineVisitType;

  return visitTypesHook();
}
export interface VisitFormCallbacks {
  kind?: 'queue-entry';
  onBeforeVisitSave?: () => boolean | Promise<boolean>;
  onVisitCreatedOrUpdated: (visit: Visit) => Promise<unknown>;
}

interface PersonAttributeResponse {
  uuid: string;
  value:
    | string
    | {
        uuid: string;
        display: string;
      };
  attributeType: {
    uuid: string;
    format: 'org.openmrs.Concept' | string;
  };
}

export function useVisitFormCallbacks() {
  return useState<Map<string, VisitFormCallbacks>>(new Map());
}

export function usePersonAttributesForVisitDefaults(patientUuid?: string) {
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<PersonAttributeResponse> }>, Error>(
    patientUuid
      ? `${restBaseUrl}/person/${patientUuid}/attribute?v=custom:(uuid,attributeType:(uuid,format),value)`
      : null,
    openmrsFetch,
  );

  return useMemo(
    () => ({
      attributes: data?.data?.results ?? [],
      error,
      isLoading,
    }),
    [data?.data?.results, error, isLoading],
  );
}

function getOpenmrsAddressExtensionValue(address: fhir.Address | undefined, field: string) {
  const addressExtension = address?.extension?.find((extension) => extension.url === addressExtensionUrl);
  return addressExtension?.extension?.find((extension) => extension.url?.split('#')[1] === field)?.valueString;
}

function getAddressFieldValue(address: fhir.Address | undefined, field: string) {
  if (!address) {
    return undefined;
  }

  switch (field) {
    case 'cityVillage':
      return address.city;
    case 'stateProvince':
      return address.state;
    case 'countyDistrict':
      return address.district;
    case 'postalCode':
      return address.postalCode;
    case 'country':
      return address.country;
    default:
      return getOpenmrsAddressExtensionValue(address, field);
  }
}

function isBirthAddress(address: fhir.Address | undefined) {
  return getOpenmrsAddressExtensionValue(address, birthAddressMarkerField) === birthAddressMarker;
}

function getPatientAddress(patient: fhir.Patient | undefined, addressKind: string | undefined) {
  if (addressKind === 'birth') {
    return patient?.address?.find(isBirthAddress);
  }

  return (
    patient?.address?.find((address) => address.use === 'home' && !isBirthAddress(address)) ??
    patient?.address?.find((address) => !isBirthAddress(address))
  );
}

export function getDefaultVisitAttributesFromPatientAddress(
  patient: fhir.Patient | undefined,
  mappings: Array<PatientAddressVisitAttributeDefault> = [],
  configuredVisitAttributeUuids = new Set<string>(),
) {
  return mappings.reduce<Record<string, string>>((defaults, mapping) => {
    if (!configuredVisitAttributeUuids.has(mapping.visitAttributeTypeUuid)) {
      return defaults;
    }

    const address = getPatientAddress(patient, mapping.addressKind);
    const fields = mapping.addressFields?.length ? mapping.addressFields : defaultAddressFieldsForVisitAttribute;
    const separator = mapping.separator ?? ', ';
    const values = fields
      .map((field) => getAddressFieldValue(address, field)?.trim())
      .filter((value, index, values) => !!value && values.indexOf(value) === index);

    if (values.length) {
      defaults[mapping.visitAttributeTypeUuid] = values.join(separator);
    }

    return defaults;
  }, {});
}

export function createVisitAttribute(visitUuid: string, attributeType: string, value: string) {
  return openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute`, {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: { attributeType, value },
  });
}

export function updateVisitAttribute(visitUuid: string, visitAttributeUuid: string, value: string) {
  return openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute/${visitAttributeUuid}`, {
    method: 'POST',
    headers: { 'Content-type': 'application/json' },
    body: { value },
  });
}

export function deleteVisitAttribute(visitUuid: string, visitAttributeUuid: string) {
  return openmrsFetch(`${restBaseUrl}/visit/${visitUuid}/attribute/${visitAttributeUuid}`, {
    method: 'DELETE',
  });
}

export interface VisitAttributeSnapshot {
  uuid: string;
  value?: unknown;
  attributeType?: {
    uuid?: string;
  };
}

export async function getVisitAttributes(visitUuid: string) {
  const response = await openmrsFetch<{ attributes?: Array<VisitAttributeSnapshot> }>(
    `${restBaseUrl}/visit/${visitUuid}?v=custom:(attributes:(uuid,value,attributeType:(uuid)))`,
  );
  return response.data?.attributes ?? [];
}
