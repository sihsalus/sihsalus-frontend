import { type APIRequestContext, expect } from '@playwright/test';
import { voidOpenmrsResource } from '../../utils/openmrs-cleanup';
import { type Patient } from './types';

export const generateRandomPatient = async (api: APIRequestContext): Promise<Patient> => {
  const locationUuid = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID;
  if (!locationUuid) {
    throw new Error('E2E_LOGIN_DEFAULT_LOCATION_UUID is required for the synthetic laboratory patient.');
  }

  const identifierRes = await api.post('idgen/identifiersource/8549f706-7e85-4c1d-9424-217d50a2988b/identifier', {
    data: {},
  });

  expect(identifierRes.ok(), 'The laboratory identifier source must issue a synthetic identifier').toBeTruthy();
  const { identifier } = await identifierRes.json();

  const patientRes = await api.post('patient', {
    data: {
      identifiers: [
        {
          identifier,
          identifierType: '05a29f94-c0ed-11e2-94be-8c13b969e334',
          location: locationUuid,
          preferred: true,
        },
      ],
      person: {
        addresses: [
          {
            address1: 'E2E',
            address2: '',
            cityVillage: 'Napo',
            country: 'Peru',
            postalCode: '',
            stateProvince: 'Loreto',
          },
        ],
        attributes: [],
        birthdate: '2020-2-1',
        birthdateEstimated: true,
        dead: false,
        gender: 'M',
        names: [
          {
            familyName: `Laboratory${Math.floor(Math.random() * 100000)}`,
            givenName: 'E2E',
            middleName: '',
            preferred: true,
          },
        ],
      },
    },
  });

  expect(patientRes.ok(), 'The synthetic laboratory patient must be created').toBeTruthy();
  return await patientRes.json();
};

export const getPatient = async (api: APIRequestContext, uuid: string): Promise<Patient> => {
  const patientRes = await api.get(`patient/${uuid}?v=full`);
  return await patientRes.json();
};

export const deletePatient = async (api: APIRequestContext, uuid: string) => {
  await voidOpenmrsResource(api, { resource: 'patient', uuid });
};
