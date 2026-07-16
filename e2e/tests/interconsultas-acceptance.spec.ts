import { type APIRequestContext, expect, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { getOpenmrsRestBaseUrl, shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';

const metadata = {
  orderType: 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b',
  careSetting: '6f0c9a92-6f24-11e3-af88-005056821db0',
  requestEncounterType: 'e4834799-7f43-4552-a6f3-2656880ca52f',
  clinicianEncounterRole: '240b26f9-dd88-4172-823d-4a8bfeb7841f',
  destinationConceptSet: '4bf3f465-ac91-44fa-9b1f-173daf0c89a0',
  responseConcept: 'f0000174-0000-4000-8000-000000000174',
} as const;

const requiredPrivileges = [
  'app:home.interconsultas',
  'app:home.interconsultas.editar',
  'app:hoja.clinica.interconsultas',
  'app:hoja.clinica.interconsultas.editar',
];

async function createApiContext(playwright: PlaywrightWorkerArgs['playwright']) {
  const { username, password } = getE2ECredentials();
  return playwright.request.newContext({
    baseURL: getOpenmrsRestBaseUrl(),
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: { username, password },
  });
}

async function expectResource(api: APIRequestContext, resource: string, uuid: string) {
  const response = await api.get(`${resource}/${uuid}?v=custom:(uuid,display,name,retired)`);
  expect(response.ok(), `Expected ${resource}/${uuid} to exist`).toBeTruthy();
  const body = (await response.json()) as { uuid: string; retired?: boolean };
  expect(body).toMatchObject({ uuid });
  expect(body.retired ?? false).toBe(false);
}

test.describe('Interconsultas acceptance metadata', () => {
  test.beforeEach(({ playwright: _playwright }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Metadata acceptance only needs one project run');
  });

  test('[AC-01] configured OpenMRS metadata exists and is active', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      await expectResource(api, 'ordertype', metadata.orderType);
      await expectResource(api, 'caresetting', metadata.careSetting);
      await expectResource(api, 'encountertype', metadata.requestEncounterType);
      await expectResource(api, 'encounterrole', metadata.clinicianEncounterRole);

      const responseConcept = await api.get(
        `concept/${metadata.responseConcept}?v=custom:(uuid,display,retired,datatype:(name))`,
      );
      expect(responseConcept.ok(), 'Expected the response concept to exist').toBeTruthy();
      await expect(responseConcept.json()).resolves.toMatchObject({
        uuid: metadata.responseConcept,
        retired: false,
        datatype: { name: 'Text' },
      });
    } finally {
      await api.dispose();
    }
  });

  test('[AC-02] destination catalog contains an odontological service', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      const response = await api.get(
        `concept/${metadata.destinationConceptSet}?v=custom:(uuid,display,setMembers:(uuid,display,retired))`,
      );
      expect(response.ok(), 'Expected the destination concept set to exist').toBeTruthy();
      const conceptSet = (await response.json()) as {
        setMembers?: Array<{ uuid: string; display?: string; retired?: boolean }>;
      };
      const dentalServices =
        conceptSet.setMembers?.filter(
          (member) => !member.retired && /odontolog/i.test(member.display?.normalize('NFD') ?? ''),
        ) ?? [];

      expect(dentalServices, 'Odontologia must be selectable in the request workspace').not.toHaveLength(0);
    } finally {
      await api.dispose();
    }
  });

  test('[AC-02] frontend privilege names exist in the deployed backend', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      const response = await api.get('privilege?v=custom:(uuid,name,retired)&limit=1000');
      expect(response.ok(), 'Expected privileges to be queryable').toBeTruthy();
      const payload = (await response.json()) as { results?: Array<{ name: string; retired?: boolean }> };
      const activePrivilegeNames = new Set(
        payload.results?.filter((privilege) => !privilege.retired).map((privilege) => privilege.name) ?? [],
      );

      for (const privilege of requiredPrivileges) {
        expect(activePrivilegeNames, `Missing backend privilege: ${privilege}`).toContain(privilege);
      }
    } finally {
      await api.dispose();
    }
  });
});
