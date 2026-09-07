import { type APIRequestContext, expect, type PlaywrightWorkerArgs, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { isSyntheticE2EPatient } from '../utils/e2e-gate-config';
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
  'app:hoja.clinica.resumenConsulta.editar',
  'app:hoja.clinica.visitas',
  'app:hoja.clinica.canastaOrdenes',
  'app:hoja.clinica.ordenes.editar',
];

const diagnosisConceptClassUuid = '8d4918b0-c2cc-11de-8d13-0010c6dffd0f';
const outpatientPatientUuid = process.env.E2E_PATIENT_UUID;
const appointmentsPatientUuid = process.env.E2E_APPOINTMENTS_PATIENT_UUID;
if (!outpatientPatientUuid || !appointmentsPatientUuid) {
  throw new Error('E2E_PATIENT_UUID and E2E_APPOINTMENTS_PATIENT_UUID must identify synthetic test patients.');
}
type OpenmrsSearchResponse<T> = { results?: Array<T> };
type CatalogConcept = {
  uuid: string;
  display?: string;
  retired?: boolean;
  conceptMappings?: Array<{
    conceptReferenceTerm?: {
      code?: string;
      conceptSource?: { display?: string; name?: string };
    };
  }>;
  names?: Array<{ conceptNameType?: string; display?: string }>;
};
type Drug = {
  uuid: string;
  display?: string;
  name?: string;
  retired?: boolean;
  strength?: string;
  concept?: { uuid?: string };
  dosageForm?: { uuid?: string } | null;
};

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

function normalizeCatalogText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.\s-]/g, '');
}

function getCie10Codes(concept: CatalogConcept) {
  const mappingCodes =
    concept.conceptMappings?.flatMap((mapping) => {
      const source =
        mapping.conceptReferenceTerm?.conceptSource?.name ?? mapping.conceptReferenceTerm?.conceptSource?.display ?? '';
      const code = mapping.conceptReferenceTerm?.code;
      return code && /CIE[-\s]?10|ICD[-\s]?10/i.test(source) ? [code] : [];
    }) ?? [];
  const shortNameCodes =
    concept.names?.flatMap((name) => (name.conceptNameType === 'SHORT' && name.display ? [name.display] : [])) ?? [];

  return [...mappingCodes, ...shortNameCodes].map(normalizeCatalogText);
}

