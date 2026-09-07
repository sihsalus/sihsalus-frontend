import { expect, type Page, test } from '@playwright/test';
import { loadRecoveryConfig, type RecoveryConfig } from '../config-schema';
import { blockClinicalRecovery } from '../quarantine.mjs';

let config: RecoveryConfig;

test.beforeAll(() => {
  blockClinicalRecovery();
  config = loadRecoveryConfig();
});

async function openConsultaExterna(page: Page) {
  await page.goto(`${config.spaBaseUrl}/patient/${config.patientUuid}/chart/consulta-externa`);
  await expect(page).not.toHaveURL(/\/login/);
}

async function selectConsultaExternaTab(page: Page, name: RegExp) {
  const tabs = page.getByRole('tablist', { name: /Pestañas de Consulta Externa|Consulta Externa tabs/i });
  await expect(tabs).toBeVisible({ timeout: 20_000 });
  await tabs.getByRole('tab', { name }).click();
}

async function chooseConfiguredOption(page: Page, name: RegExp, value: string) {
  const comboBox = page.getByRole('combobox', { name }).filter({ visible: true });
  await expect(comboBox).toBeVisible({ timeout: 20_000 });
  await comboBox.click();
  const listBoxId = await comboBox.getAttribute('aria-controls');
  expect(listBoxId, 'The configured selector must identify its option list').toBeTruthy();
  const listBox = page.locator(`[id=${JSON.stringify(listBoxId)}]`);
  const option = listBox.getByRole('option', { name: value, exact: true });
  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();
  await expect(comboBox).toHaveValue(value);
}

