import { type APIRequestContext, expect } from '@playwright/test';
import dayjs from 'dayjs';
import { voidOpenmrsResource } from '../../utils/openmrs-cleanup';
import { type Encounter, type Visit } from './types';

export interface Observation {
  uuid: string;
  concept: {
    uuid: string;
    display: string;
    conceptClass: {
      uuid: string;
      display: string;
    };
  };
  display: string;
  groupMembers: null | Array<{
    uuid: string;
    concept: {
      uuid: string;
      display: string;
    };
    value: {
      uuid: string;
      display: string;
    };
  }>;
  value: unknown;
  obsDatetime: string;
}

export const createEncounter = async (
  api: APIRequestContext,
  patientId: string,
  providerId: string,
  visit: Visit,
): Promise<Encounter> => {
  const encounterAfterVisit = dayjs(visit.startDatetime).add(1, 'minute');
  const now = dayjs().subtract(1, 'second');
  const encounterDatetime = encounterAfterVisit.isBefore(now) ? encounterAfterVisit.format() : now.format();
  const encounterRes = await api.post('encounter', {
    data: {
      encounterDatetime,
      patient: patientId,
      visit: visit.uuid,
      encounterProviders: [
        {
          encounterRole: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
          provider: providerId,
        },
      ],
      location: visit.location.uuid,
      encounterType: '39da3525-afe4-45ff-8977-c53b7b359158',
    },
  });
  expect(encounterRes.ok(), 'The synthetic laboratory encounter must be created').toBeTruthy();
  return await encounterRes.json();
};

export const deleteEncounter = async (api: APIRequestContext, uuid: string) => {
  await voidOpenmrsResource(api, { resource: 'encounter', uuid });
};