async function getCatalogDrugs(api: APIRequestContext) {
  const representation = 'custom:(uuid,display,name,retired,strength,dosageForm:(uuid,display),concept:(uuid,display))';
  const queries = ['ursod', 'ursodeoxycholic'];
  const drugs = new Map<string, Drug>();

  for (const query of queries) {
    const directResponse = await api.get(
      `drug?q=${encodeURIComponent(query)}&limit=50&v=${encodeURIComponent(representation)}`,
    );
    expect(directResponse.ok(), `La búsqueda de medicamentos por "${query}" debe responder`).toBeTruthy();
    const directPayload = (await directResponse.json()) as OpenmrsSearchResponse<Drug>;
    directPayload.results?.forEach((drug) => {
      drugs.set(drug.uuid, drug);
    });

    const conceptResponse = await api.get(
      `concept?q=${encodeURIComponent(query)}&class=Drug&limit=50&v=${encodeURIComponent('custom:(uuid)')}`,
    );
    expect(conceptResponse.ok(), `La búsqueda de conceptos de medicamento por "${query}" debe responder`).toBeTruthy();
    const conceptPayload = (await conceptResponse.json()) as OpenmrsSearchResponse<{ uuid: string }>;
    const conceptUuids = conceptPayload.results?.map(({ uuid }) => uuid).filter(Boolean) ?? [];
    if (conceptUuids.length) {
      const linkedResponse = await api.get(
        `drug?concepts=${encodeURIComponent(conceptUuids.join(','))}&limit=50&v=${encodeURIComponent(representation)}`,
      );
      expect(linkedResponse.ok(), 'La búsqueda de presentaciones enlazadas debe responder').toBeTruthy();
      const linkedPayload = (await linkedResponse.json()) as OpenmrsSearchResponse<Drug>;
      linkedPayload.results?.forEach((drug) => {
        drugs.set(drug.uuid, drug);
      });
    }
  }

  return [...drugs.values()];
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

  test('[AC-04] designated patients are synthetic and the outpatient patient has an active visit', async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const patientUuids = new Set([outpatientPatientUuid, appointmentsPatientUuid]);
      for (const uuid of patientUuids) {
        expect(uuid, 'Los UUID de pacientes E2E deben estar configurados').toBeTruthy();
        const response = await api.get(
          `patient/${uuid}?v=${encodeURIComponent(
            'custom:(uuid,display,voided,identifiers:(identifier,voided),person:(display,voided,names:(givenName,middleName,familyName,voided)))',
          )}`,
        );
        expect(response.ok(), 'El paciente reservado para E2E debe existir').toBeTruthy();
        const patient = (await response.json()) as {
          display?: string;
          voided?: boolean;
          identifiers?: Array<{ identifier?: string; voided?: boolean }>;
          person?: {
            display?: string;
            voided?: boolean;
            names?: Array<{ familyName?: string; givenName?: string; middleName?: string; voided?: boolean }>;
          };
        };
        expect(Boolean(patient.voided || patient.person?.voided), 'El paciente E2E no debe estar anulado').toBe(false);
        expect(
          isSyntheticE2EPatient(patient),
          'El paciente reservado debe incluir el marcador E2E o SYNTHETIC en nombre o identificador',
        ).toBe(true);
      }

      const visitResponse = await api.get(
        `visit?patient=${encodeURIComponent(outpatientPatientUuid)}&includeInactive=false&limit=20&v=${encodeURIComponent(
          'custom:(uuid,voided,stopDatetime,visitType:(uuid,display),location:(uuid,display))',
        )}`,
      );
      expect(visitResponse.ok(), 'Las visitas del paciente ambulatorio E2E deben poder consultarse').toBeTruthy();
      const visits = (await visitResponse.json()) as OpenmrsSearchResponse<{
        stopDatetime?: string | null;
        voided?: boolean;
      }>;
      expect(
        visits.results?.filter((visit) => !visit.voided && !visit.stopDatetime),
        'El paciente de Consulta Externa debe tener exactamente una visita activa preparada',
      ).toHaveLength(1);
    } finally {
      await api.dispose();
    }
  });

  test('[AC-05] E2E account is authenticated, linked to a provider and has clinical privileges', async ({
    playwright,
  }) => {
    const api = await createApiContext(playwright);

    try {
      const response = await api.get(
        `session?v=${encodeURIComponent(
          'custom:(authenticated,currentProvider:(uuid,retired),privileges:(name,retired))',
        )}`,
      );
      expect(response.ok(), 'La sesión E2E debe poder consultarse').toBeTruthy();
      const session = (await response.json()) as {
        authenticated?: boolean;
        currentProvider?: { uuid?: string; retired?: boolean } | null;
        privileges?: Array<{ name?: string; retired?: boolean }>;
      };
      const assignedPrivileges = new Set(
        session.privileges
          ?.filter(({ retired }) => !retired)
          .map(({ name }) => name)
          .filter(Boolean) ?? [],
      );

      expect(session.authenticated, 'La cuenta E2E debe estar autenticada').toBe(true);
      expect(session.currentProvider?.uuid, 'La cuenta E2E debe estar vinculada a un proveedor clínico').toBeTruthy();
      expect(session.currentProvider?.retired ?? false, 'El proveedor clínico E2E debe estar activo').toBe(false);
      for (const privilege of requiredPrivileges) {
        expect(assignedPrivileges, `La cuenta E2E no tiene el privilegio ${privilege}`).toContain(privilege);
      }
    } finally {
      await api.dispose();
    }
  });

  test('[AC-06] K71.0 is an active diagnosis with a structured CIE-10 code', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      const representation =
        'custom:(uuid,display,retired,conceptMappings:(conceptReferenceTerm:(conceptSource:(name,display),code)),names:(display,conceptNameType,locale))';
      const concepts = new Map<string, CatalogConcept>();

      for (const query of ['K710', 'K71.0']) {
        const response = await api.get(
          `concept?name=${encodeURIComponent(query)}&searchType=fuzzy&class=${diagnosisConceptClassUuid}&limit=50&v=${encodeURIComponent(
            representation,
          )}`,
        );
        expect(response.ok(), `La búsqueda CIE-10 por ${query} debe responder`).toBeTruthy();
        const payload = (await response.json()) as OpenmrsSearchResponse<CatalogConcept>;
        payload.results?.forEach((concept) => {
          concepts.set(concept.uuid, concept);
        });
      }

      const diagnosis = [...concepts.values()].find(
        (concept) => !concept.retired && getCie10Codes(concept).includes('K710'),
      );
      expect(diagnosis, 'K71.0 debe existir con mapping CIE-10 o nombre SHORT catalogado').toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test('[AC-07] ursodeoxycholic acid has an active orderable drug presentation', async ({ playwright }) => {
    const api = await createApiContext(playwright);

    try {
      const drugs = await getCatalogDrugs(api);
      const activeDrug = drugs.find((drug) => {
        const name = normalizeCatalogText(`${drug.display ?? ''} ${drug.name ?? ''}`);
        return !drug.retired && /URSOD(?:EOXI|ESOXI|EOXYCHOL)/.test(name);
      });

      expect(activeDrug, 'El ácido ursodesoxicólico debe existir en el catálogo de medicamentos').toBeTruthy();
      expect(activeDrug?.concept?.uuid, 'El medicamento debe estar vinculado a un concepto Drug').toBeTruthy();
      expect(activeDrug?.dosageForm?.uuid, 'El medicamento debe declarar una forma farmacéutica').toBeTruthy();
      expect(activeDrug?.strength?.trim(), 'El medicamento debe declarar una concentración').toBeTruthy();
    } finally {
      await api.dispose();
    }
  });
});
