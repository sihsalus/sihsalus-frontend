import { toOmrsIsoString } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';

import { prepMedicationOrderPostData } from './api';

describe('prepMedicationOrderPostData', () => {
  const baseOrder = {
    action: 'NEW',
    drug: {
      uuid: 'drug-uuid',
      concept: { uuid: 'concept-uuid' },
      display: 'Drug',
    },
    dosage: 1,
    unit: { valueCoded: 'dose-unit-uuid', value: 'Tablet' },
    route: { valueCoded: 'route-uuid', value: 'Oral' },
    frequency: { valueCoded: 'frequency-uuid', value: 'Once daily' },
    asNeeded: false,
    asNeededCondition: null,
    numRefills: 0,
    pillsDispensed: 7,
    quantityUnits: { valueCoded: 'quantity-unit-uuid', value: 'Tablet' },
    duration: 7,
    durationUnit: { valueCoded: 'duration-unit-uuid', value: 'Days' },
    isFreeTextDosage: false,
    patientInstructions: 'Take after food',
    freeTextDosage: null,
    indication: 'Pain',
    startDate: new Date('2026-05-21T15:30:00.000-05:00'),
    display: 'Drug',
    commonMedicationName: 'Drug',
  } as DrugOrderBasketItem;

  it('maps a backdated start date to the order activation date', () => {
    // baseOrder.startDate is a fixed date in the past relative to "now"
    expect(prepMedicationOrderPostData(baseOrder, 'patient-uuid', 'encounter-uuid', 'provider-uuid')).toEqual(
      expect.objectContaining({
        action: 'NEW',
        dateActivated: toOmrsIsoString(baseOrder.startDate),
        encounter: 'encounter-uuid',
        orderer: 'provider-uuid',
        patient: 'patient-uuid',
      }),
    );
  });

  // Regression tests: orders starting today must not carry an explicit dateActivated.
  // The basket sets startDate when the item is created, so by signing time that
  // timestamp precedes the encounterDatetime and the backend rejects the order with
  // "Date activated cannot be before that of the associated encounter".
  it.each(['NEW', 'RENEW', 'REVISE'] as const)('omits dateActivated for %s orders starting today', (action) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const order = {
      ...baseOrder,
      action,
      previousOrder: action === 'NEW' ? null : 'previous-order-uuid',
      startDate: startOfToday,
    } as DrugOrderBasketItem;

    const result = prepMedicationOrderPostData(order, 'patient-uuid', 'encounter-uuid', 'provider-uuid');

    expect(result.dateActivated).toBeUndefined();
  });

  it('sends an explicit dateActivated for orders backdated to a previous day', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    const order = { ...baseOrder, startDate } as DrugOrderBasketItem;

    const result = prepMedicationOrderPostData(order, 'patient-uuid', 'encounter-uuid', 'provider-uuid');

    expect(result.dateActivated).toBe(toOmrsIsoString(startDate));
  });
});
