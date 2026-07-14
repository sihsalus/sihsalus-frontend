import { expect, type Page, test } from '@playwright/test';
import { getRequiredSyntheticUuid } from '../utils/e2e-env';

/**
 * E2E del formulario de citas (workspace del patient chart).
 *
 * Valida contra el entorno sintético desplegado configurado para E2E:
 *  - La duración por defecto es 30 minutos (los servicios MINSA no traen durationMins).
 *  - El selector de servicios viene poblado desde el backend.
 *  - El flujo de cita recurrente exige una fecha de finalización.
 */

const PATIENT_UUID = getRequiredSyntheticUuid('E2E_APPOINTMENTS_PATIENT_UUID');

async function openAppointmentsForm(page: Page) {
  await page.goto(`patient/${PATIENT_UUID}/chart/Appointments`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expect(page).not.toHaveURL(/\/login/);

  // El botón de alta aparece como "Agregar" (con data) o como botón de registro (vacío).
  const addButton = page
    .getByRole('button', { name: /Agregar|Add Appointments|Registrar|Record appointment/i })
    .first();
  await expect(addButton).toBeVisible({ timeout: 30_000 });
  await addButton.click();

  // El workspace abre con el título "Crear nueva cita".
  await expect(page.getByText(/Crear nueva cita|Create new appointment/i).first()).toBeVisible({ timeout: 30_000 });
}

test.describe('Formulario de citas', () => {
  test('la duración por defecto es 30 minutos', async ({ page }) => {
    await openAppointmentsForm(page);

    const duration = page.getByRole('spinbutton', { name: /Duración|Duration/i });
    await expect(duration).toHaveValue('30');
  });

  test('el selector de servicios viene poblado desde el backend', async ({ page }) => {
    await openAppointmentsForm(page);

    const serviceSelect = page.getByLabel(/Seleccione un servicio|Select a service/i);
    await expect(serviceSelect).toBeVisible();

    // Más de una opción real además del placeholder.
    const optionCount = await serviceSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);

    // Al elegir un servicio sin durationMins, la duración se mantiene en 30.
    await serviceSelect.selectOption({ index: 1 });
    await expect(page.getByRole('spinbutton', { name: /Duración|Duration/i })).toHaveValue('30');
  });

  test('una cita recurrente exige fecha de finalización', async ({ page }) => {
    await openAppointmentsForm(page);

    await page.getByText(/¿Esta es una cita recurrente\?|Is this a recurring appointment\?/i).click();

    await page.getByLabel(/Seleccione un servicio|Select a service/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /Guardar y cerrar|Save and close/i }).click();

    await expect(
      page.getByText(
        /Una cita recurrente debe tener una fecha de finalización|recurring appointment should have an end date/i,
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
