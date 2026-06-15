import {
  type FetchResponse,
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
