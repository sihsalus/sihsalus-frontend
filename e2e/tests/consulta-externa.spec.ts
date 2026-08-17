import { expect, type Page, test } from '@playwright/test';

const patientUuid = process.env.E2E_PATIENT_UUID;
if (!patientUuid) {
  throw new Error('E2E_PATIENT_UUID must identify a synthetic test patient.');
}

const consultaExternaTabs = [
  /Triajes previos/i,
  /Anamnesis/i,
  /Diagn[oó]stico/i,
  /Examen f[ií]sico \/ SOAP/i,
  /Plan de Tratamiento/i,
  /Referencia \/ Contrarreferencia/i,
];

const historySections = [
  { tab: /Anamnesis/i, region: /Historial de Anamnesis/i },
  { tab: /Diagn[oó]stico/i, region: /Historial de Diagn[oó]sticos/i },
  { tab: /Examen f[ií]sico \/ SOAP/i, region: /Historial de examen f[ií]sico \/ SOAP/i },
  { tab: /Plan de Tratamiento/i, region: /Historial de Planes de Tratamiento/i },
  { tab: /Referencia \/ Contrarreferencia/i, region: /Historial de referencias y contrarreferencias/i },
];

async function openConsultaExterna(page: Page) {
  await page.goto(`patient/${patientUuid}/chart/consulta-externa`);
  await page.waitForLoadState('networkidle').catch(() => null);
}

function getConsultaExternaTabList(page: Page) {
  return page.getByRole('tablist', { name: /Pestañas de Consulta Externa|Consulta Externa tabs/i });
}

test.describe('Consulta externa - hoja clínica', () => {
  test('muestra las seis pestañas de la hoja de consulta externa', async ({ page }) => {
    await openConsultaExterna(page);

    await expect(page).not.toHaveURL(/\/login/);

    const tabList = getConsultaExternaTabList(page);
    await expect(tabList, 'La hoja de consulta externa debe renderizar sus pestañas').toBeVisible({
      timeout: 20_000,
    });

    for (const tabName of consultaExternaTabs) {
      await expect(tabList.getByRole('tab', { name: tabName })).toBeVisible();
    }
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
