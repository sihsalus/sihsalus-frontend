import { expect, type Page, test } from '@playwright/test';

const patientUuid = process.env.E2E_PATIENT_UUID;
if (!patientUuid) {
  throw new Error('E2E_PATIENT_UUID must identify a synthetic test patient.');
}

const consultaExternaTabs = [
  /Triajes previos/i,
  /Antecedentes/i,
  /Anamnesis/i,
  /Examen f[ií]sico/i,
  /Pruebas complementarias/i,
  /Diagn[oó]stico/i,
  /Plan de Tratamiento/i,
  /Referencia \/ Contrarreferencia/i,
];

const historySections = [
  { tab: /Anamnesis/i, region: /Historial de Anamnesis/i },
  { tab: /Examen f[ií]sico/i, region: /Historial de examen f[ií]sico/i },
  { tab: /Diagn[oó]stico/i, region: /Historial de Diagn[oó]sticos/i },
  {
    tab: /Plan de Tratamiento/i,
    region: /Historial de Planes de Tratamiento/i,
  },
  {
    tab: /Referencia \/ Contrarreferencia/i,
    region: /Historial de referencias y contrarreferencias/i,
  },
];

async function openConsultaExterna(page: Page) {
  await page.goto(`patient/${patientUuid}/chart/consulta-externa`);
  await page.waitForLoadState('networkidle').catch(() => null);
}

async function selectConsultaExternaTab(page: Page, name: RegExp) {
  const tabList = getConsultaExternaTabList(page);
  await expect(tabList).toBeVisible({ timeout: 20_000 });
  await tabList.getByRole('tab', { name }).click();
}

async function searchAndSelectDiagnosis(page: Page, code: string) {
  const diagnosisSearch = page.getByPlaceholder(/Elija un diagn[oó]stico principal|Choose a primary diagnosis/i);
  await expect(diagnosisSearch).toBeVisible({ timeout: 20_000 });
  await diagnosisSearch.fill('');

  // The visit-note search is debounced. The trailing space makes the final
  // onChange observe the complete code while preserving the operator's query.
  await diagnosisSearch.pressSequentially(`${code} `, { delay: 60 });

  const normalizedCode = code.replace('.', '');
  const result = page
    .getByRole('button')
    .filter({ hasText: new RegExp(`${code.replace('.', '\\.?')}|${normalizedCode}`, 'i') })
    .first();
  await expect(result, `El catálogo debe devolver el diagnóstico CIE-10 ${code}`).toBeVisible({ timeout: 20_000 });
  await result.click();
}

function getConsultaExternaTabList(page: Page) {
  return page.getByRole('tablist', {
    name: /Pestañas de Consulta Externa|Consulta Externa tabs/i,
  });
}

