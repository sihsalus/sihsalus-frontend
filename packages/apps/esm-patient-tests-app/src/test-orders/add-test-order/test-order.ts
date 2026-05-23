import type { TestOrderBasketItem } from '../../types';

import { type TestType } from './useTestTypes';

type LabOrderRequest = Pick<TestOrderBasketItem, 'action' | 'testType'>;

export function createEmptyLabOrder(testType: TestType, orderer: string): TestOrderBasketItem {
  return {
    action: 'NEW',
    urgency: '',
    display: testType.label,
    testType,
    orderer,
  };
}

export function ordersEqual(order1: LabOrderRequest, order2: LabOrderRequest) {
  return order1.testType.conceptUuid === order2.testType.conceptUuid && order1.action === order2.action;
}
