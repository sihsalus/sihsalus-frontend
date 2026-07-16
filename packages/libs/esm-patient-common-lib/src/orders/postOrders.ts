import { type OpenmrsResource, openmrsFetch, parseDate, restBaseUrl, type Visit } from '@openmrs/esm-framework';

import { getPatientUuidFromStore } from '../store/patient-chart-store';

import { type OrderBasketStore, orderBasketStore } from './store';
import type {
  DrugOrderPost,
  ExtractedOrderErrorObject,
  OrderBasketItem,
  OrderErrorObject,
  OrderPost,
  TestOrderPost,
} from './types';

function isValidDate(date: Date | null): date is Date {
  return Boolean(date) && !Number.isNaN(date.getTime());
}

export async function postOrdersOnNewEncounter(
  patientUuid: string,
  orderEncounterType: string,
  activeVisit: Visit | null,
  operationalLocationUuid: string,
  abortController?: AbortController,
) {
  const now = new Date();
  const visitStartDate = activeVisit?.startDatetime ? parseDate(activeVisit.startDatetime) : null;
  const visitEndDate = activeVisit?.stopDatetime ? parseDate(activeVisit.stopDatetime) : null;
  let encounterDate: Date | null;
  const visitIsCurrentlyActive =
    isValidDate(visitStartDate) && visitStartDate < now && (!isValidDate(visitEndDate) || visitEndDate > now);
  if (!activeVisit || visitIsCurrentlyActive) {
    // Omit the encounterDatetime so the server defaults it to its own "now". A
    // client-side timestamp can land after the server-defaulted dateActivated of the
    // embedded orders, failing the dateActivated >= encounterDatetime validation.
    encounterDate = null;
  } else {
    console.warn(
      'postOrdersOnNewEncounter received an active visit that is not currently active. This is a programming error. Attempting to place the order using the visit start date.',
    );
    encounterDate = isValidDate(visitStartDate) ? visitStartDate : now;
  }

  const { items, postDataPrepFunctions }: OrderBasketStore = orderBasketStore.getState();
  const patientItems = items?.[patientUuid];
  if (!patientItems) {
    return [];
  }

  const orders: Array<DrugOrderPost | TestOrderPost> = [];

  Object.entries(patientItems).forEach(([grouping, groupOrders]) => {
    groupOrders.forEach((order) => {
      orders.push(postDataPrepFunctions[grouping](order, patientUuid, null));
    });
  });

  const encounterPostData = {
    patient: patientUuid,
    location: operationalLocationUuid,
    encounterType: orderEncounterType,
    ...(encounterDate ? { encounterDatetime: encounterDate } : {}),
    visit: activeVisit?.uuid,
    obs: [],
    orders,
  };

  return openmrsFetch<OpenmrsResource>(`${restBaseUrl}/encounter`, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: encounterPostData,
    signal: abortController?.signal,
  }).then((res) => res?.data?.uuid);
}

export async function postOrders(encounterUuid: string, abortController: AbortController) {
  const patientUuid = getPatientUuidFromStore();
  if (!patientUuid) {
    return [];
  }
  const { items, postDataPrepFunctions }: OrderBasketStore = orderBasketStore.getState();
  const patientItems = items?.[patientUuid];
  if (!patientItems) {
    return [];
  }

  const erroredItems: Array<OrderBasketItem> = [];
  for (const grouping in patientItems) {
    const orders = patientItems[grouping];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const dataPrepFn = postDataPrepFunctions[grouping];

      if (typeof dataPrepFn !== 'function') {
        console.warn(`The postDataPrep function registered for ${grouping} orders is not a function`);
        continue;
      }

      await postOrder(dataPrepFn(order, patientUuid, encounterUuid), abortController).catch((error) => {
        erroredItems.push({
          ...order,
          orderError: error,
          extractedOrderError: extractErrorDetails(error),
        });
      });
    }
  }
  return erroredItems;
}

export function postOrder(body: OrderPost, abortController?: AbortController) {
  return openmrsFetch(`${restBaseUrl}/order`, {
    method: 'POST',
    signal: abortController?.signal,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

function extractErrorDetails(errorObject: OrderErrorObject): ExtractedOrderErrorObject {
  const errorDetails = {
    message: errorObject.responseBody?.error?.message ?? '',
    fieldErrors: [],
    globalErrors: errorObject.responseBody?.error?.globalErrors ?? [],
  };

  if (errorObject.responseBody?.error?.fieldErrors) {
    const fieldErrors = errorObject.responseBody?.error?.fieldErrors;
    for (const fieldName in fieldErrors) {
      fieldErrors[fieldName as keyof typeof fieldErrors]?.forEach((error) => {
        errorDetails.fieldErrors.push(error.message);
      });
    }
  }

  return errorDetails;
}
