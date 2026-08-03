import { type Order } from '@openmrs/esm-patient-common-lib';
import { mockOrders } from 'test-utils';

import { buildMedicationOrder } from '.';

describe('buildMedicationOrder', () => {
  it('preserves the submitted order identity and encounter context for a revision', () => {
    const order = mockOrders.find((candidate) => candidate.type === 'drugorder') as unknown as Order;

    expect(buildMedicationOrder(order, 'REVISE')).toMatchObject({
      action: 'REVISE',
      careSetting: order.careSetting.uuid,
      encounterUuid: order.encounter.uuid,
      orderer: order.orderer.uuid,
      previousOrder: order.uuid,
      uuid: order.uuid,
      visit: order.encounter.visit,
    });
  });
});
