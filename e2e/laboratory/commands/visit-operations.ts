import { type APIRequestContext, expect } from '@playwright/test';
import dayjs from 'dayjs';
import { FixtureAuthorizationError } from '../../utils/e2e-synthetic-fixtures';
import { voidOpenmrsResource } from '../../utils/openmrs-cleanup';
import { laboratoryOrderFixture } from '../core/fixture-config';
import { type Visit } from './types';

export const visitStartDatetime = dayjs().subtract(1, 'D');

export const startVisit = async (api: APIRequestContext, patientId: string): Promise<Visit> => {
  const locationUuid = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;
  if (!locationUuid) {
    throw new Error('E2E_LOGIN_DEFAULT_LOCATION_UUID is required for the synthetic laboratory visit.');
  }
  const visitRes = await api.post('visit', {
    data: {
      startDatetime: visitStartDatetime.format('YYYY-MM-DDTHH:mm:ss.SSSZZ'),
      patient: patientId,
      location: locationUuid,
      visitType: laboratoryOrderFixture.visitTypeUuid,
      attributes: [],
    },
  });

  expect(visitRes.ok(), 'The synthetic laboratory visit must be created').toBeTruthy();
  return await visitRes.json();
};

export const endVisit = async (api: APIRequestContext, visit: Visit) => {
  const visitRes = await api.post(`visit/${visit.uuid}`, {
    data: {
      location: visit.location.uuid,
      startDatetime: visit.startDatetime,
      visitType: visit.visitType.uuid,
      stopDatetime: dayjs().format('YYYY-MM-DDTHH:mm:ss.SSSZZ'),
    },
  });

  expect(visitRes.ok(), 'The synthetic laboratory visit must be stopped during cleanup').toBeTruthy();
  return await visitRes.json();
};

export const getVisit = async (api: APIRequestContext, uuid: string): Promise<Visit> => {
  const visitRes = await api.get(`visit/${uuid}?v=full`, { maxRedirects: 0, maxRetries: 0 });
  if ([401, 403].includes(visitRes.status())) {
    throw new FixtureAuthorizationError('FIXTURE_AUTHORIZATION_FAILED_RETAIN_JOURNAL');
  }
  expect(visitRes.ok(), 'The synthetic laboratory visit must be readable').toBeTruthy();
  return await visitRes.json();
};

export const deleteVisit = async (api: APIRequestContext, uuid: string) => {
  await voidOpenmrsResource(api, { resource: 'visit', uuid });
};
