import {
  type FetchResponse,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  toOmrsIsoString,
  useConfig,
} from '@openmrs/esm-framework';
import type { OrderPost, PatientOrderFetchResponse, TestOrderPost } from '@openmrs/esm-patient-common-lib';
import { useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import useSWRImmutable from 'swr/immutable';

import type { ConfigObject } from '../config-schema';
import type { TestOrderBasketItem } from '../types';

/**
 * SWR-based data fetcher for patient orders.
 *
 * @param patientUuid The UUID of the patient whose orders should be fetched.
 * @param status Allows fetching either all orders or only active orders.
 */
export function usePatientLabOrders(patientUuid: string, status: 'ACTIVE' | 'any') {
  const { orders } = useConfig<ConfigObject>();
  const labOrderTypeUUID = orders.labOrderTypeUuid;
  const configuredCareSettingUuid = orders.careSettingUuid;
  const ordersUrl = `${restBaseUrl}/order?patient=${patientUuid}&careSetting=${configuredCareSettingUuid}&status=${status}&orderType=${labOrderTypeUUID}`;

  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<PatientOrderFetchResponse>, Error>(
    patientUuid ? ordersUrl : null,
    openmrsFetch,
  );

  const mutateOrders = useCallback(
    () => mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?patient=${patientUuid}`)),
    [patientUuid],
  );

  const labOrders = useMemo(
    () =>
      data?.data?.results
        ? data.data.results?.sort((order1, order2) => (order2.dateActivated > order1.dateActivated ? 1 : -1))
        : null,
    [data],
  );

  return {
    data: data ? labOrders : null,
    error,
    isLoading,
    isValidating,
    mutate: mutateOrders,
  };
}

const conceptRepresentation = 'custom:(uuid,display)';

export function useOrderReasons(conceptUuids: Array<string>) {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptReferenceResponse>, Error>(
    conceptUuids && conceptUuids.length > 0
      ? [`${restBaseUrl}/conceptreferences?v=${conceptRepresentation}`, conceptUuids]
      : null,
    ([url, refs]) =>
      openmrsFetch<ConceptReferenceResponse>(url, {
        headers: { 'Content-Type': 'application/json' },
        body: { references: refs },
        method: 'POST',
      }),
  );

  const orderReasons = Object.values(data?.data ?? {}).map((value) => ({
    uuid: value.uuid,
    display: value.display,
  }));

  if (error) {
    showSnackbar({
      title: error.name,
      subtitle: error.message,
      kind: 'error',
    });
  }

  return { orderReasons: orderReasons, isLoading };
}

export function prepTestOrderPostData(
  order: TestOrderBasketItem,
  patientUuid: string,
  encounterUuid: string | null,
  configuredCareSettingUuid: string,
): TestOrderPost {
  if (order.action === 'NEW' || order.action === 'RENEW') {
    return {
      action: 'NEW',
      type: 'testorder',
      patient: patientUuid,
      careSetting: configuredCareSettingUuid,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order.testType.conceptUuid,
      instructions: order.instructions,
      orderReason: order.orderReason,
      accessionNumber: order.accessionNumber,
      urgency: order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else if (order.action === 'REVISE') {
    return {
      action: 'REVISE',
      type: 'testorder',
      patient: patientUuid,
      careSetting: order.careSetting,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order.testType.conceptUuid,
      instructions: order.instructions,
      orderReason: order.orderReason,
      previousOrder: order.previousOrder,
      accessionNumber: order.accessionNumber,
      urgency: order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else if (order.action === 'DISCONTINUE') {
    return {
      action: 'DISCONTINUE',
      type: 'testorder',
      patient: patientUuid,
      careSetting: order.careSetting,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order.testType.conceptUuid,
      orderReason: order.orderReason,
      previousOrder: order.previousOrder,
      accessionNumber: order.accessionNumber,
      urgency: order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else {
    throw new Error(`Unknown order action: ${String(order.action)}.`);
  }
}

export type PostDataPrepLabOrderFunction = (
  order: TestOrderBasketItem,
  patientUuid: string,
  encounterUuid: string,
) => OrderPost;

export interface ConceptAnswers {
  display: string;
  uuid: string;
}

export interface ConceptReferenceResponse {
  [key: string]: {
    uuid: string;
    display: string;
    datatype: {
      uuid: string;
      display: string;
    };
    answers: Array<ConceptAnswers>;
    setMembers: Array<ConceptAnswers>;
  };
}
