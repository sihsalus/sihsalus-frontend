import { expect, test } from '@playwright/test';
import { getE2ECredentials } from '../utils/e2e-api';
import { getOpenmrsRestUrl, getSpaUrl, shouldIgnoreHTTPSErrors } from '../utils/e2e-urls';

const patientUuid = process.env.E2E_PATIENT_UUID;
if (!patientUuid) {
  throw new Error('E2E_PATIENT_UUID must identify a synthetic test patient.');
}

test.describe('Critical user journeys', () => {
  test('interactive login creates an authenticated OpenMRS session', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Critical journeys run once; responsive coverage is separate');
    const { username, password } = getE2ECredentials();
    const context = await browser.newContext({ ignoreHTTPSErrors: shouldIgnoreHTTPSErrors() });
    const page = await context.newPage();

    try {
      await page.goto(getSpaUrl('login'));
      const usernameField = page.locator('input[name="username"], input[type="text"]').first();
      const passwordField = page.locator('input[name="password"], input[type="password"]').first();
      await expect(usernameField).toBeVisible({ timeout: 20_000 });
      await expect(passwordField).toBeVisible();

      await usernameField.fill(username);
      await passwordField.fill(password);
      await page.getByRole('button', { name: /log in|login|iniciar sesi[oó]n|entrar/i }).click();

      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              getOpenmrsRestUrl(`session?v=${encodeURIComponent('custom:(authenticated)')}`),
            );
            if (!response.ok()) return false;
            const session = (await response.json()) as { authenticated?: boolean };
            return session.authenticated ?? false;
          },
          { message: 'El formulario de login debe crear una sesión autenticada', timeout: 20_000 },
        )
        .toBe(true);
    } finally {
      await context.close();
    }
  });

  test('authenticated clinician opens the configured outpatient chart', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Critical journeys run once; responsive coverage is separate');
    await page.goto(`patient/${patientUuid}/chart/consulta-externa`);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Consulta Externa|Outpatient consultation/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('tablist', { name: /Pestañas de Consulta Externa|Consulta Externa tabs/i }),
    ).toBeVisible();
  });

  test('offline notification clears after connectivity is restored', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Critical journeys run once; responsive coverage is separate');
    await page.goto('home');
    await expect(page.locator('main, [data-testid="home-page"]').first()).toBeVisible({ timeout: 30_000 });
    const connectivityToasts = page.locator('.omrs-toasts-container');

    await page.context().setOffline(true);
    await expect(connectivityToasts.getByText('Estado de conexión', { exact: true }).last()).toBeVisible();
    await expect(connectivityToasts.getByText('Sin conexión a internet.', { exact: true }).last()).toBeVisible();

    await page.context().setOffline(false);
    await expect(connectivityToasts.getByText('Conexión restablecida.', { exact: true }).last()).toBeVisible();

    await page.goto('patient-search');
    await expect(page.locator('main, input[type="search"], input[placeholder*="Buscar"]').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
