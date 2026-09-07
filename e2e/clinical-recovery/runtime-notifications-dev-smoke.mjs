import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { chromium, request as playwrightRequest } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { recoveredNotificationMetadata } from './notification-config-schema.mjs';
import { blockClinicalRecovery } from './quarantine.mjs';

// Recovered proposal only. The hard quarantine is checked before configuration or side effects.
export async function runRecoveredNotificationSmoke() {
  blockClinicalRecovery();

  const DEV_ORIGIN = 'https://gidis-hsc-dev.inf.pucp.edu.pe';
  const OPENMRS_BASE = `${DEV_ORIGIN}/openmrs`;
  const SPA_BASE = `${OPENMRS_BASE}/spa`;
  const REST_BASE = `${OPENMRS_BASE}/ws/rest/v1`;
  const EXPECTED_SHA = process.env.SIHSALUS_E2E_EXPECTED_SHA?.trim();
  const EXPECTED_VERSION = process.env.SIHSALUS_E2E_EXPECTED_VERSION?.trim();
  const LUHN_MOD_30_CHARACTERS = '0123456789ACDEFGHJKLMNPRTUVWXY';
  const {
    HSC_LOCATION_UUID,
    OTHER_FACILITY_UUID,
    IDENTIFIER_TYPE_UUID,
    LAB_ROLE_UUID,
    PHARMACY_ROLE_UUID,
    LOGIN_ROLE_UUID,
    PREFERRED_VISIT_TYPE_UUID,
    ENCOUNTER_TYPE_UUID,
    ENCOUNTER_ROLE_UUID,
    OUTPATIENT_CARE_SETTING_UUID,
    TEST_ORDER_TYPE_UUID,
    DRUG_ORDER_TYPE_UUID,
    LAB_TEST_CONCEPT_UUID,
    UNRELATED_OBS_CONCEPT_UUID,
    PREFERRED_DRUG_UUID,
    QUANTITY_UNITS_UUID,
  } = recoveredNotificationMetadata;
  const STATE_FILE = new URL('../.runtime-notifications-dev-state.json', import.meta.url);

  const username = (process.env.SIHSALUS_E2E_USERNAME ?? process.env.E2E_USER_ADMIN_USERNAME)?.trim();
  const password = process.env.SIHSALUS_E2E_PASSWORD ?? process.env.E2E_USER_ADMIN_PASSWORD;
  assert.equal(process.env.SIHSALUS_E2E_TARGET, 'DEV', 'This destructive smoke is restricted to DEV.');
  assert.equal(process.env.SIHSALUS_E2E_ORIGIN, DEV_ORIGIN, 'The exact DEV origin is required.');
  assert.ok(username, 'SIHSALUS_E2E_USERNAME is required.');
  assert.ok(password, 'SIHSALUS_E2E_PASSWORD is required.');
  assert.match(EXPECTED_SHA ?? '', /^[0-9a-f]{40}$/i, 'SIHSALUS_E2E_EXPECTED_SHA must be the exact deployed commit.');
  assert.match(
    EXPECTED_VERSION ?? '',
    /^\d+\.\d+\.\d+$/,
    'SIHSALUS_E2E_EXPECTED_VERSION must be the exact deployed release.',
  );
  assert.equal(
    existsSync(STATE_FILE),
    false,
    `A previous smoke left ${STATE_FILE.pathname}; inspect and clean those exact synthetic UUIDs before retrying.`,
  );

  const created = {
    person: null,
    patient: null,
    visit: null,
    encounter: null,
    unrelatedObs: null,
    labResultObs: null,
    testOrder: null,
    drugOrder: null,
    laboratoryUser: null,
    laboratoryUserPerson: null,
    pharmacyUser: null,
    pharmacyUserPerson: null,
  };
  const checks = [];
  let browser;
  let hscContext;
  let laboratoryContext;
  let otherContext;
  let pharmacyContext;
  let labPage;
  let pharmacyPage;
  let laboratoryMonitor;
  let otherMonitor;
  let pharmacyMonitor;
  let baselineMetrics;

  function persistCreatedState() {
    writeFileSync(STATE_FILE, `${JSON.stringify({ target: 'DEV', origin: DEV_ORIGIN, created }, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  function pass(name) {
    checks.push(name);
    process.stdout.write(`PASS ${name}\n`);
  }

  async function request(context, method, path, data) {
    const response = await context.request.fetch(`${REST_BASE}/${path}`, {
      method,
      ...(data === undefined ? {} : { data }),
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });
    if (!response.ok()) throw new Error(`REST request failed with HTTP ${response.status()}.`);
    if (response.status() === 204) return null;
    return response.json();
  }

  async function rawRequest(context, method, url, data) {
    return context.request.fetch(url, {
      method,
      ...(data === undefined ? {} : { data }),
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });
  }

  async function requireActiveResource(context, resource, uuid) {
    const value = await request(context, 'GET', `${resource}/${uuid}?v=custom:(uuid,retired)`);
    assert.equal(value.uuid, uuid, `${resource}/${uuid} must resolve in DEV`);
    assert.notEqual(value.retired, true, `${resource}/${uuid} must be active`);
  }

  async function createSessionState(locationUuid, credentials) {
    const apiContext = await playwrightRequest.newContext({
      extraHTTPHeaders: {
        Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
      },
    });
    try {
      const response = await apiContext.post(`${REST_BASE}/session`, {
        data: { sessionLocation: locationUuid, locale: 'en' },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
      });
      assert.equal(response.status(), 200, 'The one-time DEV authentication request must return 200');
      const session = await response.json();
      assert.equal(session.authenticated, true, 'The one-time DEV authentication must succeed');
      assert.equal(session.sessionLocation?.uuid, locationUuid, 'The DEV session location must be exact');
      const storageState = await apiContext.storageState();
      assert.ok(
        storageState.cookies.some(({ name }) => name === 'JSESSIONID'),
        'The authenticated JSESSIONID must exist',
      );
      return { session, storageState };
    } finally {
      await apiContext.dispose();
    }
  }

  function hasPrivilege(session, privilegeName) {
    return (session.user?.privileges ?? []).some(
      (privilege) => (privilege.name ?? privilege.display) === privilegeName,
    );
  }

  async function findProvider(context) {
    const preferred = await request(
      context,
      'GET',
      `provider?q=admin&v=${encodeURIComponent('custom:(uuid,retired)')}&limit=20`,
    );
    let provider = preferred.results?.find((candidate) => candidate.uuid && !candidate.retired);
    if (!provider) {
      const fallback = await request(
        context,
        'GET',
        `provider?v=${encodeURIComponent('custom:(uuid,retired)')}&limit=100`,
      );
      provider = fallback.results?.find((candidate) => candidate.uuid && !candidate.retired);
    }
    assert.match(provider?.uuid ?? '', /^[0-9a-f-]{36}$/i, 'An active provider is required for synthetic orders');
    return provider.uuid;
  }

  async function findVisitType(context) {
    try {
      await requireActiveResource(context, 'visittype', PREFERRED_VISIT_TYPE_UUID);
      return PREFERRED_VISIT_TYPE_UUID;
    } catch {
      const response = await request(
        context,
        'GET',
        `visittype?v=${encodeURIComponent('custom:(uuid,display,retired)')}&limit=100`,
      );
      const visitType = response.results?.find((candidate) => candidate.uuid && !candidate.retired);
      assert.match(visitType?.uuid ?? '', /^[0-9a-f-]{36}$/i, 'An active visit type is required');
      return visitType.uuid;
    }
  }

  async function findDrug(context) {
    const preferredResponse = await rawRequest(
      context,
      'GET',
      `${REST_BASE}/drug/${PREFERRED_DRUG_UUID}?v=${encodeURIComponent('custom:(uuid,retired,concept:(uuid))')}`,
    );
    if (preferredResponse.ok()) {
      const preferred = await preferredResponse.json();
      if (preferred.uuid && preferred.concept?.uuid && !preferred.retired) return preferred;
    }
    const response = await request(
      context,
      'GET',
      `drug?v=${encodeURIComponent('custom:(uuid,retired,concept:(uuid))')}&limit=100`,
    );
    const drug = response.results?.find((candidate) => candidate.uuid && candidate.concept?.uuid && !candidate.retired);
    assert.ok(drug, 'An active drug with a concept is required');
    return drug;
  }

  function withLuhnMod30CheckDigit(value) {
    let factor = 2;
    let sum = 0;
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const codePoint = LUHN_MOD_30_CHARACTERS.indexOf(value[index]);
      assert.notEqual(codePoint, -1, 'The synthetic identifier seed must use the Luhn Mod-30 alphabet');
      const product = factor * codePoint;
      factor = factor === 2 ? 1 : 2;
      sum += Math.floor(product / LUHN_MOD_30_CHARACTERS.length) + (product % LUHN_MOD_30_CHARACTERS.length);
    }
    const checkCodePoint =
      (LUHN_MOD_30_CHARACTERS.length - (sum % LUHN_MOD_30_CHARACTERS.length)) % LUHN_MOD_30_CHARACTERS.length;
    return `${value}${LUHN_MOD_30_CHARACTERS[checkCodePoint]}`;
  }

  async function findUnusedPatientIdentifier(context) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let seed = 'Y';
      while (seed.length < 6) {
        seed += LUHN_MOD_30_CHARACTERS[crypto.randomInt(LUHN_MOD_30_CHARACTERS.length)];
      }
      const candidate = withLuhnMod30CheckDigit(seed);
      const result = await request(
        context,
        'GET',
        `patient?identifier=${encodeURIComponent(candidate)}&v=${encodeURIComponent('custom:(uuid,voided)')}&limit=2`,
      );
      if ((result.results ?? []).length === 0) return candidate;
    }
    throw new Error('Could not reserve an unused synthetic patient identifier after 20 attempts');
  }

  async function createTemporaryUser(context, roleUuids, label, userKey, personKey) {
    const suffix = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
    const person = await request(context, 'POST', 'person', {
      names: [{ givenName: 'SYNTHETIC', familyName: `Realtime${label}${suffix}` }],
      gender: 'M',
      birthdate: '1990-01-01',
      birthdateEstimated: false,
      addresses: [],
      attributes: [],
    });
    created[personKey] = person.uuid;
    persistCreatedState();
    const credentials = {
      username: `e2e_${label.toLowerCase()}_${suffix}`,
      password: `E2E-${crypto.randomBytes(18).toString('base64url')}!aA7`,
    };
    const user = await request(context, 'POST', 'user', {
      person: person.uuid,
      username: credentials.username,
      password: credentials.password,
      roles: Array.isArray(roleUuids) ? roleUuids : [roleUuids],
    });
    created[userKey] = user.uuid;
    persistCreatedState();
    return credentials;
  }

  async function getMetrics(context) {
    const response = await rawRequest(context, 'GET', `${OPENMRS_BASE}/ws/sihsalus/notifications/status`);
    assert.equal(response.status(), 200, 'Authenticated notification status must return 200');
    assert.match(response.headers()['cache-control'] ?? '', /no-store/, 'Notification status must not be cached');
    const metrics = await response.json();
    assert.deepEqual(Object.keys(metrics).sort(), [
      'deliveryFailureCount',
      'liveDeliveryCount',
      'publishedEventCount',
      'replayDeliveryCount',
      'replayMissCount',
      'retainedEventCount',
      'subscriberCount',
    ]);
    return metrics;
  }

  async function startCollectors(page) {
    await page.goto(`${SPA_BASE}/build-info.json`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.evaluate(
      async ({ openmrsBase }) => {
        const eventTypes = ['LAB_ORDER_CREATED', 'LAB_RESULT_READY', 'MEDICATION_ORDER_CREATED'];
        const state = {
          sse: [],
          websocket: [],
          sseOpen: false,
          websocketOpen: false,
          websocketClose: null,
          errors: [],
        };
        window.__sihsalusRealtimeSmoke = state;
        const source = new EventSource(`${openmrsBase}/ws/sihsalus/notifications/sse?topics=laboratory,pharmacy`, {
          withCredentials: true,
        });
        window.__sihsalusRealtimeSmokeSse = source;
        source.onopen = () => {
          state.sseOpen = true;
        };
        source.onerror = () => {
          state.errors.push('sse-reconnect');
        };
        eventTypes.forEach((eventType) => {
          source.addEventListener(eventType, (event) => {
            try {
              state.sse.push(JSON.parse(event.data));
            } catch {
              state.errors.push('sse-json');
            }
          });
        });

        const ticketResponse = await fetch(`${openmrsBase}/ws/sihsalus/notifications/websocket-ticket`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!ticketResponse.ok) {
          throw new Error(`WebSocket ticket failed with HTTP ${ticketResponse.status}`);
        }
        const { connectionId: browserConnectionId } = await ticketResponse.json();
        if (!/^[0-9a-f-]{36}$/i.test(browserConnectionId ?? '')) {
          throw new Error('WebSocket ticket response is invalid');
        }
        const websocketBase = openmrsBase.replace(/^http/, 'ws');
        const socket = new WebSocket(
          `${websocketBase}/ws/sihsalus/notifications?connectionId=${browserConnectionId}&topics=laboratory,pharmacy`,
        );
        window.__sihsalusRealtimeSmokeWs = socket;
        socket.onopen = () => {
          state.websocketOpen = true;
        };
        socket.onerror = () => {
          state.errors.push('websocket');
        };
        socket.onclose = (event) => {
          state.websocketClose = {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          };
        };
        socket.onmessage = (event) => {
          try {
            state.websocket.push(JSON.parse(event.data));
          } catch {
            state.errors.push('websocket-json');
          }
        };
      },
      { openmrsBase: OPENMRS_BASE },
    );
    await page.waitForFunction(
      () => window.__sihsalusRealtimeSmoke?.sseOpen && window.__sihsalusRealtimeSmoke?.websocketOpen,
      undefined,
      { timeout: 30_000 },
    );
  }

  async function stopCollectors(page) {
    if (!page || page.isClosed()) return;
    await page.evaluate(() => {
      window.__sihsalusRealtimeSmokeSse?.close();
      window.__sihsalusRealtimeSmokeWs?.close(1000, 'test-complete');
    });
  }

  async function waitForWireEvent(page, transport, type, orderUuid) {
    try {
      await page.waitForFunction(
        ({ transport: expectedTransport, type: expectedType, orderUuid: expectedOrderUuid }) =>
          window.__sihsalusRealtimeSmoke?.[expectedTransport]?.some(
            (event) => event.type === expectedType && event.payload?.orderUuid === expectedOrderUuid,
          ),
        { transport, type, orderUuid },
        { timeout: 30_000 },
      );
    } catch {
      throw new Error('The expected notification event was not received.');
    }
    return page.evaluate(
      ({ transport: expectedTransport, type: expectedType, orderUuid: expectedOrderUuid }) =>
        window.__sihsalusRealtimeSmoke[expectedTransport].find(
          (event) => event.type === expectedType && event.payload?.orderUuid === expectedOrderUuid,
        ),
      { transport, type, orderUuid },
    );
  }

  function assertMinimalEvent(event, { type, topic, orderUuid, forbiddenValues }) {
    assert.deepEqual(Object.keys(event).sort(), ['id', 'payload', 'timestamp', 'topic', 'type']);
    assert.match(event.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(event.topic, topic);
    assert.equal(event.type, type);
    assert.deepEqual(Object.keys(event.payload), ['orderUuid']);
    assert.equal(event.payload.orderUuid, orderUuid);
    assert.ok(!Number.isNaN(Date.parse(event.timestamp)), 'The event timestamp must be ISO-8601');
    const wire = JSON.stringify(event);
    forbiddenValues.forEach((value) => {
      assert.equal(wire.includes(value), false, 'The event must not contain patient or clinical details');
    });
  }

  async function assertNoEvent(page, orderUuid, message) {
    await page.waitForTimeout(2_000);
    const leaked = await page.evaluate(
      (expectedOrderUuid) =>
        [...window.__sihsalusRealtimeSmoke.sse, ...window.__sihsalusRealtimeSmoke.websocket].some(
          (event) => event.payload?.orderUuid === expectedOrderUuid,
        ),
      orderUuid,
    );
    assert.equal(leaked, false, message);
  }

  async function waitForVisible(locator, label, timeout = 60_000) {
    try {
      await locator.first().waitFor({ state: 'visible', timeout });
    } catch {
      throw new Error(`${label}: expected element was not visible.`);
    }
    assert.equal(await locator.first().isVisible(), true, label);
  }

  async function dismissBlockedServiceWorkerWarning(page, serviceWorkers) {
    if (serviceWorkers !== 'block') return;
    const warning = page.locator('.omrs-inline-notifications-container').filter({
      hasText: /Offline setup unavailable|Modo sin conexi[oó]n no disponible/i,
    });
    try {
      await warning.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      return;
    }
    const closeButton = warning.getByRole('button').last();
    await closeButton.click();
    await warning.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  async function assertBrowserPrivilege(page, privilegeName) {
    const summary = await page.evaluate(
      async ({ restBase, expectedPrivilege }) => {
        const response = await fetch(`${restBase}/session`);
        const session = await response.json();
        const privileges = (session.user?.privileges ?? []).map((privilege) => privilege.name ?? privilege.display);
        return {
          status: response.status,
          authenticated: session.authenticated,
          hasPrivilege: privileges.includes(expectedPrivilege),
        };
      },
      { restBase: REST_BASE, expectedPrivilege: privilegeName },
    );
    assert.deepEqual(
      {
        status: summary.status,
        authenticated: summary.authenticated,
        hasPrivilege: summary.hasPrivilege,
      },
      { status: 200, authenticated: true, hasPrivilege: true },
      'The browser page must retain its authenticated privilege-scoped session.',
    );
  }

  async function verifyDeleted(context, resource, uuid, deletedProperty = 'voided') {
    const verification = await rawRequest(
      context,
      'GET',
      `${REST_BASE}/${resource}/${uuid}?v=${encodeURIComponent(`custom:(uuid,${deletedProperty})`)}`,
    );
    if (verification.status() === 404) return;
    assert.equal(verification.ok(), true, `Cleanup verification for ${resource} must be readable or 404`);
    const value = await verification.json();
    assert.equal(value[deletedProperty], true, `Synthetic ${resource} must be ${deletedProperty}`);
  }

  async function cleanupResource(context, resource, uuid, deletedProperty = 'voided') {
    if (!uuid) return;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await rawRequest(
          context,
          'DELETE',
          `${REST_BASE}/${resource}/${uuid}?reason=${encodeURIComponent('Automated E2E cleanup')}`,
          {},
        );
        assert.ok(
          [200, 204, 404].includes(response.status()),
          `Cleanup DELETE ${resource} returned ${response.status()}`,
        );
        await verifyDeleted(context, resource, uuid, deletedProperty);
        return;
      } catch (error) {
        const isTransientNetworkFailure =
          /EADDRNOTAVAIL|ENOTFOUND|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed/i.test(
            error instanceof Error ? error.message : String(error),
          );
        if (!isTransientNetworkFailure || attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }

  async function closePages() {
    await Promise.allSettled([
      stopCollectors(laboratoryMonitor),
      stopCollectors(otherMonitor),
      stopCollectors(pharmacyMonitor),
      labPage?.close(),
      pharmacyPage?.close(),
      laboratoryMonitor?.close(),
      otherMonitor?.close(),
      pharmacyMonitor?.close(),
    ]);
  }

  async function cleanup() {
    if (!hscContext) return [];
    const failures = [];
    const targets = [
      ['order', created.drugOrder, 'voided'],
      ['order', created.testOrder, 'voided'],
      ['obs', created.labResultObs, 'voided'],
      ['obs', created.unrelatedObs, 'voided'],
      ['encounter', created.encounter, 'voided'],
      ['visit', created.visit, 'voided'],
      ['patient', created.patient, 'voided'],
      ['person', created.person, 'voided'],
      ['user', created.laboratoryUser, 'retired'],
      ['user', created.pharmacyUser, 'retired'],
      ['person', created.laboratoryUserPerson, 'voided'],
      ['person', created.pharmacyUserPerson, 'voided'],
    ];
    for (const [resource, uuid, deletedProperty] of targets) {
      try {
        await cleanupResource(hscContext, resource, uuid, deletedProperty);
      } catch (error) {
        failures.push(`${resource}:${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return failures;
  }

  let mainFailure;
  let cleanupFailures = [];
  try {
    browser = await chromium.launch({ headless: true });
    const serviceWorkers = process.env.SIHSALUS_E2E_SERVICE_WORKERS ?? 'block';
    assert.ok(['allow', 'block'].includes(serviceWorkers), 'SIHSALUS_E2E_SERVICE_WORKERS must be allow or block');
    const contextOptions = {
      baseURL: `${SPA_BASE}/`,
      locale: 'en-US',
      serviceWorkers,
    };
    const adminAuthentication = await createSessionState(HSC_LOCATION_UUID, {
      username,
      password,
    });
    hscContext = await browser.newContext({
      ...contextOptions,
      storageState: adminAuthentication.storageState,
    });

    const buildInfoResponse = await rawRequest(hscContext, 'GET', `${SPA_BASE}/build-info.json`);
    assert.equal(buildInfoResponse.status(), 200);
    const buildInfo = await buildInfoResponse.json();
    assert.equal(buildInfo.version, EXPECTED_VERSION);
    assert.equal(buildInfo.gitSha, EXPECTED_SHA);
    pass('deployed frontend is the exact configured candidate');

    await Promise.all([
      requireActiveResource(hscContext, 'location', HSC_LOCATION_UUID),
      requireActiveResource(hscContext, 'location', OTHER_FACILITY_UUID),
      requireActiveResource(hscContext, 'patientidentifiertype', IDENTIFIER_TYPE_UUID),
      requireActiveResource(hscContext, 'encountertype', ENCOUNTER_TYPE_UUID),
      requireActiveResource(hscContext, 'encounterrole', ENCOUNTER_ROLE_UUID),
      requireActiveResource(hscContext, 'caresetting', OUTPATIENT_CARE_SETTING_UUID),
      requireActiveResource(hscContext, 'ordertype', TEST_ORDER_TYPE_UUID),
      requireActiveResource(hscContext, 'ordertype', DRUG_ORDER_TYPE_UUID),
      requireActiveResource(hscContext, 'concept', LAB_TEST_CONCEPT_UUID),
      requireActiveResource(hscContext, 'concept', UNRELATED_OBS_CONCEPT_UUID),
      requireActiveResource(hscContext, 'concept', QUANTITY_UNITS_UUID),
      requireActiveResource(hscContext, 'role', LAB_ROLE_UUID),
      requireActiveResource(hscContext, 'role', PHARMACY_ROLE_UUID),
      requireActiveResource(hscContext, 'role', LOGIN_ROLE_UUID),
    ]);
    const providerUuid = await findProvider(hscContext);
    const visitTypeUuid = await findVisitType(hscContext);
    const drug = await findDrug(hscContext);
    pass('required DEV metadata is active');

    const laboratoryCredentials = await createTemporaryUser(
      hscContext,
      [LAB_ROLE_UUID, LOGIN_ROLE_UUID],
      'Lab',
      'laboratoryUser',
      'laboratoryUserPerson',
    );
    const pharmacyCredentials = await createTemporaryUser(
      hscContext,
      PHARMACY_ROLE_UUID,
      'Pharmacy',
      'pharmacyUser',
      'pharmacyUserPerson',
    );
    // OpenMRS updates the user's lastLoginTimestamp during Basic Auth. Starting two
    // sessions for the same test user concurrently can race on user_property's
    // primary key, so authenticate serially before exercising concurrent streams.
    const laboratoryAuthentication = await createSessionState(HSC_LOCATION_UUID, laboratoryCredentials);
    const otherLaboratoryAuthentication = await createSessionState(OTHER_FACILITY_UUID, laboratoryCredentials);
    const pharmacyAuthentication = await createSessionState(HSC_LOCATION_UUID, pharmacyCredentials);
    laboratoryContext = await browser.newContext({
      ...contextOptions,
      storageState: laboratoryAuthentication.storageState,
    });
    otherContext = await browser.newContext({
      ...contextOptions,
      storageState: otherLaboratoryAuthentication.storageState,
    });
    pharmacyContext = await browser.newContext({
      ...contextOptions,
      storageState: pharmacyAuthentication.storageState,
    });
    const laboratorySession = laboratoryAuthentication.session;
    const otherLaboratorySession = otherLaboratoryAuthentication.session;
    const pharmacySession = pharmacyAuthentication.session;

    assert.equal(hasPrivilege(laboratorySession, 'app:home.laboratorio'), true);
    assert.equal(hasPrivilege(laboratorySession, 'app:home.farmacia'), false);
    assert.equal(hasPrivilege(laboratorySession, 'Get People'), true);
    assert.equal(hasPrivilege(laboratorySession, 'View People'), false);
    assert.equal(hasPrivilege(otherLaboratorySession, 'app:home.laboratorio'), true);
    assert.equal(hasPrivilege(pharmacySession, 'app:home.farmacia'), true);
    assert.equal(hasPrivilege(pharmacySession, 'app:home.laboratorio'), false);
    pass('temporary role-specific users authenticate with isolated privileges and facilities');

    labPage = await laboratoryContext.newPage();

    await labPage.goto(`${SPA_BASE}/home/laboratory`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    assert.equal(
      new URL(labPage.url()).pathname.includes('/login'),
      false,
      'The laboratory page must remain authenticated',
    );
    await assertBrowserPrivilege(labPage, 'app:home.laboratorio');
    await waitForVisible(
      labPage
        .locator('[data-extension-id="laboratory-dashboard"]')
        .getByText(/Laboratory|Laboratorio/i, { exact: true }),
      'Laboratory must render',
      20_000,
    );
    await dismissBlockedServiceWorkerWarning(labPage, serviceWorkers);

    pharmacyPage = await pharmacyContext.newPage();

    await pharmacyPage.goto(`${SPA_BASE}/dispensing`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    assert.equal(
      new URL(pharmacyPage.url()).pathname.includes('/login'),
      false,
      'The pharmacy page must remain authenticated',
    );
    await assertBrowserPrivilege(pharmacyPage, 'app:home.farmacia');
    await waitForVisible(
      pharmacyPage
        .locator('[data-extension-id="dispensing-dashboard"]')
        .getByText(/Pharmacy|Dispensing|Farmacia/i, { exact: true }),
      'Pharmacy must render',
      20_000,
    );
    await dismissBlockedServiceWorkerWarning(pharmacyPage, serviceWorkers);
    baselineMetrics = await getMetrics(hscContext);
    pass('laboratory and pharmacy dashboards render for their exact role profiles');

    const identifier = await findUnusedPatientIdentifier(hscContext);
    const token = `RTN${Date.now()
      .toString()
      .slice(-10)
      .replace(/\d/g, (digit) => String.fromCharCode(65 + Number(digit)))}`;
    const patient = await request(hscContext, 'POST', 'patient', {
      identifiers: [
        {
          identifier,
          identifierType: IDENTIFIER_TYPE_UUID,
          preferred: true,
        },
      ],
      person: {
        addresses: [],
        attributes: [],
        birthdate: '2020-02-01',
        birthdateEstimated: true,
        dead: false,
        gender: 'M',
        names: [
          {
            familyName: `Realtime${token}`,
            givenName: 'SYNTHETIC',
            middleName: '',
            preferred: true,
          },
        ],
      },
    });
    created.patient = patient.uuid;
    created.person = patient.uuid;
    persistCreatedState();

    const visitStart = new Date(Date.now() - 120_000).toISOString();
    const visit = await request(hscContext, 'POST', 'visit', {
      startDatetime: visitStart,
      patient: patient.uuid,
      location: HSC_LOCATION_UUID,
      visitType: visitTypeUuid,
      attributes: [],
    });
    created.visit = visit.uuid;
    persistCreatedState();

    const encounterDatetime = new Date(Date.now() - 60_000).toISOString();
    const encounter = await request(hscContext, 'POST', 'encounter', {
      encounterDatetime,
      patient: patient.uuid,
      visit: visit.uuid,
      encounterProviders: [{ encounterRole: ENCOUNTER_ROLE_UUID, provider: providerUuid }],
      location: HSC_LOCATION_UUID,
      encounterType: ENCOUNTER_TYPE_UUID,
    });
    created.encounter = encounter.uuid;
    persistCreatedState();

    const unrelatedObs = await request(hscContext, 'POST', 'obs', {
      person: patient.uuid,
      encounter: encounter.uuid,
      concept: UNRELATED_OBS_CONCEPT_UUID,
      location: HSC_LOCATION_UUID,
      obsDatetime: encounterDatetime,
      status: 'FINAL',
      value: 4.2,
    });
    created.unrelatedObs = unrelatedObs.uuid;
    persistCreatedState();
    pass('synthetic patient, visit, encounter and unrelated observation created');

    laboratoryMonitor = await laboratoryContext.newPage();
    otherMonitor = await otherContext.newPage();
    pharmacyMonitor = await pharmacyContext.newPage();
    // Establish the transports serially. Opening three authenticated SSE/WS pairs
    // while multiple service workers precache the SPA can exhaust VPN sockets.
    await startCollectors(laboratoryMonitor);
    await startCollectors(otherMonitor);
    await startCollectors(pharmacyMonitor);
    await laboratoryMonitor.waitForTimeout(1_000);
    const collectorStates = await Promise.all(
      [laboratoryMonitor, otherMonitor, pharmacyMonitor].map((page) =>
        page.evaluate(() => ({
          ...window.__sihsalusRealtimeSmoke,
          websocketReadyState: window.__sihsalusRealtimeSmokeWs?.readyState,
        })),
      ),
    );

    collectorStates.forEach((state) => {
      assert.equal(state.websocketReadyState, 1, 'WebSocket must remain open.');
      assert.equal(state.websocketClose, null, 'WebSocket must not be rejected.');
    });
    pass('role-specific SSE and WebSocket transports opened at both facilities');

    const testOrder = await request(hscContext, 'POST', 'order', {
      orderType: TEST_ORDER_TYPE_UUID,
      type: 'testorder',
      action: 'NEW',
      urgency: 'ROUTINE',
      dateActivated: encounterDatetime,
      careSetting: OUTPATIENT_CARE_SETTING_UUID,
      encounter: encounter.uuid,
      patient: patient.uuid,
      concept: LAB_TEST_CONCEPT_UUID,
      orderer: providerUuid,
      orderReasonNonCoded: 'E2E runtime notification smoke',
    });
    created.testOrder = testOrder.uuid;
    persistCreatedState();
    const forbiddenLabValues = [patient.uuid, token, LAB_TEST_CONCEPT_UUID, identifier];
    for (const transport of ['sse', 'websocket']) {
      const event = await waitForWireEvent(laboratoryMonitor, transport, 'LAB_ORDER_CREATED', testOrder.uuid);
      assertMinimalEvent(event, {
        type: 'LAB_ORDER_CREATED',
        topic: 'laboratory',
        orderUuid: testOrder.uuid,
        forbiddenValues: forbiddenLabValues,
      });
    }
    await assertNoEvent(otherMonitor, testOrder.uuid, 'A laboratory event must not cross the facility boundary');
    await assertNoEvent(
      pharmacyMonitor,
      testOrder.uuid,
      'A laboratory event must not reach a same-facility pharmacy-only user',
    );
    await waitForVisible(
      labPage.getByText(/New laboratory order|Nueva orden de laboratorio/i, {
        exact: true,
      }),
      'The laboratory dashboard must show a generic order notice',
      30_000,
    );
    const initialRow = labPage.getByRole('row').filter({ hasText: token }).first();
    await waitForVisible(initialRow, 'The realtime-refreshed laboratory worklist must contain the synthetic order');
    pass('laboratory order reaches SSE, WebSocket and the visible worklist without PHI in the event');

    await initialRow.getByLabel(/Expand current row|Expandir/i).click();
    await labPage
      .getByRole('button', {
        name: /Pick lab request|Seleccione una solicitud de laboratorio/i,
      })
      .first()
      .click();
    await labPage
      .getByRole('button', {
        name: /Pick up lab request|Recoger solicitud de laboratorio/i,
      })
      .click();
    await waitForVisible(
      labPage.getByText(/successfully picked an order|seleccionado una orden exitosamente/i),
      'The order must move to in-progress',
    );
    await labPage.getByRole('tab', { name: /In progress|En progreso/i }).click();
    const inProgressRow = labPage.getByRole('row').filter({ hasText: token }).first();
    await waitForVisible(inProgressRow, 'The in-progress order must be visible');
    await inProgressRow.getByLabel(/Expand current row|Expandir/i).click();
    await labPage
      .getByRole('button', {
        name: /Add lab results|Agregar resultados de laboratorio/i,
      })
      .first()
      .click();
    await waitForVisible(
      labPage.getByText(/Enter test results|Ingresar resultados de pruebas/i, {
        exact: true,
      }),
      'The result workspace must open',
    );
    const resultInput = labPage.getByRole('spinbutton', {
      name: /Alanina Aminotransferasa/i,
    });
    await resultInput.click();
    await resultInput.pressSequentially('35');
    await resultInput.press('Tab');
    assert.equal(await resultInput.inputValue(), '35');
    const saveResultButton = labPage.getByRole('button', {
      name: /Save and close|Guardar y cerrar/i,
    });
    let observationResponse;
    try {
      [observationResponse] = await Promise.all([
        labPage.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/openmrs/ws/rest/v1/obs' && response.request().method() === 'POST',
          { timeout: 30_000 },
        ),
        saveResultButton.click(),
      ]);
    } catch {
      throw new Error('Laboratory result save did not produce the expected observation response.');
    }
    if (!observationResponse.ok())
      throw new Error(`Laboratory observation POST failed with HTTP ${observationResponse.status()}.`);
    await waitForVisible(
      labPage.getByText(
        /Lab results for .* successfully updated|resultados de laboratorio .* actualizados exitosamente/i,
      ),
      'The result must save successfully',
    );

    for (const transport of ['sse', 'websocket']) {
      const event = await waitForWireEvent(laboratoryMonitor, transport, 'LAB_RESULT_READY', testOrder.uuid);
      assertMinimalEvent(event, {
        type: 'LAB_RESULT_READY',
        topic: 'laboratory',
        orderUuid: testOrder.uuid,
        forbiddenValues: forbiddenLabValues,
      });
    }
    await assertNoEvent(otherMonitor, testOrder.uuid, 'A result event must not cross the facility boundary');
    await assertNoEvent(
      pharmacyMonitor,
      testOrder.uuid,
      'A result event must not reach a same-facility pharmacy-only user',
    );
    await waitForVisible(
      labPage.getByText(/Laboratory result available|Resultado de laboratorio disponible/i, { exact: true }),
      'The laboratory dashboard must show the result-ready notice',
      30_000,
    );

    const encounterAfterResult = await request(
      hscContext,
      'GET',
      `encounter/${encounter.uuid}?v=${encodeURIComponent(
        'custom:(uuid,obs:(uuid,voided,concept:(uuid),order:(uuid),value))',
      )}`,
    );
    const activeObs = encounterAfterResult.obs?.filter((obs) => !obs.voided) ?? [];
    assert.ok(
      activeObs.some((obs) => obs.uuid === unrelatedObs.uuid),
      'The unrelated observation must survive',
    );
    const resultObs = activeObs.find((obs) => obs.order?.uuid === testOrder.uuid);
    assert.ok(resultObs?.uuid, 'The result observation must be linked to the laboratory order');
    created.labResultObs = resultObs.uuid;
    persistCreatedState();
    assert.equal(resultObs.concept?.uuid, LAB_TEST_CONCEPT_UUID);
    const completedOrder = await request(
      hscContext,
      'GET',
      `order/${testOrder.uuid}?v=${encodeURIComponent('custom:(uuid,fulfillerStatus,voided)')}`,
    );
    assert.equal(completedOrder.fulfillerStatus, 'COMPLETED');
    pass('lab result saves through Obs, completes the order and preserves unrelated encounter observations');

    const drugOrder = await request(hscContext, 'POST', 'order', {
      orderType: DRUG_ORDER_TYPE_UUID,
      type: 'drugorder',
      action: 'NEW',
      drug: drug.uuid,
      urgency: 'ROUTINE',
      dateActivated: encounterDatetime,
      careSetting: OUTPATIENT_CARE_SETTING_UUID,
      encounter: encounter.uuid,
      patient: patient.uuid,
      concept: drug.concept.uuid,
      orderer: providerUuid,
      dosingType: 'org.openmrs.FreeTextDosingInstructions',
      dosingInstructions: 'E2E synthetic instructions',
      quantity: 1,
      quantityUnits: QUANTITY_UNITS_UUID,
      numRefills: 0,
      orderReasonNonCoded: 'E2E runtime notification smoke',
    });
    created.drugOrder = drugOrder.uuid;
    persistCreatedState();
    const forbiddenDrugValues = [patient.uuid, token, drug.uuid, drug.concept.uuid, identifier];
    for (const transport of ['sse', 'websocket']) {
      const event = await waitForWireEvent(pharmacyMonitor, transport, 'MEDICATION_ORDER_CREATED', drugOrder.uuid);
      assertMinimalEvent(event, {
        type: 'MEDICATION_ORDER_CREATED',
        topic: 'pharmacy',
        orderUuid: drugOrder.uuid,
        forbiddenValues: forbiddenDrugValues,
      });
    }
    await assertNoEvent(otherMonitor, drugOrder.uuid, 'A medication event must not cross the facility boundary');
    await assertNoEvent(
      laboratoryMonitor,
      drugOrder.uuid,
      'A medication event must not reach a same-facility laboratory-only user',
    );
    await waitForVisible(
      pharmacyPage.getByText(/New medication order|Nueva orden de medicamentos/i, { exact: true }),
      'The pharmacy dashboard must show a generic medication-order notice',
      30_000,
    );
    pass('medication order reaches SSE, WebSocket and the visible pharmacy notification without PHI');

    const finalMetrics = await getMetrics(hscContext);
    assert.ok(
      finalMetrics.publishedEventCount >= baselineMetrics.publishedEventCount + 3,
      'At least three clinical events must be published',
    );
    assert.ok(
      finalMetrics.liveDeliveryCount >= baselineMetrics.liveDeliveryCount + 6,
      'The positive SSE and WebSocket subscribers must receive all three events',
    );
    assert.equal(
      finalMetrics.deliveryFailureCount,
      baselineMetrics.deliveryFailureCount,
      'The smoke must not add delivery failures',
    );
    pass('administrative metrics are aggregate-only and record delivery without failures');
  } catch {
    mainFailure = new Error('Recovered notification smoke failed; retain private recovery state.');
  } finally {
    await closePages();
    await Promise.allSettled([laboratoryContext?.close(), otherContext?.close(), pharmacyContext?.close()]);
    cleanupFailures = await cleanup();

    await hscContext?.close();
    await browser?.close();
  }

  if (cleanupFailures.length === 0 && created.patient) {
    pass('all synthetic clinical resources were voided and verified');
  }
  if (cleanupFailures.length) {
    process.stderr.write('CLEANUP_FAILURE: retain private recovery state.\n');
  }
  if (mainFailure) {
    process.stderr.write('FAIL: recovered notification smoke did not pass.\n');
  }
  if (mainFailure || cleanupFailures.length) {
    throw new Error('Recovered notification smoke failed; retain private recovery state.');
  } else {
    process.stdout.write(`RESULT PASS checks=${checks.length}\n`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  void runRecoveredNotificationSmoke().catch(() => {
    process.stderr.write('Clinical recovery is quarantined; no notification smoke was executed.\n');
    process.exitCode = 1;
  });
}
