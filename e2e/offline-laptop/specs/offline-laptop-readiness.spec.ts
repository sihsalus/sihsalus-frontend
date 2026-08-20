import { randomUUID } from 'node:crypto';
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
  type PlaywrightWorkerArgs,
  test,
} from '@playwright/test';
import { getE2ECredentials } from '../../utils/e2e-api';
import { shouldIgnoreHTTPSErrors } from '../../utils/e2e-urls';
import { loadOfflineLaptopGateConfig } from '../gate-config';

const gateConfig = loadOfflineLaptopGateConfig();
const cleanupReason = `${gateConfig.target} synthetic offline laptop acceptance cleanup`;

interface OpenmrsResource {
  display?: string;
  retired?: boolean;
  uuid: string;
  voided?: boolean;
}

interface OpenmrsSearchResponse<T> {
  results?: Array<T>;
}

interface BuildInfo {
  gitSha?: string;
  version?: string;
}

interface IdentifierSource extends OpenmrsResource {
  identifierType?: OpenmrsResource;
}

interface IdentifierType extends OpenmrsResource {
  locationBehavior?: 'NOT_USED' | 'REQUIRED' | string;
}

interface PatientResponse extends OpenmrsResource {
  person?: {
    names?: Array<{
      familyName?: string;
      givenName?: string;
    }>;
  };
}

interface VisitResponse extends OpenmrsResource {
  location?: OpenmrsResource;
  patient?: OpenmrsResource;
  startDatetime?: string;
  stopDatetime?: string | null;
  visitType?: OpenmrsResource;
}

interface StoredSyncItem {
  content?: {
    location?: string;
    patient?: string;
    uuid?: string;
    visitType?: string;
  };
  descriptor?: {
    displayName?: string;
    patientUuid?: string;
  };
  id?: number;
  lastError?: {
    message?: string;
    name?: string;
  };
  type?: string;
}

interface CacheEvidence {
  cacheNames: Array<string>;
  matchedEntries: Array<{
    cacheKey?: string;
    cacheName?: string;
    expectedUrl: string;
  }>;
}

async function readResponse(response: APIResponse): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function expectOk<T>(response: APIResponse, message: string): Promise<T> {
  const body = await readResponse(response);
  expect(response.ok(), `${message} (${response.status()}): ${JSON.stringify(body)?.slice(0, 600)}`).toBeTruthy();
  return body as T;
}

async function createApiContext(playwright: PlaywrightWorkerArgs['playwright']) {
  const { username, password } = getE2ECredentials();

  return playwright.request.newContext({
    baseURL: `${gateConfig.apiBaseUrl}/ws/rest/v1/`,
    ignoreHTTPSErrors: shouldIgnoreHTTPSErrors(),
    httpCredentials: { username, password },
  });
}

async function validateBackendContract(api: APIRequestContext): Promise<IdentifierType> {
  const [location, visitType, identifierType, identifierSource] = await Promise.all([
    expectOk<OpenmrsResource>(
      await api.get(`location/${gateConfig.locationUuid}?v=custom:(uuid,display,retired)`),
      `Configured ${gateConfig.target} location is unavailable`,
    ),
    expectOk<OpenmrsResource>(
      await api.get(`visittype/${gateConfig.visitTypeUuid}?v=custom:(uuid,display,retired)`),
      'Configured offline visit type is unavailable',
    ),
    expectOk<IdentifierType>(
      await api.get(
        `patientidentifiertype/${gateConfig.identifierTypeUuid}?v=custom:(uuid,display,retired,locationBehavior)`,
      ),
      'Configured synthetic patient identifier type is unavailable',
    ),
    expectOk<IdentifierSource>(
      await api.get(
        `idgen/identifiersource/${gateConfig.identifierSourceUuid}?v=custom:(uuid,retired,identifierType:(uuid))`,
      ),
      'Configured synthetic patient identifier source is unavailable',
    ),
  ]);

  expect(location.retired ?? false, `Configured ${gateConfig.target} location must be active`).toBe(false);
  expect(visitType.retired ?? false, 'Configured offline visit type must be active').toBe(false);
  expect(identifierType.retired ?? false, 'Configured synthetic patient identifier type must be active').toBe(false);
  expect(identifierSource.retired ?? false, 'Configured synthetic patient identifier source must be active').toBe(
    false,
  );
  expect(
    identifierSource.identifierType?.uuid,
    'Configured identifier source must generate the configured identifier type',
  ).toBe(gateConfig.identifierTypeUuid);
  expect(
    ['NOT_USED', 'REQUIRED'],
    `Unsupported patient identifier location behavior: ${identifierType.locationBehavior ?? 'missing'}`,
  ).toContain(identifierType.locationBehavior);

  return identifierType;
}

