import { type FetchResponse, type OpenmrsResource, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import useSWR from 'swr';

import { type Encounter, type Observation } from '../types/encounter';
import { type OrderDiscontinuationPayload } from '../types/order';

const labEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType,location:(uuid,name),' +
  'patient:(uuid,display),encounterProviders:(uuid,provider:(uuid,name)),' +
  'obs:(uuid,obsDatetime,voided,comment,groupMembers,formFieldNamespace,formFieldPath,order:(uuid,display),concept:(uuid,name:(uuid,name)),' +
  'value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name))))';
const labConceptRepresentation =
  'custom:(uuid,display,name,datatype,set,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,' +
  'setMembers:(uuid,display,name,datatype,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,' +
  'setMembers:(uuid,display,name,datatype,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal)))';
const conceptObsRepresentation = 'custom:(uuid,display,concept:(uuid,display),groupMembers,value,comment)';

type NullableNumber = number | null | undefined;
export interface LabOrderConcept {
  uuid: string;
  display: string;
  name?: ConceptName;
  datatype: Datatype;
  set: boolean;
  version: string;
  retired: boolean;
  descriptions: Array<Description>;
  mappings?: Array<Mapping>;
  answers?: Array<OpenmrsResource>;
  setMembers?: Array<LabOrderConcept>;
  hiNormal?: NullableNumber;
  hiAbsolute?: NullableNumber;
  hiCritical?: NullableNumber;
  lowNormal?: NullableNumber;
  lowAbsolute?: NullableNumber;
  lowCritical?: NullableNumber;
  allowDecimal?: boolean | null;
  units?: string;
  groupLabel?: string;
}

export interface ConceptName {
  display: string;
  uuid: string;
  name: string;
  locale: string;
  localePreferred: boolean;
  conceptNameType: string;
}

export interface Datatype {
  uuid: string;
  display: string;
  name: string;
  description: string;
  hl7Abbreviation: string;
  retired: boolean;
  resourceVersion: string;
}

export interface Description {
  display: string;
  uuid: string;
  description: string;
  locale: string;
  resourceVersion: string;
}

export interface Mapping {
  display: string;
  uuid: string;
  conceptReferenceTerm: OpenmrsResource;
  conceptMapType: OpenmrsResource;
  resourceVersion: string;
}

export class LabResultCompletionError extends Error {
  constructor(
    public readonly observationUuid: string | null,
    public readonly completionCause: unknown,
  ) {
    super('The laboratory observation was saved, but the order could not be marked as completed.');
    this.name = 'LabResultCompletionError';
  }
}

export function useOrderConceptByUuid(uuid: string) {
  const isValid = Boolean(uuid && uuid !== 'undefined');
  const apiUrl = isValid ? `${restBaseUrl}/concept/${uuid}?v=${labConceptRepresentation}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: LabOrderConcept }, Error>(
    apiUrl,
    openmrsFetch,
  );
  return {
    concept: data?.data,
    isLoading: isValid ? isLoading : false,
    error: isValid ? error : null,
    isValidating,
    mutate,
  };
}

export function useLabEncounter(encounterUuid: string) {
  const isValid = Boolean(encounterUuid && encounterUuid !== 'undefined');
  const apiUrl = isValid ? `${restBaseUrl}/encounter/${encounterUuid}?v=${labEncounterRepresentation}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Encounter>, Error>(
    apiUrl,
    openmrsFetch,
  );

  return {
    encounter: data?.data,
    isLoading: isValid ? isLoading : false,
    error: isValid ? error : null,
    isValidating,
    mutate,
  };
}

export function useObservation(obsUuid: string) {
  const isValid = Boolean(obsUuid && obsUuid !== 'undefined');
  const url = isValid ? `${restBaseUrl}/obs/${obsUuid}?v=${conceptObsRepresentation}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Observation }, Error>(url, openmrsFetch);
  return {
    data: data?.data,
    isLoading: isValid ? isLoading : false,
    error: isValid ? error : null,
    isValidating,
    mutate,
  };
}

export function useCompletedLabResults(order: Order) {
  const {
    encounter,
    isLoading: isLoadingEncounter,
    mutate: mutateLabOrders,
    error: encounterError,
  } = useLabEncounter(order.encounter.uuid);
  const {
    data: observation,
    isLoading: isLoadingObs,
    error: isErrorObs,
    mutate: mutateObs,
  } = useObservation(
    (
      encounter?.obs.find((obs) => obs?.order?.uuid === order?.uuid) ||
      encounter?.obs.find((obs) => obs?.concept?.uuid === order?.concept?.uuid)
    )?.uuid ?? '',
  );

  return {
    isLoading: isLoadingEncounter || isLoadingObs,
    completeLabResult: observation,
    mutate: () => {
      mutateLabOrders();
      mutateObs();
    },
    error: isErrorObs ?? encounterError,
  };
}

type ObservationPayload = Record<string, unknown> & {
  groupMembers?: Array<ObservationPayload>;
};

function prepareStandaloneObservation(
  observation: ObservationPayload,
  patientUuid: string,
  encounterUuid: string,
): ObservationPayload {
  return {
    ...observation,
    person: patientUuid,
    encounter: encounterUuid,
    ...(observation.groupMembers
      ? {
          groupMembers: observation.groupMembers.map((member) =>
            prepareStandaloneObservation(member, patientUuid, encounterUuid),
          ),
        }
      : {}),
  };
}

function getSingleObservation(obsPayload: unknown): ObservationPayload {
  if (!obsPayload || typeof obsPayload !== 'object' || !('obs' in obsPayload)) {
    throw new Error('A laboratory observation payload is required.');
  }

  const observations = (obsPayload as { obs?: unknown }).obs;
  if (!Array.isArray(observations) || observations.length !== 1) {
    throw new Error('Exactly one laboratory observation group must be saved.');
  }

  const observation = observations[0];
  if (!observation || typeof observation !== 'object') {
    throw new Error('The laboratory observation payload is invalid.');
  }
  return observation as ObservationPayload;
}

export async function completeOrderResult(
  orderUuid: string,
  fulfillerPayload: unknown,
  abortController?: AbortController,
) {
  const response = await openmrsFetch(`${restBaseUrl}/order/${orderUuid}/fulfillerdetails/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController?.signal,
    body: JSON.stringify(fulfillerPayload),
  });

  if (response.ok === false) {
    throw new Error('Failed to mark the laboratory order as completed.');
  }
  return response;
}

