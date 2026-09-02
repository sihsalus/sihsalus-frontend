import { type APIRequestContext, expect, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { getOpenmrsRestBaseUrl, shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';

// Contrato de metadatos que respalda la hoja de consulta externa y la
// validación de financiamiento SIS (docs/clinical/plan-alineamiento-seguros-sis.md).
// Los UUID son los publicados por
// packages/libs/esm-patient-common-lib/src/financiador/financiador.resource.ts.
const financiadorVisitAttributeTypes = {
  financiador: '3a988e33-a6c0-4b76-b924-01abb998944b',
  numeroDeSeguro: 'aac48226-d143-4274-80e0-264db4e368ee',
  estadoAcreditacionSis: '5e13e902-2030-4f65-b9d5-9a4810c9a603',
  fechaConsultaSis: 'e3a66f60-4abe-4948-b323-7c4935d8eb8a',
} as const;

const sisConcepts = {
  financiadorSis: '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c',
  acreditacionVigente: '9b3df0a1-0c58-4f55-9868-9c38f1db2051',
  acreditacionNoVigente: '9b3df0a1-0c58-4f55-9868-9c38f1db2052',
  acreditacionPendiente: '9b3df0a1-0c58-4f55-9868-9c38f1db2053',
  acreditacionNoConsultada: '9b3df0a1-0c58-4f55-9868-9c38f1db2054',
} as const;

const requiredPrivileges = [
  'app:hoja.clinica.consultaExterna',
  'app:hoja.clinica.consultaExterna.editar',
  'app:hoja.clinica.resultados',
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
  const response = await api.get(`${resource}/${uuid}?v=custom:(uuid,display,retired)`);
  expect(response.ok(), `Expected ${resource}/${uuid} to exist`).toBeTruthy();
  const body = (await response.json()) as { uuid: string; retired?: boolean };
  expect(body).toMatchObject({ uuid });
  expect(body.retired ?? false).toBe(false);
}

test.describe('Consulta externa acceptance metadata', () => {
  test.beforeEach(({ playwright: _playwright }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Metadata acceptance only needs one project run');
  });

  test('[AC-01] frontend privilege names exist in the deployed backend', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      const response = await api.get('privilege?v=custom:(uuid,name,retired)&limit=1000');
      expect(response.ok(), 'Expected privileges to be queryable').toBeTruthy();
      const payload = (await response.json()) as {
        results?: Array<{ name: string; retired?: boolean }>;
      };
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

  test('[AC-02] financiador visit attribute types exist and are active', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      for (const uuid of Object.values(financiadorVisitAttributeTypes)) {
        await expectResource(api, 'visitattributetype', uuid);
      }
    } finally {
      await api.dispose();
    }
  });

  test('[AC-03] SIS financiador and accreditation concepts exist and are active', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      for (const uuid of Object.values(sisConcepts)) {
        await expectResource(api, 'concept', uuid);
      }
    } finally {
      await api.dispose();
    }
  });
});