async function createSyntheticPatient(
  api: APIRequestContext,
  identifierType: IdentifierType,
  familyName: string,
  onCreated: (patientUuid: string) => void,
): Promise<PatientResponse> {
  const generatedIdentifier = await expectOk<{ identifier?: string }>(
    await api.post(`idgen/identifiersource/${gateConfig.identifierSourceUuid}/identifier`, { data: {} }),
    `Could not generate a ${gateConfig.target} synthetic patient identifier`,
  );
  expect(
    generatedIdentifier.identifier,
    `${gateConfig.target} identifier generation returned no identifier`,
  ).toBeTruthy();

  const identifier = {
    identifier: generatedIdentifier.identifier,
    identifierType: gateConfig.identifierTypeUuid,
    preferred: true,
    ...(identifierType.locationBehavior === 'REQUIRED' ? { location: gateConfig.locationUuid } : {}),
  };

  const patient = await expectOk<PatientResponse>(
    await api.post('patient', {
      data: {
        identifiers: [identifier],
        person: {
          addresses: [
            {
              address1: `${gateConfig.target} synthetic data`,
              cityVillage: 'Synthetic',
              country: 'Peru',
              stateProvince: gateConfig.target,
            },
          ],
          attributes: [],
          birthdate: '2000-01-01',
          birthdateEstimated: false,
          dead: false,
          gender: 'F',
          names: [{ familyName, givenName: 'SYNTHETIC', preferred: true }],
        },
      },
    }),
    `Could not create the ${gateConfig.target} synthetic patient`,
  );

  expect(patient.uuid, 'Synthetic patient creation returned no UUID').toBeTruthy();
  onCreated(patient.uuid);

  const persistedPatient = await expectOk<PatientResponse>(
    await api.get(`patient/${patient.uuid}?v=custom:(uuid,voided,person:(names:(givenName,familyName)))`),
    `Could not verify the ${gateConfig.target} synthetic patient`,
  );
  const persistedName = persistedPatient.person?.names?.find(
    (name) => name.givenName === 'SYNTHETIC' && name.familyName === familyName,
  );
  expect(persistedPatient.voided ?? false, 'Synthetic patient was unexpectedly voided').toBe(false);
  expect(persistedName, 'Created patient does not carry the SYNTHETIC name marker').toBeTruthy();

  return patient;
}

async function getPatientVisits(api: APIRequestContext, patientUuid: string): Promise<Array<VisitResponse>> {
  const representation =
    'custom:(uuid,voided,startDatetime,stopDatetime,patient:(uuid),visitType:(uuid),location:(uuid))';
  const response = await expectOk<OpenmrsSearchResponse<VisitResponse>>(
    await api.get(
      `visit?patient=${encodeURIComponent(patientUuid)}&includeInactive=true&limit=100&v=${encodeURIComponent(representation)}`,
    ),
    `Could not inspect visits for the ${gateConfig.target} synthetic patient`,
  );

  return response.results ?? [];
}

async function cleanupSyntheticPatient(api: APIRequestContext, patientUuid: string): Promise<void> {
  const visits = await getPatientVisits(api, patientUuid);
  const reason = encodeURIComponent(cleanupReason);

  for (const visit of visits) {
    const response = await api.delete(`visit/${visit.uuid}?reason=${reason}`, { data: {} });
    expect(response.ok(), `Could not void synthetic visit ${visit.uuid} (${response.status()})`).toBeTruthy();
  }

  const patientResponse = await api.delete(`patient/${patientUuid}?reason=${reason}`, { data: {} });
  expect(
    patientResponse.ok(),
    `Could not void ${gateConfig.target} synthetic patient ${patientUuid} (${patientResponse.status()})`,
  ).toBeTruthy();
}

async function ensureServiceWorkerControl(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? 'missing';
        }),
      { message: 'The SIH Salus service worker must activate', timeout: 30_000 },
    )
    .toBe('activated');

  // A newly installed worker does not control the document that installed it.
  // Reload online once so every subsequent cache assertion has a controller.
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      message: 'The SIH Salus page must be controlled by its service worker',
      timeout: 30_000,
    })
    .toBe(true);

  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      controllerScriptUrl: navigator.serviceWorker.controller?.scriptURL,
      scope: registration?.scope,
    };
  });
}