test.describe('Consulta externa - hoja clínica', () => {
  test('muestra las ocho pestañas de la hoja de consulta externa', async ({ page }) => {
    await openConsultaExterna(page);

    await expect(page).not.toHaveURL(/\/login/);

    const tabList = getConsultaExternaTabList(page);
    await expect(tabList, 'La hoja de consulta externa debe renderizar sus pestañas').toBeVisible({
      timeout: 20_000,
    });

    for (const tabName of consultaExternaTabs) {
      await expect(tabList.getByRole('tab', { name: tabName })).toBeVisible();
    }

    await expect(tabList.getByRole('tab')).toHaveText([
      'Triajes previos',
      'Antecedentes',
      'Anamnesis',
      'Examen físico',
      'Pruebas complementarias',
      'Diagnóstico',
      'Plan de Tratamiento',
      'Referencia / Contrarreferencia',
    ]);
  });

  test('reutiliza la tarjeta de resultados en Pruebas complementarias', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'La tarjeta solo necesita un proyecto');

    await openConsultaExterna(page);

    const tabList = getConsultaExternaTabList(page);
    await expect(tabList).toBeVisible({ timeout: 20_000 });
    await tabList.getByRole('tab', { name: /Pruebas complementarias/i }).click();

    await expect(page.getByRole('heading', { name: /Resultados Recientes|Recent Results/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('cada pestaña clínica muestra su historial', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'El recorrido de pestañas solo necesita un proyecto');

    await openConsultaExterna(page);

    const tabList = getConsultaExternaTabList(page);
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    for (const section of historySections) {
      await tabList.getByRole('tab', { name: section.tab }).click();

      const historyRegion = page.getByRole('region', { name: section.region }).first();
      await expect(historyRegion, `La sección debe mostrar ${section.region}`).toBeVisible({ timeout: 15_000 });
    }
  });

  test('abre el historial canónico desde Consultas previas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'La navegación histórica solo necesita un proyecto');

    await openConsultaExterna(page);
    await page.getByRole('button', { name: /Consultas previas|Previous consultations/i }).click();

    await expect(page).toHaveURL(new RegExp(`/patient/${patientUuid}/chart/Visits(?:[/?#]|$)`, 'i'));
    await expect(page.getByText(/Todas las atenciones|All encounters/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('encuentra K71.0 y permite reemplazar el diagnóstico principal sin guardar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'El contrato de diagnóstico solo necesita un proyecto');

    await openConsultaExterna(page);
    await selectConsultaExternaTab(page, /Diagn[oó]stico/i);
    await page.getByRole('button', { name: /Registrar Diagn[oó]stico|Add diagnosis/i }).click();

    await expect(page.getByText(/Resumen de consulta|Visit note/i, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('textbox', {
        name: /Indicaciones no farmacol[oó]gicas|Non-pharmacological instructions/i,
      }),
    ).toBeVisible();

    await searchAndSelectDiagnosis(page, 'K71.0');
    const selectedDiagnosis = page
      .getByRole('button', { name: /Limpiar filtro|Clear filter/i })
      .filter({ visible: true })
      .first();
    await expect(selectedDiagnosis, 'El diagnóstico principal seleccionado debe poder retirarse').toBeVisible();
    await expect(page.getByRole('radio', { name: /P\s*-\s*Presuntivo|Provisional/i }).first()).toBeChecked();
    await selectedDiagnosis.click();

    await searchAndSelectDiagnosis(page, 'I10');
    await expect(
      page
        .getByRole('button', { name: /Limpiar filtro|Clear filter/i })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });

  test('busca medicamentos y agrega TGP y TGO sin salir del selector de laboratorio', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'El recorrido de órdenes solo necesita un proyecto');

    await openConsultaExterna(page);
    await selectConsultaExternaTab(page, /Plan de Tratamiento/i);
    await page.getByRole('button', { name: /Prescribir medicamentos|Prescribe medications/i }).click();

    await expect(page.getByText(/Canasta de [oó]rdenes|Order basket/i, { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const medicationHeading = page.getByRole('heading', {
      name: /[ÓO]rdenes de medicamentos \(\d+\)|Drug orders \(\d+\)/i,
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
    await medicationSearch.fill('ursodesoxic');
    await expect(
      page.getByRole('listitem').filter({ hasText: /ursod/i }).first(),
      'El ácido ursodesoxicólico debe existir como medicamento ordenable, no como texto libre',
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Regresar a la canasta de [oó]rdenes|Back to order basket/i }).click();

    const laboratoryHeading = page.getByRole('heading', {
      name: /[ÓO]rdenes de laboratorio \(\d+\)|Lab orders \(\d+\)/i,
    });
    await expect(laboratoryHeading).toBeVisible({ timeout: 20_000 });
    await laboratoryHeading
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /Agregar|Add/i })
      .first()
      .click();

    const laboratorySearch = page.getByPlaceholder(/Buscar por tipo de prueba|Search for a test type/i);
    await expect(laboratorySearch).toBeVisible({ timeout: 20_000 });

    await laboratorySearch.fill('TGP');
    const tgpResult = page
      .getByRole('listitem')
      .filter({ hasText: /alanina|ALT|TGP/i })
      .filter({ has: page.getByRole('button', { name: /Agregar a la cesta|Add to basket/i }) })
      .first();
    await expect(tgpResult, 'TGP debe resolver la prueba ALT configurada').toBeVisible({ timeout: 20_000 });
    await tgpResult.getByRole('button', { name: /Agregar a la cesta|Add to basket/i }).click();
    await expect(tgpResult.getByRole('button', { name: /Quitar de la canasta|Remove from basket/i })).toBeVisible();

    await laboratorySearch.fill('TGO');
    const tgoResult = page
      .getByRole('listitem')
      .filter({ hasText: /glut[aá]mico|aspartato|AST|TGO/i })
      .filter({ has: page.getByRole('button', { name: /Agregar a la cesta|Add to basket/i }) })
      .first();
    await expect(tgoResult, 'TGO debe resolver la prueba AST configurada').toBeVisible({ timeout: 20_000 });
    await tgoResult.getByRole('button', { name: /Agregar a la cesta|Add to basket/i }).click();

    await page.getByRole('button', { name: /Regresar a la canasta de [oó]rdenes|Back to order basket/i }).click();
    await expect(
      page.getByRole('heading', { name: /[ÓO]rdenes de laboratorio \(2\)|Lab orders \(2\)/i }),
    ).toBeVisible();
  });
});
