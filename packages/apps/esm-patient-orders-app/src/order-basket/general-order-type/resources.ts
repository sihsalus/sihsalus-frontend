import { toOmrsIsoString } from '@openmrs/esm-framework';
import { type OrderableConcept, type OrderBasketItem, type OrderPost } from '@openmrs/esm-patient-common-lib';

export function createEmptyOrder(concept: OrderableConcept, orderer: string, orderTypeUuid: string): OrderBasketItem {
  return {
    action: 'NEW',
    urgency: '',
    display: concept.display ?? '',
    concept,
    orderer,
    orderType: orderTypeUuid,
  };
}

export function ordersEqual(order1: OrderBasketItem, order2: OrderBasketItem) {
  return order1.action === order2.action && order1.concept.uuid === order2.concept.uuid;
}

export function prepOrderPostData(
  order: OrderBasketItem,
  patientUuid: string,
  encounterUuid: string | null,
  careSettingUuid: string,
): OrderPost {
  if (order.action === 'NEW' || order.action === 'RENEW') {
    return {
      action: 'NEW',
      type: 'order',
      patient: patientUuid,
      careSetting: careSettingUuid,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order.concept.uuid,
      orderType: order.orderType,
      instructions: order.instructions,
      // orderReason: order.orderReason,
      accessionNumber: order.accessionNumber,
      urgency: order.urgencyCode ?? order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else if (order.action === 'REVISE') {
    return {
      action: 'REVISE',
      type: 'order',
      patient: patientUuid,
      careSetting: order.careSetting,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order?.concept?.uuid,
      orderType: order.orderType,
      instructions: order.instructions,
      previousOrder: order.previousOrder,
      accessionNumber: order.accessionNumber,
      urgency: order.urgencyCode ?? order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else if (order.action === 'DISCONTINUE') {
    return {
      action: 'DISCONTINUE',
      type: 'order',
      patient: patientUuid,
      careSetting: order.careSetting,
      orderer: order.orderer,
      encounter: encounterUuid,
      concept: order?.concept?.uuid,
      orderType: order.orderType,
      previousOrder: order.previousOrder,
      accessionNumber: order.accessionNumber,
      urgency: order.urgencyCode ?? order.urgency,
      scheduledDate: order.scheduledDate ? toOmrsIsoString(order.scheduledDate) : null,
    };
  } else {
    throw new Error(`Unknown order action: ${String(order.action)}.`);
  }
}
