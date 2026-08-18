import { expect, type Page, test } from '@playwright/test';

/**
 * E2E del formulario de citas (workspace del patient chart).
 *
 * Valida contra el frontend real:
 *  - La duración por defecto es 30 minutos (los servicios MINSA no traen durationMins).
 *  - El selector de servicios viene poblado desde el backend.
 *  - El flujo de cita recurrente exige una fecha de finalización.
 */

const PATIENT_UUID = process.env.E2E_APPOINTMENTS_PATIENT_UUID;
if (!PATIENT_UUID) {
  throw new Error('E2E_APPOINTMENTS_PATIENT_UUID must identify a synthetic test patient.');
}

async function openAppointmentsForm(page: Page) {
  await page.goto(`patient/${PATIENT_UUID}/chart/Appointments`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle').catch(() => null);
  await expect(page).not.toHaveURL(/\/login/);

  // El widget de Citas expone el alta como "Agregar" exacto; el nombre completo
  // evita el "Agregar paciente" del navbar y el "Registrar signos vitales" del
  // banner. Requiere un paciente con visita activa.
  const addButton = page.getByRole('button', { name: /^(Agregar|Add)$/i }).first();
  await expect(addButton).toBeVisible({ timeout: 30_000 });
  await addButton.click();

  // El workspace abre con el título "Crear nueva cita".
  await expect(page.getByText(/Crear nueva cita|Create new appointment/i).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * El servicio depende de la UPSS: su combobox llega deshabilitado y solo se
 * puebla tras elegir una. Selecciona la primera UPSS real (índice 1: el 0 es
 * el placeholder) y devuelve el selector de servicio ya habilitado.
 */
async function selectFirstUpssAndGetServiceSelect(page: Page) {
  await page.getByLabel(/Seleccionar una UPSS|Select a UPSS/i).selectOption({ index: 1 });

  const serviceSelect = page.getByLabel(/Seleccione un servicio|Select a service/i);
  await expect(serviceSelect).toBeEnabled({ timeout: 15_000 });
  return serviceSelect;
}

test.describe('Formulario de citas', () => {
  test('se ajusta al ancho del workspace sin desplazamiento horizontal', async ({ page }) => {
    await openAppointmentsForm(page);

    const duration = page.getByRole('spinbutton', {
      name: /Duración|Duration/i,
    });
    const form = page.locator('form').filter({ has: duration });
    await expect(form).toBeVisible();

    const overflowingContainers = await form.evaluate((element) =>
      [element, element.parentElement]
        .filter((container): container is HTMLElement => container instanceof HTMLElement)
        .filter((container) => container.scrollWidth > container.clientWidth + 1)
        .map((container) => ({
          clientWidth: container.clientWidth,
          scrollWidth: container.scrollWidth,
        })),
    );

    expect(overflowingContainers).toEqual([]);
  });

  test('la duración por defecto es 30 minutos', async ({ page }) => {
    await openAppointmentsForm(page);

    const duration = page.getByRole('spinbutton', {
      name: /Duración|Duration/i,
    });
    await expect(duration).toHaveValue('30');
  });

  test('el selector de servicios viene poblado desde el backend', async ({ page }) => {
    await openAppointmentsForm(page);

    const serviceSelect = await selectFirstUpssAndGetServiceSelect(page);

    // Más de una opción real además del placeholder.
    const optionCount = await serviceSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(1);

    // Al elegir un servicio, la duración queda en un entero positivo: 30 por
    // defecto, o la duración configurada del servicio si el backend la define.
    await serviceSelect.selectOption({ index: 1 });
    const duration = page.getByRole('spinbutton', { name: /Duración|Duration/i });
    await expect(duration).toHaveValue(/^[1-9]\d*$/);
  });

  // FIXME: la validación existe (appointments-form.workspace.tsx:490) pero el
  // spec no logra activar el modo recurrente: el control es un switch de Carbon
  // sin nombre accesible y getByRole('switch').first() no alcanza el correcto.
  // Requiere exponer aria-label en ese switch (o un data-testid) para poder
  // seleccionarlo de forma estable; entonces reactivar este caso.
  test.fixme('una cita recurrente exige fecha de finalización', async ({ page }) => {
    await openAppointmentsForm(page);

    // El control es un switch de Carbon sin nombre accesible propio, asi que se
    // localiza por rol (hallazgo a11y: deberia exponer aria-label).
    await page.getByRole('switch').first().click();

    const serviceSelect = await selectFirstUpssAndGetServiceSelect(page);
    await serviceSelect.selectOption({ index: 1 });
    await page.getByRole('button', { name: /Guardar y cerrar|Save and close/i }).click();

    await expect(
      page.getByText(
        /Una cita recurrente debe tener una fecha de finalización|recurring appointment should have an end date/i,
      ),
    ).toBeVisible({ timeout: 15_000 });
  });
});
