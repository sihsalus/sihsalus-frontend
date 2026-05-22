import { expect, type Page, test } from '@playwright/test';

const API_BASE_URL =
  process.env.E2E_API_BASE_URL ??
  (process.env.E2E_BASE_URL ?? 'http://localhost:8080/openmrs/spa').replace(/\/spa\/?$/, '').replace(/\/$/, '');

async function isVisibleByText(page: Page, pattern: RegExp, timeout = 12_000) {
  return await page
    .getByText(pattern)
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

async function isVisibleBySelector(page: Page, selector: string, timeout = 12_000) {
  return await page
    .locator(selector)
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

test.describe('MINSA admission accreditation checks', () => {
  test('patient registration exposes the admission data capture surface', async ({ page }) => {
    await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Crear nuevo paciente|Create new patient/i).first()).toBeVisible({ timeout: 30_000 });

    const requiredTexts: Array<[string, RegExp]> = [
      ['filiation section', /Datos de filiación/i],
      ['responsible person section', /Acompañante o responsable/i],
      ['birthplace field', /Lugar de nacimiento/i],
      ['civil status field', /Estado civil/i],
      ['native language field', /Idioma nativo/i],
      ['occupation field', /Ocupación/i],
      ['education level field', /Grado de instrucción/i],
      ['religion field', /Religión/i],
      ['blood group field', /Grupo sanguíneo/i],
      ['rh factor field', /Factor Rh/i],
      ['medical record section', /Historia clínica/i],
      ['medical record status field', /Estado de historia clínica/i],
      ['medical record archive type field', /Tipo de archivo de historia clínica/i],
      ['insurance type field', /Tipo de seguro/i],
      ['insurance code field', /Código de seguro/i],
      ['insurance accreditation status field', /Estado de acreditación de seguro/i],
      ['insurance accreditation date field', /Fecha\/hora de acreditación/i],
      ['responsible person name field', /Nombre del acompañante o responsable/i],
      ['responsible person age field', /Edad del acompañante o responsable/i],
      ['responsible person relationship field', /Parentesco del acompañante o responsable/i],
      ['birth field', /Nacimiento|Birth/i],
    ];

    for (const [label, pattern] of requiredTexts) {
      expect(await isVisibleByText(page, pattern, 5_000), label).toBe(true);
    }

    expect(
      (await isVisibleByText(page, /^Seguro$/i, 5_000)) ||
        ((await isVisibleByText(page, /Tipo de seguro/i, 5_000)) &&
          (await isVisibleByText(page, /Código de seguro/i, 5_000))),
      'insurance section',
    ).toBe(true);

    expect(
      (await isVisibleByText(page, /Etnia|Ethnicity/i, 5_000)) ||
        (await isVisibleBySelector(page, '[name="person-attribute-8d871386-c2cc-11de-8d13-0010c6dffd0f"]', 5_000)),
      'ethnicity field',
    ).toBe(true);

    expect(
      (await isVisibleByText(page, /Apellido Materno|Segundo apellido|Second Family Name/i, 5_000)) ||
        (await isVisibleBySelector(page, '#familyName2, [name="familyName2"]', 5_000)),
      'second family name field',
    ).toBe(true);

    expect(
      (await isVisibleByText(page, /Identificadores|Identifiers/i, 5_000)) ||
        (await isVisibleBySelector(page, '[data-testid="identifier-label"], [data-testid="identifier-input"]', 5_000)),
      'identifiers field',
    ).toBe(true);

    expect(await isVisibleByText(page, /Nombre.*conocido|Patient.*Name.*Known/i, 5_000), 'unknown patient toggle').toBe(
      true,
    );

    await expect(
      page.getByRole('button', { name: /Registrar paciente|Guardar|Save|Create|Crear/i }).first(),
    ).toBeVisible({
      timeout: 5_000,
    });

    const identifierTypesResponse = await page.request.get(
      `${API_BASE_URL}/ws/rest/v1/patientidentifiertype?v=default`,
    );
    expect(identifierTypesResponse.ok(), 'patient identifier types API').toBe(true);
  });

  test('duplicate patient merge entry point opens the legacy merge flow', async ({ page }) => {
    await page.goto('admission/merge', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /Fusionar historias clínicas duplicadas|Merge duplicate patient/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Abrir fusión de pacientes|Open patient merge/i })).toHaveAttribute(
      'href',
      /\/openmrs\/admin\/patients\/mergePatients\.form$/,
    );
  });

  test('admission report by UPS exposes the required columns', async ({ page }) => {
    await page.goto('admission', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /Reporte de admisiones por UPS|Admissions report by UPS/i }),
    ).toBeVisible();

    for (const column of [
      /Fecha|Date/i,
      /Hora|Time/i,
      /Paciente|Patient/i,
      /^HC$|MRN/i,
      /UPS\/servicio|UPS\/service/i,
      /Ubicación|Location/i,
      /Estado|Status/i,
    ]) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });
});
