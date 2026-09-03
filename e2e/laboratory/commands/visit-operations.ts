import { type APIRequestContext, expect } from '@playwright/test';
import dayjs from 'dayjs';
import { voidOpenmrsResource } from '../../utils/openmrs-cleanup';
import { type Visit } from './types';

export const visitStartDatetime = dayjs().subtract(1, 'D');

async function getVisitTypeUuid(api: APIRequestContext) {
  const preferredVisitTypeUuid = '7b0f5697-27e3-40c4-8bae-f4049abfb4ed';
  const preferredResponse = await api.get(`visittype/${preferredVisitTypeUuid}?v=custom:(uuid,retired)`);
  if (preferredResponse.ok()) {
    const preferred = (await preferredResponse.json()) as { retired?: boolean; uuid?: string };
    if (preferred.uuid && !preferred.retired) return preferred.uuid;
  }

  const response = await api.get('visittype?v=custom:(uuid,display,retired)&limit=100');
  expect(response.ok(), 'An active visit type must be available for laboratory E2E').toBeTruthy();
  const payload = (await response.json()) as {
    results?: Array<{ display?: string; retired?: boolean; uuid?: string }>;
  };
  const visitType =
    payload.results?.find(
      (candidate) => !candidate.retired && /facility visit|consulta ambulatoria/i.test(candidate.display ?? ''),
    ) ?? payload.results?.find((candidate) => !candidate.retired && candidate.uuid);
  expect(visitType?.uuid, 'An active visit type must be available for laboratory E2E').toBeTruthy();
  if (!visitType?.uuid) throw new Error('An active visit type must be available for laboratory E2E.');
  return visitType.uuid;
}

export const startVisit = async (api: APIRequestContext, patientId: string): Promise<Visit> => {
  const locationUuid = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;
  if (!locationUuid) {
    throw new Error('E2E_LOGIN_DEFAULT_LOCATION_UUID is required for the synthetic laboratory visit.');
  }
  const visitTypeUuid = await getVisitTypeUuid(api);
  const visitRes = await api.post('visit', {
    data: {
      startDatetime: visitStartDatetime.format('YYYY-MM-DDTHH:mm:ss.SSSZZ'),
      patient: patientId,
      location: locationUuid,
      visitType: visitTypeUuid,
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
  const visitRes = await api.get(`visit/${uuid}?v=full`);
  return await visitRes.json();
};

export const deleteVisit = async (api: APIRequestContext, uuid: string) => {
  await voidOpenmrsResource(api, { resource: 'visit', uuid });
};