// OpenMRS EncounterResource replaces the encounter's complete top-level obs set when
// the `obs` property is posted. Save this result through ObsResource instead so adding
// one laboratory result cannot remove unrelated clinical observations.
export async function updateOrderResult(
  orderUuid: string,
  encounterUuid: string,
  obsPayload: unknown,
  fulfillerPayload: unknown,
  orderPayload?: OrderDiscontinuationPayload,
  abortController?: AbortController,
) {
  const patientUuid = orderPayload?.patient?.trim() ?? '';
  const observation = prepareStandaloneObservation(getSingleObservation(obsPayload), patientUuid, encounterUuid);

  if (!observation.person) {
    throw new Error('A patient is required to save a laboratory observation.');
  }

  const saveObservation = await openmrsFetch<{ uuid?: string }>(`${restBaseUrl}/obs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController?.signal,
    body: JSON.stringify(observation),
  });

  if (saveObservation.ok === false) {
    throw new Error('Failed to save the laboratory observation.');
  }

  try {
    return await completeOrderResult(orderUuid, fulfillerPayload, abortController);
  } catch (error) {
    throw new LabResultCompletionError(saveObservation.data?.uuid ?? null, error);
  }
}

export function createObservationPayload(
  concept: LabOrderConcept,
  order: Order,
  values: Record<string, unknown>,
  status: string,
) {
  const orderComment = values['order-comment'] ? String(values['order-comment']) : undefined;

  if (concept.set && concept.setMembers.length > 0) {
    const groupMembers = concept.setMembers
      .map((member) => createGroupMember(member, order, values, status))
      .filter((member) => member !== null);

    if (groupMembers.length === 0) {
      return { obs: [] };
    }

    return { obs: [createObservation(order, groupMembers, null, status, orderComment)] };
  } else {
    const value = getValue(concept, values);
    const comment = values[`${concept.uuid}-comment`] ? String(values[`${concept.uuid}-comment`]) : orderComment;
    if (value === null || value === undefined) {
      return { obs: [] };
    }
    return { obs: [createObservation(order, null, value, status, comment)] };
  }
}

export function updateObservation(observationUuid: string, payload: Record<string, unknown>) {
  if (!observationUuid?.trim()) {
    return Promise.reject(new Error('A valid observation UUID is required.'));
  }
  return openmrsFetch(`${restBaseUrl}/obs/${observationUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function createGroupMember(
  member: LabOrderConcept,
  order: Order,
  values: Record<string, unknown>,
  status: string,
): Record<string, unknown> | null {
  if (member.setMembers && member.setMembers.length > 0) {
    const subMembers = member.setMembers
      .map((sub) => createGroupMember(sub, order, values, status))
      .filter((sub) => sub !== null);
    if (subMembers.length === 0) {
      return null;
    }
    const obsDatetime = new Date().toISOString();
    return {
      concept: { uuid: member.uuid },
      status: status,
      order: { uuid: order.uuid },
      obsDatetime,
      groupMembers: subMembers,
    };
  }

  const value = getValue(member, values);
  const comment = values[`${member.uuid}-comment`] ? String(values[`${member.uuid}-comment`]) : undefined;
  if (value === null || value === undefined) {
    return null;
  }
  const obsDatetime = new Date().toISOString();
  return {
    concept: { uuid: member.uuid },
    value: value,
    status: status,
    order: { uuid: order.uuid },
    obsDatetime,
    ...(comment && { comment }),
  };
}

export function flattenLeafConcepts(concept: LabOrderConcept, parentLabel?: string): Array<LabOrderConcept> {
  if (concept.setMembers && concept.setMembers.length > 0) {
    const currentLabel = parentLabel ?? concept.display;
    return concept.setMembers.flatMap((member) => flattenLeafConcepts(member, currentLabel));
  }
  if (concept.set) {
    return [];
  }
  return [{ ...concept, groupLabel: parentLabel }];
}

function createObservation(order: Order, groupMembers = null, value = null, status: string, comment?: string) {
  const obsDatetime = new Date().toISOString();
  return {
    concept: { uuid: order.concept.uuid },
    status: status,
    order: { uuid: order.uuid },
    obsDatetime,
    ...(groupMembers && groupMembers.length > 0 && { groupMembers }),
    ...(value !== null && value !== undefined && { value }),
    ...(comment && { comment }),
  };
}

function getValue(concept: LabOrderConcept, values: Record<string, unknown>) {
  const { datatype, uuid } = concept;
  const value = values[uuid];

  if (value === null || value === undefined || value === '') {
    return null;
  }

  const isCodedType =
    datatype?.display === 'Coded' || datatype?.hl7Abbreviation === 'CWE' || datatype?.hl7Abbreviation === 'Coded';

  if (isCodedType) {
    if (typeof value === 'object' && value !== null && 'uuid' in value) {
      return value;
    }
    return { uuid: String(value) };
  }

  return value;
}

export const isPanel = (concept: LabOrderConcept) => Boolean(concept?.setMembers?.length > 0);
export const isCoded = (concept: LabOrderConcept) => !isPanel(concept) && concept?.datatype?.display === 'Coded';
export const isNumeric = (concept: LabOrderConcept) => !isPanel(concept) && concept?.datatype?.display === 'Numeric';
export const isText = (concept: LabOrderConcept) => !isPanel(concept) && concept?.datatype?.display === 'Text';
