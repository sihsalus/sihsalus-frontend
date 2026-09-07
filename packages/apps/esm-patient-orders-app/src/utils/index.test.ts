import { type Order } from '@openmrs/esm-patient-common-lib';
import { mockOrders } from 'test-utils';

import { buildMedicationOrder } from '.';

describe('buildMedicationOrder', () => {
  it.each([
    'ROUTINE',
    'STAT',
    'ON_SCHEDULED_DATE',
  ])('preserves %s urgency and the native frequency while editing', (urgency) => {
    const order = {
      ...mockOrders.find((candidate) => candidate.type === 'drugorder'),
      urgency,
      scheduledDate: urgency === 'ON_SCHEDULED_DATE' ? '2026-09-08T12:00:00.000Z' : null,
      duration: null,
      durationUnits: null,
      frequency: { uuid: 'synthetic-once-frequency', display: 'Once' },
    } as unknown as Order;

    expect(buildMedicationOrder(order, 'REVISE')).toMatchObject({
      urgency,
      urgencyCode: urgency,
      scheduledDate: order.scheduledDate ? new Date(order.scheduledDate) : undefined,
      frequency: { valueCoded: 'synthetic-once-frequency', value: 'Once' },
      duration: null,
      durationUnit: null,
    });
  });

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