test('firma una orden de medicamento y una de laboratorio en la visita sintética exacta', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'La escritura clínica se ejecuta una sola vez');

  await openConsultaExterna(page);
  await selectConsultaExternaTab(page, /Plan de Tratamiento/i);
  await page.getByRole('button', { name: /Prescribir medicamentos|Prescribe medications/i }).click();

  const medicationHeading = page.getByRole('heading', {
    name: /[ÓO]rdenes de medicamentos \(0\)|Drug orders \(0\)/i,
  });
  await expect(medicationHeading).toBeVisible({ timeout: 20_000 });
  await medicationHeading
    .locator('..')
    .locator('..')
    .getByRole('button', { name: /Agregar|Add/i })
    .first()
    .click();

  const medicationSearch = page.getByPlaceholder(/Buscar un medicamento|Search for a drug/i);
  await expect(medicationSearch).toBeVisible({ timeout: 20_000 });
  await medicationSearch.fill(config.drugSearch);
  const medicationResult = page.getByRole('listitem').filter({ hasText: config.drugDisplay }).first();
  await expect(medicationResult).toBeVisible({ timeout: 20_000 });
  await medicationResult
    .getByRole('button', { name: /Formulario de prescripci[oó]n|Medication order form|Order form/i })
    .click();

  await expect(
    page.getByRole('heading', {
      name: /Prescribir medicamento|Prescripci[oó]n de medicamentos|Medication prescription/i,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await page.locator('#doseSelection').fill(config.dose);
  await chooseConfiguredOption(page, /Unidad de dosis|Dose unit/i, config.doseUnit);
  await chooseConfiguredOption(page, /V[ií]a de administraci[oó]n|Route of administration/i, config.route);
  await chooseConfiguredOption(page, /Frecuencia|Frequency/i, config.frequency);
  await page.locator('#durationInput').fill(config.duration);
  await chooseConfiguredOption(page, /Unidad de duraci[oó]n|Duration unit/i, config.durationUnit);
  await expect(page.locator('#quantityDispensed')).not.toHaveValue('', { timeout: 10_000 });
  await page
    .getByRole('textbox', { name: /Diagn[oó]stico o motivo de la prescripci[oó]n|Diagnosis or reason/i })
    .fill('E2E synthetic order');
  await page.getByRole('button', { name: /Guardar prescripci[oó]n|Save order/i }).click();

  await expect(page.getByRole('heading', { name: /[ÓO]rdenes de medicamentos \(1\)|Drug orders \(1\)/i })).toBeVisible({
    timeout: 20_000,
  });
  const laboratoryHeading = page.getByRole('heading', {
    name: /[ÓO]rdenes de laboratorio \(0\)|Lab orders \(0\)/i,
  });
  await laboratoryHeading
    .locator('..')
    .locator('..')
    .getByRole('button', { name: /Agregar|Add/i })
    .first()
    .click();

  const laboratorySearch = page.getByPlaceholder(/Buscar por tipo de prueba|Search for a test type/i);
  await laboratorySearch.fill('TGP');
  const tgpResult = page
    .getByRole('listitem')
    .filter({ hasText: /alanina|ALT|TGP/i })
    .first();
  await expect(tgpResult).toBeVisible({ timeout: 20_000 });
  await tgpResult.getByRole('button', { name: /Formulario de orden|Order form/i }).click();

  const priority = page.locator('#priorityInput');
  await expect(priority).toBeVisible({ timeout: 20_000 });
  const routineValue = await priority
    .locator('option')
    .filter({ hasText: /Rutina|Routine/i })
    .getAttribute('value');
  expect(routineValue, 'El formulario de laboratorio debe ofrecer prioridad de rutina').toBeTruthy();
  await priority.selectOption(routineValue as string);
  await page.getByRole('button', { name: /Guardar orden|Save order/i }).click();

  await expect(page.getByRole('heading', { name: /[ÓO]rdenes de laboratorio \(1\)|Lab orders \(1\)/i })).toBeVisible({
    timeout: 20_000,
  });
  const signAndClose = page.getByRole('button', { name: /Firmar y cerrar|Sign and close/i });
  await expect(signAndClose).toBeEnabled();

  const encounterResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/openmrs/ws/rest/v1/encounter' && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await signAndClose.click();
  const encounterResponse = await encounterResponsePromise;
  expect(encounterResponse.ok(), `La creación del encounter devolvió HTTP ${encounterResponse.status()}`).toBe(true);
  const createdEncounter = (await encounterResponse.json()) as { uuid?: string };
  expect(createdEncounter.uuid).toMatch(/^[0-9a-f-]{36}$/i);

  const localOrigin = new URL(page.url()).origin;
  const verification = await page.request.get(
    `${localOrigin}/openmrs/ws/rest/v1/encounter/${createdEncounter.uuid}?v=${encodeURIComponent(
      'custom:(uuid,voided,patient:(uuid),visit:(uuid),orders:(uuid,voided,orderType:(uuid),patient:(uuid),encounter:(uuid),concept:(uuid),orderer:(uuid)))',
    )}`,
  );
  expect(verification.ok(), `La verificación del encounter devolvió HTTP ${verification.status()}`).toBe(true);
  const encounter = (await verification.json()) as {
    uuid: string;
    voided?: boolean;
    patient?: { uuid?: string };
    visit?: { uuid?: string };
    orders?: Array<{
      concept?: { uuid?: string };
      encounter?: { uuid?: string };
      orderType?: { uuid?: string };
      orderer?: { uuid?: string };
      patient?: { uuid?: string };
      uuid?: string;
      voided?: boolean;
    }>;
  };
  expect(encounter.voided).not.toBe(true);
  expect(encounter.patient?.uuid).toBe(config.patientUuid);
  expect(encounter.visit?.uuid).toBe(config.visitUuid);
  expect(encounter.orders).toHaveLength(2);
  expect(encounter.orders?.map(({ orderType }) => orderType?.uuid).sort()).toEqual(
    [config.drugOrderTypeUuid, config.testOrderTypeUuid].sort(),
  );
  const drugOrder = encounter.orders?.find(({ orderType }) => orderType?.uuid === config.drugOrderTypeUuid);
  const laboratoryOrder = encounter.orders?.find(({ orderType }) => orderType?.uuid === config.testOrderTypeUuid);
  expect(drugOrder?.uuid).toBeTruthy();
  expect(laboratoryOrder?.concept?.uuid).toBe(config.testConceptUuid);

  const drugVerification = await page.request.get(`${localOrigin}/openmrs/ws/rest/v1/order/${drugOrder?.uuid}?v=full`);
  expect(drugVerification.ok(), `La verificación de la receta devolvió HTTP ${drugVerification.status()}`).toBe(true);
  const verifiedDrugOrder = (await drugVerification.json()) as { drug?: { uuid?: string } };
  expect(verifiedDrugOrder.drug?.uuid).toBe(config.drugUuid);
  for (const order of encounter.orders ?? []) {
    expect(order.uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(order.voided).not.toBe(true);
    expect(order.patient?.uuid).toBe(config.patientUuid);
    expect(order.encounter?.uuid).toBe(encounter.uuid);
    expect(order.orderer?.uuid).toMatch(/^[0-9a-f-]{36}$/i);
  }
});