async function inspectCaches(page: Page, expectedUrls: Array<string>): Promise<CacheEvidence> {
  return page.evaluate(async (urls) => {
    const cacheNames = await caches.keys();
    const cacheEntries = await Promise.all(
      cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        return keys.map((request) => ({ cacheKey: request.url, cacheName }));
      }),
    );
    const flattenedEntries = cacheEntries.flat();

    return {
      cacheNames,
      matchedEntries: urls.map((expectedUrl) => {
        const expected = new URL(expectedUrl);
        const match = flattenedEntries.find((entry) => {
          const cached = new URL(entry.cacheKey);
          return cached.origin === expected.origin && cached.pathname === expected.pathname;
        });

        return {
          expectedUrl,
          cacheKey: match?.cacheKey,
          cacheName: match?.cacheName,
        };
      }),
    };
  }, expectedUrls);
}

async function expectCached(page: Page, expectedUrls: Array<string>): Promise<CacheEvidence> {
  let evidence: CacheEvidence = { cacheNames: [], matchedEntries: [] };

  await expect
    .poll(
      async () => {
        evidence = await inspectCaches(page, expectedUrls);
        return evidence.matchedEntries.filter((entry) => entry.cacheKey).length;
      },
      { message: 'Every required shell and patient resource must exist in Cache Storage', timeout: 30_000 },
    )
    .toBe(expectedUrls.length);

  expect(evidence.cacheNames.length, 'Cache Storage must contain at least one named cache').toBeGreaterThan(0);
  return evidence;
}

async function readSyncQueue(page: Page): Promise<Array<StoredSyncItem>> {
  const records = await page.evaluate(async () => {
    return new Promise<Array<unknown>>((resolve, reject) => {
      const openRequest = indexedDB.open('EsmOffline');
      let databaseExisted = true;

      openRequest.onupgradeneeded = () => {
        databaseExisted = false;
        openRequest.transaction?.abort();
      };
      openRequest.onerror = () => {
        reject(openRequest.error ?? new Error('Could not open the EsmOffline IndexedDB database.'));
      };
      openRequest.onsuccess = () => {
        const database = openRequest.result;

        if (!databaseExisted || !database.objectStoreNames.contains('syncQueue')) {
          database.close();
          reject(new Error('The EsmOffline syncQueue object store does not exist.'));
          return;
        }

        const transaction = database.transaction('syncQueue', 'readonly');
        const getAllRequest = transaction.objectStore('syncQueue').getAll();
        getAllRequest.onerror = () => {
          reject(getAllRequest.error ?? new Error('Could not read the offline synchronization queue.'));
        };
        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result as Array<unknown>);
        };
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('Could not complete the offline queue read.'));
        };
      };
    });
  });

  return records as Array<StoredSyncItem>;
}

async function queueOfflineVisit(page: Page, patientUuid: string, startDatetime: string) {
  return page.evaluate(
    async ({ locationUuid, patientUuid, startDatetime, visitTypeUuid }) => {
      const patientCommon = (
        globalThis as typeof globalThis & {
          _openmrs_esm_patient_common_lib?: {
            createOfflineVisitForPatient?: (
              patientUuid: string,
              locationUuid: string,
              visitTypeUuid: string,
              startDatetime: Date,
            ) => Promise<{
              location: string;
              patient?: string;
              uuid: string;
              visitType: string;
            }>;
          };
        }
      )._openmrs_esm_patient_common_lib;

      if (navigator.onLine) {
        throw new Error('Refusing to queue the acceptance visit while the browser reports online.');
      }

      if (!navigator.serviceWorker.controller) {
        throw new Error('Refusing to queue the acceptance visit without service-worker control.');
      }

      if (typeof patientCommon?.createOfflineVisitForPatient !== 'function') {
        throw new Error('The deployed patient chart does not expose its supported offline visit action.');
      }

      return patientCommon.createOfflineVisitForPatient(
        patientUuid,
        locationUuid,
        visitTypeUuid,
        new Date(startDatetime),
      );
    },
    {
      locationUuid: gateConfig.locationUuid,
      patientUuid,
      startDatetime,
      visitTypeUuid: gateConfig.visitTypeUuid,
    },
  );
}

function expectSingleQueuedVisit(queue: Array<StoredSyncItem>, patientUuid: string, visitUuid: string) {
  expect(queue, 'Exactly one offline action must be queued').toHaveLength(1);
  expect(queue[0]).toMatchObject({
    type: 'visit',
    content: {
      location: gateConfig.locationUuid,
      patient: patientUuid,
      uuid: visitUuid,
      visitType: gateConfig.visitTypeUuid,
    },
    descriptor: {
      displayName: 'Offline visit',
      patientUuid,
    },
  });
  expect(queue[0]?.lastError, 'A newly queued visit must not have a synchronization error').toBeUndefined();
}

