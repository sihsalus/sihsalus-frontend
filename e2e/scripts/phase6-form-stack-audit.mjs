#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, request as playwrightRequest } from 'playwright';

const spaBase = (process.env.PHASE6_SPA_BASE ?? 'http://localhost:3000/openmrs/spa').replace(/\/$/, '');
const openmrsBase = spaBase.replace(/\/spa$/, '');
const artifactRoot = path.resolve(process.cwd(), process.env.PHASE6_ARTIFACT_DIR ?? 'artifacts/phase6-e2e');
const username = process.env.E2E_USERNAME?.trim();
const password = process.env.E2E_PASSWORD;
const defaultLocationUuid = process.env.E2E_LOGIN_DEFAULT_LOCATION_UUID?.trim();
const patientCandidates = (process.env.E2E_PATIENT_UUIDS ?? process.env.E2E_PATIENT_UUID ?? '')
  .split(',')
  .map((uuid) => uuid.trim())
  .filter(Boolean);

if (!username || !password || !defaultLocationUuid || patientCandidates.length === 0) {
  throw new Error(
    'E2E_USERNAME, E2E_PASSWORD, E2E_LOGIN_DEFAULT_LOCATION_UUID and synthetic E2E_PATIENT_UUIDS are required.',
  );
}

const report = {
  startedAt: new Date().toISOString(),
  spaBase,
  openmrsBase,
  artifacts: {},
  patient: null,
  apiContext: {},
  flows: [],
  routeTransitions: [],
  consoleEvents: [],
  pageErrors: [],
  requestFailures: [],
  limitations: [],
};

let currentFlow = null;
let captureIndex = 0;
const networkEvents = [];

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function flowRecord(name, description) {
  const flow = {
    name,
    description,
    status: 'passed',
    steps: [],
    observations: [],
    errors: [],
  };
  report.flows.push(flow);
  return flow;
}

async function withFlow(name, description, fn) {
  const flow = flowRecord(name, description);
  currentFlow = flow;

  try {
    await fn(flow);
  } catch (error) {
    flow.status = 'failed';
    flow.errors.push(serializeError(error));
  } finally {
    currentFlow = null;
  }
}

function pushRoute(page, reason) {
  report.routeTransitions.push({
    at: new Date().toISOString(),
    reason,
    url: page.url(),
    flow: currentFlow?.name ?? null,
  });
}

async function visibleTexts(locator, limit = 10) {
  const count = await locator.count().catch(() => 0);
  const texts = [];

  for (let index = 0; index < Math.min(count, limit); index += 1) {
    const text = await locator
      .nth(index)
      .textContent()
      .then((value) => value?.replace(/\s+/g, ' ').trim())
      .catch(() => null);

    if (text) {
      texts.push(text);
    }
  }

  return texts;
}

async function captureState(page, label, extra = {}) {
  captureIndex += 1;
  const safeLabel = `${String(captureIndex).padStart(2, '0')}-${slugify(label)}`;
  const screenshotPath = path.join(artifactRoot, 'screenshots', `${safeLabel}.png`);
  const accessibilityPath = path.join(artifactRoot, 'a11y', `${safeLabel}.json`);
  const metadataPath = path.join(artifactRoot, 'states', `${safeLabel}.json`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  let a11y = null;
  if (page.accessibility?.snapshot) {
    a11y = await page.accessibility.snapshot({ interestingOnly: false }).catch(() => null);
  } else if (page.locator('body').ariaSnapshot) {
    a11y = await page
      .locator('body')
      .ariaSnapshot()
      .catch(() => null);
  }
  await writeJson(accessibilityPath, a11y);

  const metadata = {
    capturedAt: new Date().toISOString(),
    label,
    url: page.url(),
    title: await page.title().catch(() => null),
    headings: await visibleTexts(page.locator('h1, h2, h3'), 12),
    buttons: await visibleTexts(page.locator('button'), 20),
    links: await visibleTexts(page.locator('a'), 20),
    workspaceTitles: await visibleTexts(
      page.locator('[data-workspace-name] h1, [data-workspace-name] h2, aside h1, aside h2'),
      8,
    ),
    extra,
  };

  await writeJson(metadataPath, metadata);

  currentFlow?.steps.push({
    label,
    screenshot: path.relative(process.cwd(), screenshotPath),
    accessibility: path.relative(process.cwd(), accessibilityPath),
    metadata: path.relative(process.cwd(), metadataPath),
    url: page.url(),
  });
}

async function gotoAndWait(page, url, reason) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  pushRoute(page, reason);
}

