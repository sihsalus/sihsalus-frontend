import { type APIRequestContext, expect } from '@playwright/test';
import { voidOpenmrsResource } from '../../utils/openmrs-cleanup';
import { type Encounter, type Order } from './types';

export const generateRandomTestOrder = async (
  api: APIRequestContext,
  patientId: string,
  encounter: Encounter,
  providerUuid: string,
): Promise<Order> => {
  const order = await api.post('order', {
    data: {
      orderType: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
      type: 'testorder',
      action: 'NEW',
      accessionNumber: null,
      urgency: 'ROUTINE',
      dateActivated: encounter.encounterDatetime,
      scheduledDate: null,
      dateStopped: null,
      autoExpireDate: null,
      careSetting: '6f0c9a92-6f24-11e3-af88-005056821db0',
      encounter: encounter.uuid,
      patient: patientId,
      concept: '887AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      orderer: providerUuid,
      frequency: null,
      orderReason: null,
      orderReasonNonCoded: 'order reason',
      instructions: null,
      commentToFulfiller: null,
      fulfillerStatus: null,
      fulfillerComment: null,
      specimenSource: null,
      laterality: null,
      clinicalHistory: null,
      numberOfRepeats: null,
    },
  });
  expect(order.ok(), 'The synthetic laboratory order must be created').toBeTruthy();
  return await order.json();
};

export const deleteTestOrder = async (api: APIRequestContext, uuid: string) => {
  await voidOpenmrsResource(api, { resource: 'order', uuid });
};
