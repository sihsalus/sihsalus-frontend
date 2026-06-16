import { type OrderableConcept, type OrderBasketItem } from '@openmrs/esm-patient-common-lib';

import { createEmptyOrder, prepOrderPostData } from './resources';

describe('general order resources', () => {
  const orderTypeUuid = 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b';
  const concept = {
    uuid: 'c1130000-0000-4000-8000-000000000173',
    display: 'Interconsulta odontologica',
  } as OrderableConcept;

  it('stores the order type on new general order basket items', () => {
    expect(createEmptyOrder(concept, 'provider-uuid', orderTypeUuid)).toMatchObject({
      action: 'NEW',
      concept,
      orderer: 'provider-uuid',
      orderType: orderTypeUuid,
    });
  });

  it('includes orderType when preparing a new general order post payload', () => {
    const order = {
      ...createEmptyOrder(concept, 'provider-uuid', orderTypeUuid),
      urgency: 'priority-concept-uuid',
      urgencyCode: 'ROUTINE',
      instructions: 'Evaluar por odontologia',
    } as OrderBasketItem;

    expect(prepOrderPostData(order, 'patient-uuid', 'encounter-uuid', 'care-setting-uuid')).toMatchObject({
      action: 'NEW',
      type: 'order',
      patient: 'patient-uuid',
      careSetting: 'care-setting-uuid',
      orderer: 'provider-uuid',
      encounter: 'encounter-uuid',
      concept: concept.uuid,
      orderType: orderTypeUuid,
      instructions: 'Evaluar por odontologia',
      urgency: 'ROUTINE',
    });
  });
});