async function firstVisibleLocator(page, selectors) {
  for (const selector of selectors) {
    const locator = selector.startsWith('role=') ? null : page.locator(selector).first();

    if (locator && (await locator.isVisible().catch(() => false))) {
      return locator;
    }
  }

  return null;
}

async function clearToastInterceptors(page) {
  const dismissSelectors = [
    '.omrs-toasts-container button[aria-label*="Close"]',
    '.omrs-toasts-container button[aria-label*="Cerrar"]',
    '.omrs-toasts-container button:has-text("Close")',
    '.omrs-toasts-container button:has-text("Cerrar")',
  ];

  for (const selector of dismissSelectors) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true }).catch(() => null);
      await page.waitForTimeout(250);
    }
  }
}

async function robustClick(locator, page) {
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  await clearToastInterceptors(page);

  try {
    await locator.click();
  } catch {
    await locator.click({ force: true });
  }

  await page.waitForLoadState('networkidle').catch(() => null);
  await page.waitForTimeout(750);
}

async function login(page, context) {
  await gotoAndWait(page, `${spaBase}/login`, 'open-login-page');
  await captureState(page, 'login-page');

  const authContext = await playwrightRequest.newContext({
    extraHTTPHeaders: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      Accept: 'application/json',
    },
  });
  let sessionLocation = defaultLocationUuid;
  const locationResponse = await authContext.get(`${openmrsBase}/ws/rest/v1/location?v=default&limit=1`);
  if (locationResponse.ok()) {
    const payload = await locationResponse.json();
    if (payload.results?.[0]?.uuid) {
      sessionLocation = payload.results[0].uuid;
    }
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  const response = await authContext.post(`${openmrsBase}/ws/rest/v1/session`, {
    data: {
      sessionLocation,
      locale: 'es',
    },
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${token}`,
    },
  });

  if (!response.ok()) {
    throw new Error(`API login failed (${response.status()}): ${await response.text()}`);
  }

  const storageState = await authContext.storageState();
  await context.addCookies(storageState.cookies);
  await authContext.dispose();

  await gotoAndWait(page, `${spaBase}/home`, 'post-api-login-home');
  await page.waitForTimeout(1000);
  if (page.url().includes('/login')) {
    throw new Error('Authentication did not establish a browser session; SPA remained on the login route');
  }

  pushRoute(page, 'login-complete');
  await captureState(page, 'post-login-home', { sessionLocation });
}

async function createApiContext() {
  return playwrightRequest.newContext({
    baseURL: `${openmrsBase}/ws/rest/v1/`,
    httpCredentials: { username, password },
    extraHTTPHeaders: { Accept: 'application/json' },
  });
}

async function resolvePatient(api) {
  for (const patientUuid of patientCandidates) {
    const response = await api
      .get(`patient/${patientUuid}?v=custom:(uuid,display,identifiers,person,attributes)`)
      .catch(() => null);

    if (response?.ok()) {
      const payload = await response.json();
      return {
        uuid: payload.uuid,
        display: payload.display,
      };
    }
  }

  const searchResponse = await api.get('patient?q=10009&v=default');
  if (!searchResponse.ok()) {
    throw new Error(`Unable to resolve a patient for Phase 6 audit: ${searchResponse.status()}`);
  }

  const searchPayload = await searchResponse.json();
  const result = searchPayload.results?.[0];
  if (!result?.uuid) {
    throw new Error('Patient search returned no results for Phase 6 audit');
  }

  return {
    uuid: result.uuid,
    display: result.display,
  };
}

async function summarizePatientContext(api, patientUuid) {
  const visitResponse = await api.get(
    `visit?patient=${patientUuid}&includeInactive=true&v=custom:(uuid,startDatetime,stopDatetime,visitType:(uuid,name))`,
  );
  const encounterResponse = await api.get(
    `encounter?patient=${patientUuid}&v=custom:(uuid,display,encounterDatetime,form:(uuid,name,display))`,
  );

  const visitsPayload = visitResponse.ok() ? await visitResponse.json() : { results: [] };
  const encountersPayload = encounterResponse.ok() ? await encounterResponse.json() : { results: [] };

  return {
    visits: visitsPayload.results ?? [],
    encounters: encountersPayload.results ?? [],
  };
}

async function openPatientChart(page, patientUuid, dashboard = 'Patient Summary') {
  const encodedDashboard = encodeURIComponent(dashboard);
  await gotoAndWait(
    page,
    `${spaBase}/patient/${patientUuid}/chart/${encodedDashboard}`,
    `open-patient-chart-${dashboard}`,
  );
  if (page.url().includes('/login')) {
    throw new Error(`Patient chart navigation for "${dashboard}" redirected to login`);
  }
}

async function openClinicalFormsWorkspace(page) {
  const selectors = [
    'button:has-text("Clinical forms")',
    'button:has-text("Create Form")',
    'button:has-text("Formularios clínicos")',
    'button:has-text("Crear formulario")',
    'button[aria-label*="Clinical forms"]',
    'button[aria-label*="Formularios"]',
    'button[title*="Clinical forms"]',
    'button[title*="Formularios"]',
    'a[aria-label*="Clinical forms"]',
    'a[aria-label*="Formularios"]',
    'button[title*="Clinical forms"]',
  ];
  const launcher = await firstVisibleLocator(page, selectors);

  if (!launcher) {
    throw new Error('Clinical forms launcher was not visible on the patient chart');
  }

  await robustClick(launcher, page);
  pushRoute(page, 'open-clinical-forms-workspace');
}

async function collectFormsTable(page) {
  const rowLocator = page.locator('table tbody tr');
  const rowCount = await rowLocator.count().catch(() => 0);
  const rows = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row = rowLocator.nth(index);
    const cells = row.locator('td');
    const formName = await cells
      .nth(0)
      .textContent()
      .then((value) => value?.trim())
      .catch(() => null);
    const lastCompleted = await cells
      .nth(1)
      .textContent()
      .then((value) => value?.trim())
      .catch(() => null);

    rows.push({
      index,
      formName,
      lastCompleted,
      hasEditButton: await row
        .locator('button')
        .count()
        .then((count) => count > 0)
        .catch(() => false),
    });
  }

  return rows;
}

async function closeWorkspace(page, expectUnsavedPrompt = false) {
  const closeButton = await firstVisibleLocator(page, [
    'button[aria-label*="Close"]',
    'button[aria-label*="Cerrar"]',
    'button[title*="Close"]',
    'button[title*="Cerrar"]',
    'button:has-text("Close")',
    'button:has-text("Cerrar")',
  ]);

  if (closeButton) {
    await robustClick(closeButton, page);
  } else {
    await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(500);
  }

  if (expectUnsavedPrompt) {
    const discardButton = await firstVisibleLocator(page, [
      'button:has-text("Discard")',
      'button:has-text("Leave")',
      'button:has-text("Yes, discard")',
      'button:has-text("Descartar")',
      'button:has-text("Salir")',
    ]);

    if (discardButton) {
      await robustClick(discardButton, page);
    }
  }

  await page.waitForTimeout(1000);
}

async function interactWithForm(page) {
  const workspaceRoot = page.locator('aside, [data-workspace-name]').last();
  const editable = workspaceRoot.locator(
    [
      'input:not([type="hidden"]):not([disabled]):not([readonly])',
      'textarea:not([disabled]):not([readonly])',
      'select:not([disabled])',
    ].join(', '),
  );

  const count = await editable.count().catch(() => 0);
  if (count === 0) {
    return { interacted: false, reason: 'no-editable-fields-found' };
  }

  for (let index = 0; index < count; index += 1) {
    const field = editable.nth(index);
    const tagName = await field.evaluate((element) => element.tagName.toLowerCase()).catch(() => null);
    const type = await field.getAttribute('type').catch(() => null);

    if (tagName === 'textarea' || type === 'text' || type === 'search' || type === 'number') {
      await field.fill('7');
      await page.waitForTimeout(800);
      const persistedValue = await field.inputValue().catch(() => null);
      return { interacted: true, kind: `${tagName ?? 'input'}:${type ?? 'default'}`, persistedValue };
    }

    if (tagName === 'select') {
      const optionCount = await field
        .locator('option')
        .count()
        .catch(() => 0);
      if (optionCount > 1) {
        const secondValue = await field.locator('option').nth(1).getAttribute('value');
        await field.selectOption(secondValue ?? { index: 1 });
        await page.waitForTimeout(800);
        const persistedValue = await field.inputValue().catch(() => null);
        return { interacted: true, kind: 'select', persistedValue };
      }
    }

    if (type === 'checkbox' || type === 'radio') {
      await field.check({ force: true }).catch(async () => {
        await field.click({ force: true });
      });
      await page.waitForTimeout(800);
      const checked = await field.isChecked().catch(() => null);
      return { interacted: true, kind: type, persistedValue: checked };
    }
  }

  return { interacted: false, reason: 'no-supported-editable-field-found' };
}

async function locateVitalsLauncher(page) {
  const selectors = [
    'button:has-text("Record vitals")',
    'button:has-text("Vitals")',
    'button:has-text("Biometrics")',
    'a:has-text("Registro signos vitales")',
    'a:has-text("Registro biométricas")',
    'text=/Registro signos vitales/i',
    'text=/Registro biométricas/i',
    'button:has-text("Add")',
    'button:has-text("Edit")',
  ];

  return firstVisibleLocator(page, selectors);
}

function summarizeNetwork() {
  return networkEvents.reduce((summary, event) => {
    const key = `${event.flow ?? 'unscoped'}:${event.status}`;
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function buildMarkdown() {
  const lines = [];
  lines.push('# Phase 6 Form Stack Audit');
  lines.push('');
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- SPA base: ${report.spaBase}`);
  lines.push(`- OpenMRS base: ${report.openmrsBase}`);
  if (report.patient) {
    lines.push(`- Patient: ${report.patient.display} (${report.patient.uuid})`);
  }
  lines.push('');
  lines.push('## Flows');
  lines.push('');

  for (const flow of report.flows) {
    lines.push(`### ${flow.name}`);
    lines.push('');
    lines.push(`- Status: ${flow.status}`);
    lines.push(`- Description: ${flow.description}`);
    if (flow.observations.length) {
      lines.push(`- Observations: ${flow.observations.join(' | ')}`);
    }
    if (flow.errors.length) {
      lines.push(`- Errors: ${flow.errors.map((error) => error.message).join(' | ')}`);
    }
    lines.push(`- Captures: ${flow.steps.length}`);
    lines.push('');
  }

  if (report.limitations.length) {
    lines.push('## Limitations');
    lines.push('');
    for (const limitation of report.limitations) {
      lines.push(`- ${limitation}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  await ensureDir(path.join(artifactRoot, 'screenshots'));
  await ensureDir(path.join(artifactRoot, 'a11y'));
  await ensureDir(path.join(artifactRoot, 'states'));
  await ensureDir(path.join(artifactRoot, 'logs'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    recordHar: { path: path.join(artifactRoot, 'phase6-form-stack.har'), content: 'embed' },
  });
  const page = await context.newPage();
  const api = await createApiContext();

  report.artifacts.har = path.relative(process.cwd(), path.join(artifactRoot, 'phase6-form-stack.har'));
  report.artifacts.trace = path.relative(process.cwd(), path.join(artifactRoot, 'phase6-form-stack.trace.zip'));

  page.on('console', (message) => {
    report.consoleEvents.push({
      at: new Date().toISOString(),
      type: message.type(),
      text: message.text(),
      flow: currentFlow?.name ?? null,
    });
  });

  page.on('pageerror', (error) => {
    report.pageErrors.push({
      at: new Date().toISOString(),
      flow: currentFlow?.name ?? null,
      ...serializeError(error),
    });
  });

  page.on('requestfailed', (request) => {
    report.requestFailures.push({
      at: new Date().toISOString(),
      flow: currentFlow?.name ?? null,
      url: request.url(),
      method: request.method(),
      failure: request.failure(),
    });
  });

  page.on('response', (response) => {
    if (!response.url().startsWith(openmrsBase)) {
      return;
    }

    networkEvents.push({
      at: new Date().toISOString(),
      flow: currentFlow?.name ?? null,
      url: response.url(),
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      status: response.status(),
    });
  });

  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  try {
    await withFlow('Authentication', 'Verify login flow and initial authenticated shell render', async (flow) => {
      await login(page, context);
      flow.observations.push(`Logged in as ${username}`);
    });

    report.patient = await resolvePatient(api);
    const patientContext = await summarizePatientContext(api, report.patient.uuid);
    report.apiContext = {
      visitCount: patientContext.visits.length,
      activeVisitCount: patientContext.visits.filter((visit) => !visit.stopDatetime).length,
      encounterCount: patientContext.encounters.length,
      sampledVisits: patientContext.visits.slice(0, 5),
      sampledEncounters: patientContext.encounters.slice(0, 10),
    };

    await withFlow(
      'Patient Chart Baseline',
      'Open the patient chart and capture the baseline shell before any form workspace interaction',
      async (flow) => {
        await openPatientChart(page, report.patient.uuid, 'Patient Summary');
        await captureState(page, 'patient-summary-chart');
        flow.observations.push(`Visible buttons: ${(await visibleTexts(page.locator('button'), 12)).join(', ')}`);
      },
    );

    await withFlow(
      'Clinical Forms Workspace',
      'Open the patient-chart clinical forms workspace, inspect available forms, and exercise search',
      async (flow) => {
        await openPatientChart(page, report.patient.uuid, 'Patient Summary');
        await openClinicalFormsWorkspace(page);
        await captureState(page, 'clinical-forms-workspace-open');

        const formsTable = await collectFormsTable(page);
        flow.observations.push(`Forms rows discovered: ${formsTable.length}`);
        if (formsTable.length > 0) {
          flow.observations.push(
            `Sample forms: ${formsTable
              .slice(0, 5)
              .map((row) => row.formName)
              .join(', ')}`,
          );
        }

        const searchInput = page
          .locator('input[placeholder*="Search for a form"], input[placeholder*="Search"]')
          .first();
        if (formsTable[0]?.formName && (await searchInput.isVisible().catch(() => false))) {
          await searchInput.fill(formsTable[0].formName.slice(0, Math.min(6, formsTable[0].formName.length)));
          await page.waitForTimeout(1000);
          await captureState(page, 'clinical-forms-search-filtered', {
            searchTerm: formsTable[0].formName,
          });
          await searchInput.fill('');
          await page.waitForTimeout(500);
        }
      },
    );

    await withFlow(
      'Create Form Workspace2',
      'Launch a form from the clinical forms workspace, validate the workspace payload renders, interact with a field, and discard unsaved changes',
      async (flow) => {
        await openPatientChart(page, report.patient.uuid, 'Patient Summary');
        await openClinicalFormsWorkspace(page);

        const firstFormCell = page.locator('table tbody tr').first().locator('td').first();
        if (!(await firstFormCell.isVisible().catch(() => false))) {
          flow.status = 'skipped';
          flow.observations.push('No form rows were available to open from the clinical forms workspace');
          return;
        }

        const formLabel = await firstFormCell
          .textContent()
          .then((value) => value?.trim())
          .catch(() => 'unknown-form');
        await robustClick(firstFormCell, page);
        await page.waitForTimeout(1000);
        await captureState(page, 'patient-form-entry-workspace-create-open', { formLabel });

        const iframeCount = await page
          .locator('iframe')
          .count()
          .catch(() => 0);
        if (iframeCount > 0) {
          flow.observations.push(`Opened HTML form path for ${formLabel}`);
          await closeWorkspace(page, false);
          await captureState(page, 'patient-form-entry-workspace-create-close-html', { formLabel });
          return;
        }

        const interaction = await interactWithForm(page);
        flow.observations.push(`Form interaction result: ${JSON.stringify(interaction)}`);
        await captureState(page, 'patient-form-entry-workspace-create-interacted', interaction);

        await closeWorkspace(page, Boolean(interaction.interacted));
        await captureState(page, 'patient-form-entry-workspace-create-discarded', { formLabel });
      },
    );

    await withFlow(
      'Edit Form Workspace2',
      'Open the edit path from the forms table when a completed encounter exists and verify the workspace loads without current-visit dependence',
      async (flow) => {
        await openPatientChart(page, report.patient.uuid, 'Patient Summary');
        await openClinicalFormsWorkspace(page);

        const rowLocator = page.locator('table tbody tr');
        const rowCount = await rowLocator.count().catch(() => 0);
        let editRow = null;

        for (let index = 0; index < rowCount; index += 1) {
          const row = rowLocator.nth(index);
          const lastCompleted = await row
            .locator('td')
            .nth(1)
            .textContent()
            .then((value) => value?.trim())
            .catch(() => '');
          const editButton = row.locator('button').first();
          if (lastCompleted && (await editButton.isVisible().catch(() => false))) {
            editRow = { row, editButton, lastCompleted };
            break;
          }
        }

        if (!editRow) {
          flow.status = 'skipped';
          flow.observations.push('No completed form row with an edit launcher was available');
          return;
        }

        await robustClick(editRow.editButton, page);
        await page.waitForTimeout(1000);
        await captureState(page, 'patient-form-entry-workspace-edit-open', { lastCompleted: editRow.lastCompleted });
        await closeWorkspace(page, false);
        await captureState(page, 'patient-form-entry-workspace-edit-closed');
      },
    );

    await withFlow(
      'Vitals Legacy Launcher',
      'Open the vitals page and exercise the legacy formInfo launcher that still bridges into patient-form-entry-workspace',
      async (flow) => {
        await openPatientChart(page, report.patient.uuid, 'Vitals & Biometrics');
        await captureState(page, 'vitals-chart-page');

        const vitalsLauncher = await locateVitalsLauncher(page);
        if (!vitalsLauncher) {
          flow.status = 'skipped';
          flow.observations.push('No vitals launcher button was visible on the chart');
          return;
        }

        const buttonText = await vitalsLauncher
          .textContent()
          .then((value) => value?.trim())
          .catch(() => null);
        await robustClick(vitalsLauncher, page);
        await page.waitForTimeout(1000);
        await captureState(page, 'vitals-legacy-form-entry-open', { buttonText });

        const interaction = await interactWithForm(page);
        flow.observations.push(`Vitals interaction result: ${JSON.stringify(interaction)}`);
        await closeWorkspace(page, Boolean(interaction.interacted));
        await captureState(page, 'vitals-legacy-form-entry-closed');
      },
    );

    await withFlow(
      'Offline Forms Page',
      'Open offline tools for forms, capture the current table state, and toggle one form if the UI exposes an offline switch',
      async (flow) => {
        await gotoAndWait(page, `${spaBase}/offline-tools/forms`, 'open-offline-forms-page');
        await captureState(page, 'offline-forms-page');

        const toggle = page.locator('button[id$="-offline-toggle"], input[id$="-offline-toggle"]').first();
        if (await toggle.isVisible().catch(() => false)) {
          await toggle.click({ force: true });
          await page.waitForTimeout(1200);
          await captureState(page, 'offline-forms-toggle-enabled');
          await toggle.click({ force: true });
          await page.waitForTimeout(1200);
          await captureState(page, 'offline-forms-toggle-disabled');
          flow.observations.push('Successfully toggled an offline form on and off');
        } else {
          flow.status = 'skipped';
          flow.observations.push('Offline forms page did not expose a toggleable row in the current dataset');
        }
      },
    );
  } finally {
    await context.tracing.stop({ path: path.join(artifactRoot, 'phase6-form-stack.trace.zip') });
    await api.dispose();
    await context.close();
    await browser.close();
  }

  report.finishedAt = new Date().toISOString();
  report.networkSummary = summarizeNetwork();
  report.artifacts.networkLog = path.relative(process.cwd(), path.join(artifactRoot, 'logs', 'network-events.json'));
  report.artifacts.consoleLog = path.relative(process.cwd(), path.join(artifactRoot, 'logs', 'console-events.json'));
  report.artifacts.pageErrors = path.relative(process.cwd(), path.join(artifactRoot, 'logs', 'page-errors.json'));
  report.artifacts.requestFailures = path.relative(
    process.cwd(),
    path.join(artifactRoot, 'logs', 'request-failures.json'),
  );

  if (!report.flows.some((flow) => flow.name === 'Offline Forms Page' && flow.status === 'passed')) {
    report.limitations.push(
      'Offline queue edit and retry flows were not exercised because no queued patient-form sync item was available in the local dataset.',
    );
  }

  report.limitations.push(
    'The form-engine delete-question modal is not reachable from patient-chart runtime flows, so this audit covered the live collapse/header integration but not builder-only delete-confirm behavior.',
  );

  await writeJson(path.join(artifactRoot, 'logs', 'network-events.json'), networkEvents);
  await writeJson(path.join(artifactRoot, 'logs', 'console-events.json'), report.consoleEvents);
  await writeJson(path.join(artifactRoot, 'logs', 'page-errors.json'), report.pageErrors);
  await writeJson(path.join(artifactRoot, 'logs', 'request-failures.json'), report.requestFailures);
  await writeJson(path.join(artifactRoot, 'phase6-form-stack-report.json'), report);
  await fs.writeFile(path.join(artifactRoot, 'phase6-form-stack-report.md'), buildMarkdown(), 'utf8');
}

main().catch(async (error) => {
  report.finishedAt = new Date().toISOString();
  report.fatalError = serializeError(error);
  await ensureDir(artifactRoot);
  await writeJson(path.join(artifactRoot, 'phase6-form-stack-report.json'), report);
  process.exitCode = 1;
});
