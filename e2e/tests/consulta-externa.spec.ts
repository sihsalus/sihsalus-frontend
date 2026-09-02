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
});
