import { expect, type Page, test } from '@playwright/test';

const patientUuid = process.env.E2E_PATIENT_UUID;
if (!patientUuid) {
  throw new Error('E2E_PATIENT_UUID must identify a synthetic test patient.');
}

interface EncounterPayload {
  patient?: string;
  encounterType?: string;
  form?: string;
  obs?: Array<{ concept?: string; value?: unknown }>;
}

function isEncounterPayload(payload: unknown): payload is EncounterPayload {
  return typeof payload === 'object' && payload !== null;
}

async function openOdontogramDashboard(page: Page) {
  await page.goto(`patient/${patientUuid}/chart/atencion-odontologica`);
  await page.waitForLoadState('networkidle').catch(() => null);

  await expect(page).not.toHaveURL(/\/login/);
  // El estado vacío reemplaza el layout maestro-detalle, así que se espera
  // cualquiera de las dos entradas posibles del módulo.
  const emptyState = page.getByText(/No hay odontograma inicial registrado/i);
  const attentionsHeading = page.getByRole('heading', { name: /Atenciones/i });
  await expect(emptyState.or(attentionsHeading).first()).toBeVisible({ timeout: 20_000 });
}

/**
 * El dashboard tiene varios estados de entrada al editor (vacío, lista con
 * alta habilitada, o edición en progreso). El spec abre el editor desde
 * cualquiera de ellos para no depender de los datos previos del paciente.
 */
async function openOdontogramEditor(page: Page) {
  const saveButton = page.getByTestId('save-edit-btn');
  if (await saveButton.isVisible().catch(() => false)) {
    return;
  }

  const continueEditing = page.getByTestId('continue-edit-btn');
  if (await continueEditing.isVisible().catch(() => false)) {
    await continueEditing.click();
    return;
  }

  const emptyStateAction = page.getByRole('button', { name: /Registrar odontograma inicial/i });
  if (await emptyStateAction.isVisible().catch(() => false)) {
    await emptyStateAction.click();
    return;
  }

  const addBase = page.getByTestId('add-base-btn');
  if (await addBase.isEnabled().catch(() => false)) {
    await addBase.click();
    return;
  }

  // Alta deshabilitada significa que ya hay un borrador abierto en la lista.
  await page.getByTestId('draft-base-card').click();
}

// El service worker del SPA sirve las peticiones de la app y evade
// page.route(): sin bloquearlo, el POST interceptado llegaría al servidor y
// el gate dejaría encuentros reales en el ambiente.
test.use({ serviceWorkers: 'block' });

test.describe('Odontograma - registro en atención odontológica', () => {
  test('el dashboard expone la lista de odontogramas del paciente', async ({ page }) => {
    await openOdontogramDashboard(page);

    const emptyState = page.getByText(/No hay odontograma inicial registrado/i);
    const recordList = page.getByRole('navigation', { name: /Lista de odontogramas/i });

    await expect(emptyState.or(recordList).first()).toBeVisible({ timeout: 15_000 });
  });

  test('guarda un odontograma inicial con el payload esperado', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'El editor master-detail se valida en desktop');

    await openOdontogramDashboard(page);

    let capturedRequestBody: unknown = null;

    // El POST se intercepta: el gate no debe dejar encuentros en el ambiente.
    await page.route('**/ws/rest/v1/encounter', async (route, request) => {
      if (request.method() === 'POST') {
        try {
          capturedRequestBody = request.postDataJSON();
        } catch {
          capturedRequestBody = null;
        }

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ uuid: 'mock-encounter-uuid' }),
        });
        return;
      }

      await route.continue();
    });

    await openOdontogramEditor(page);

    const saveButton = page.getByTestId('save-edit-btn');
    await expect(saveButton).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cancel-edit-btn')).toBeVisible();

    await saveButton.click();

    await expect
      .poll(() => capturedRequestBody, { timeout: 15_000, message: 'Se esperaba un POST de encuentro odontológico' })
      .not.toBeNull();

    if (!isEncounterPayload(capturedRequestBody)) {
      throw new Error('Payload de guardado de odontograma inválido');
    }

    expect(capturedRequestBody.patient).toBe(patientUuid);
    expect(capturedRequestBody.encounterType).toBeTruthy();
    expect(Array.isArray(capturedRequestBody.obs)).toBeTruthy();

    // El snapshot del odontograma y su tipo de registro viajan como obs.
    const observations = capturedRequestBody.obs ?? [];
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every((observation) => Boolean(observation?.concept))).toBeTruthy();
    expect(observations.some((observation) => observation?.value === 'base')).toBeTruthy();
  });
});