async function expectQueueToDrain(page: Page): Promise<void> {
  try {
    await expect
      .poll(async () => (await readSyncQueue(page)).length, {
        message: 'Manual synchronization must remove the successfully persisted action from IndexedDB',
        timeout: 45_000,
      })
      .toBe(0);
  } catch (error) {
    const pending = await readSyncQueue(page);
    const errors = pending.map((item) => ({ id: item.id, lastError: item.lastError, type: item.type }));
    throw new Error(`Offline queue did not drain. Pending action summary: ${JSON.stringify(errors)}`, {
      cause: error,
    });
  }
}

test('branded browser preserves one queued visit across offline reload and synchronizes it exactly once', async ({
  browser,
  context,
  page,
  playwright,
}, testInfo) => {
  const api = await createApiContext(playwright);
  const familyName = `${gateConfig.target}OfflineGate${Date.now()}${randomUUID().slice(0, 8)}`;
  let patientUuid: string | undefined;

  try {
    const identifierType = await validateBackendContract(api);
    const patient = await createSyntheticPatient(api, identifierType, familyName, (createdPatientUuid) => {
      patientUuid = createdPatientUuid;
    });
    patientUuid = patient.uuid;
    expect(await getPatientVisits(api, patientUuid), 'A fresh synthetic patient must not have visits').toEqual([]);

    await testInfo.attach('offline-laptop-gate-context.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            browserProject: testInfo.project.name,
            browserVersion: browser.version(),
            expectedBuildSha: gateConfig.expectedBuildSha,
            syntheticPatientUuid: patientUuid,
            target: gateConfig.target,
            targetOrigin: gateConfig.allowedOrigin,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });

    const buildInfo = await expectOk<BuildInfo>(
      await page.request.get(`${gateConfig.spaBaseUrl}/build-info.json`),
      `Could not read the deployed ${gateConfig.target} build identity`,
    );
    expect(
      buildInfo.gitSha?.toLowerCase(),
      `${gateConfig.target} is not serving the explicitly accepted frontend SHA`,
    ).toBe(gateConfig.expectedBuildSha);

    await page.goto(`patient/${patientUuid}/chart/Patient%20Summary`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
    await expect(page).toHaveURL(new RegExp(`/patient/${patientUuid}/chart`));
    await expect(page.getByText(new RegExp(familyName, 'i')).first()).toBeVisible({ timeout: 30_000 });

    const userAgent = await page.evaluate(() => navigator.userAgent);
    const brands = await page.evaluate(
      () =>
        (
          navigator as Navigator & {
            userAgentData?: { brands?: Array<{ brand: string; version: string }> };
          }
        ).userAgentData?.brands ?? [],
    );
    const browserIdentity = `${userAgent} ${brands.map((brand) => brand.brand).join(' ')}`;
    if (testInfo.project.name === 'Google Chrome Stable') {
      expect(browserIdentity, 'Chrome project must run the installed Google Chrome channel').toMatch(
        /Google Chrome|Chrome\//i,
      );
      expect(browserIdentity, 'Chrome project must not fall back to Microsoft Edge').not.toMatch(
        /Microsoft Edge|Edg\//i,
      );
    } else if (testInfo.project.name === 'Microsoft Edge Stable') {
      expect(browserIdentity, 'Edge project must run the installed Microsoft Edge channel').toMatch(
        /Microsoft Edge|Edg\//i,
      );
    } else {
      throw new Error(`Unsupported offline laptop browser project: ${testInfo.project.name}`);
    }

    expect(new URL(page.url()).origin, 'The browser navigated outside the explicit non-production allowlist').toBe(
      gateConfig.allowedOrigin,
    );

    const serviceWorker = await ensureServiceWorkerControl(page);
    expect(serviceWorker.controllerScriptUrl, 'The controlling worker must be the SIH Salus worker').toBe(
      `${gateConfig.spaBaseUrl}/service-worker.js`,
    );
    expect(serviceWorker.scope, 'The worker scope must be the SIH Salus SPA').toBe(`${gateConfig.spaBaseUrl}/`);
    await expect(page.getByText(new RegExp(familyName, 'i')).first()).toBeVisible({ timeout: 30_000 });

    const deployedOfflineVisitTypeUuid = await page.evaluate(async () => {
      const framework = (
        globalThis as typeof globalThis & {
          _openmrs_esm_framework?: {
            getConfig?: (moduleName: string) => Promise<{ offlineVisitTypeUuid?: string }>;
          };
        }
      )._openmrs_esm_framework;

      if (typeof framework?.getConfig !== 'function') {
        throw new Error('The deployed patient chart does not expose its runtime configuration contract.');
      }

      return (await framework.getConfig('@sihsalus/esm-patient-chart-app')).offlineVisitTypeUuid;
    });
    expect(
      deployedOfflineVisitTypeUuid,
      'The configured gate visit type must match the deployed patient-chart offline visit type',
    ).toBe(gateConfig.visitTypeUuid);

    // Warm the actual manual synchronization UI before disconnecting, then reload
    // the chart under service-worker control so its FHIR patient response is cached.
    await page.goto('offline-tools/actions', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Offline Actions|Acciones sin Internet/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Update offline patients|Actualizar pacientes sin internet/i }),
    ).toBeVisible();
    await page.goto(`patient/${patientUuid}/chart/Patient%20Summary`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(new RegExp(familyName, 'i')).first()).toBeVisible({ timeout: 30_000 });

    const expectedCacheUrls = [
      `${gateConfig.spaBaseUrl}/index.html`,
      `${gateConfig.spaBaseUrl}/importmap.json`,
      `${gateConfig.spaBaseUrl}/routes.registry.json`,
      `${gateConfig.apiBaseUrl}/ws/fhir2/R4/Patient/${patientUuid}`,
    ];
    const cacheEvidence = await expectCached(page, expectedCacheUrls);

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    const offlineReload = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(offlineReload, 'Offline reload must return a service-worker response').not.toBeNull();
    expect(offlineReload?.ok(), 'Offline reload response must be successful').toBe(true);
    expect(offlineReload?.fromServiceWorker(), 'Offline reload must be served by the service worker').toBe(true);
    await expect(page.getByText(new RegExp(familyName, 'i')).first()).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expectCached(page, expectedCacheUrls);

    const startDatetime = new Date().toISOString();
    const offlineVisit = await queueOfflineVisit(page, patientUuid, startDatetime);
    const queuedBeforeReload = await readSyncQueue(page);
    expectSingleQueuedVisit(queuedBeforeReload, patientUuid, offlineVisit.uuid);

    const queuedReload = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(queuedReload?.fromServiceWorker(), 'Queued action reload must remain service-worker backed').toBe(true);
    await expect(page.getByText(new RegExp(familyName, 'i')).first()).toBeVisible({ timeout: 30_000 });
    expectSingleQueuedVisit(await readSyncQueue(page), patientUuid, offlineVisit.uuid);

    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    expectSingleQueuedVisit(await readSyncQueue(page), patientUuid, offlineVisit.uuid);

    await page.goto('offline-tools/actions', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Offline visit', { exact: true })).toBeVisible({ timeout: 30_000 });
    const synchronizeButton = page.getByRole('button', {
      name: /Update offline patients|Actualizar pacientes sin internet/i,
    });
    await expect(synchronizeButton).toBeEnabled();
    await synchronizeButton.click();
    await expectQueueToDrain(page);
    await expect(page.getByText(/No actions pending upload|No hay acciones pendientes de carga/i)).toBeVisible({
      timeout: 30_000,
    });

    const persistedVisits = await getPatientVisits(api, patientUuid);
    expect(persistedVisits, 'Backend must contain exactly one visit after one queued action').toHaveLength(1);
    expect(persistedVisits[0]).toMatchObject({
      uuid: offlineVisit.uuid,
      patient: { uuid: patientUuid },
      visitType: { uuid: gateConfig.visitTypeUuid },
      location: { uuid: gateConfig.locationUuid },
    });
    expect(persistedVisits[0]?.stopDatetime, 'Synchronized offline visit must be closed by the handler').toBeTruthy();

    await testInfo.attach('offline-laptop-gate-evidence.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            browserProject: testInfo.project.name,
            browserVersion: browser.version(),
            buildSha: buildInfo.gitSha,
            cacheNames: cacheEvidence.cacheNames,
            cachedUrls: cacheEvidence.matchedEntries,
            queuedActionType: 'visit',
            serviceWorker,
            syntheticPatientUuid: patientUuid,
            synchronizedVisitUuid: persistedVisits[0]?.uuid,
            target: gateConfig.target,
            targetOrigin: gateConfig.allowedOrigin,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  } finally {
    await context.setOffline(false).catch(() => undefined);
    try {
      if (patientUuid) {
        await cleanupSyntheticPatient(api, patientUuid);
      }
    } finally {
      await api.dispose();
    }
  }
});
