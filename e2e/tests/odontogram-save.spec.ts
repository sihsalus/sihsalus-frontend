import { expect, type Page, test } from '@playwright/test';

const patientUuid = process.env.E2E_PATIENT_UUID ?? '8673ee4f-e2ab-4077-ba55-4980f408773e';

function isEncounterPayload(payload: unknown): payload is { patient?: string; obs?: unknown[] } {
  return typeof payload === 'object' && payload !== null;
}

async function openOdontogramSection(page: Page) {
  await page.goto(`/patient/${patientUuid}/chart`);
  await page.waitForLoadState('networkidle').catch(() => null);

  const odontogramNav = page
    .locator('a, button')
    .filter({ hasText: /Odontograma/i })
    .first();
  if (await odontogramNav.isVisible().catch(() => false)) {
    await odontogramNav.click();
    await page.waitForLoadState('networkidle').catch(() => null);
  } else {
    await page.goto(`/patient/${patientUuid}/chart/Odontograma`).catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => null);
  }
}

test.describe('Odontograma - guardado básico en patient chart', () => {
  test('abre workspace y dispara guardado (o muestra error de configuración)', async ({ page }) => {
    await openOdontogramSection(page);

    const registerBtn = page.getByTestId('odontogram-register-findings-btn');
    if (!(await registerBtn.isVisible().catch(() => false))) {
      test.skip(true, 'No se encontró el módulo de odontograma en este entorno');
    }

    await registerBtn.click();

    const saveBtn = page.getByTestId('odontogram-save-btn');
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    let capturedRequestBody: unknown = null;

    await page.route('**/ws/rest/v1/encounter**', async (route, request) => {
      if (request.method() === 'POST') {
        try {
          capturedRequestBody = request.postDataJSON();
        } catch {
          capturedRequestBody = null;
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { uuid: 'mock-encounter-uuid' } }),
        });
        return;
      }

      await route.continue();
    });

    await saveBtn.click();

    // Caso ideal: se emite POST /encounter con payload de odontograma.
    const postRequest = await page
      .waitForRequest((req) => req.method() === 'POST' && req.url().includes('/ws/rest/v1/encounter'), {
        timeout: 8_000,
      })
      .catch(() => null);

    if (postRequest) {
      expect(capturedRequestBody).toBeTruthy();
      if (!isEncounterPayload(capturedRequestBody)) {
        throw new Error('Payload de guardado de odontograma inválido');
      }
      const payload = capturedRequestBody;
      expect(payload.patient).toBe(patientUuid);
      expect(Array.isArray(payload.obs)).toBeTruthy();
      return;
    }

    // Entornos sin config de encounter/concepts: debe mostrar error controlado.
    const controlledErrorVisible = await page
      .locator('text=/Error saving odontogram|Could not save odontogram|Missing required config/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(controlledErrorVisible).toBeTruthy();
  });
});
