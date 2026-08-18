import { expect, type Page, test } from '@playwright/test';
import { getOpenmrsBaseUrl } from '../utils/e2e-urls';

const API_BASE_URL = getOpenmrsBaseUrl();

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

test.describe('Peru admission accreditation checks', () => {
  test('patient registration exposes the admission data capture surface', async ({ page }) => {
    await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => null);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Crear nuevo paciente|Create new patient/i).first()).toBeVisible({ timeout: 30_000 });

    const requiredTexts: Array<[string, RegExp]> = [
      // Secciones del formulario de registro vigente (acordeones 0-6).
      ['identity validation section', /Validación de identidad( y seguro)?/i],
      ['basic information section', /Información básica/i],
      ['links and responsible section', /Vínculos y responsable/i],
      ['residence birthplace contact section', /Residencia, nacimiento y contacto/i],
      ['filiation section', /Datos de filiación/i],
      ['blood group section', /Grupo sanguíneo y factor Rh/i],
      ['financiador section', /Financiador/i],
      // Contenido visible de la sección expandida y encabezados clave.
      ['identification data heading', /Datos de identificación/i],
      ['identity lookup heading', /Buscar\/validar identidad/i],
      ['full name heading', /Nombre completo/i],
      ['sex field', /Sexo/i],
      ['birth field', /Nacimiento/i],
      ['residence address heading', /Dirección de residencia/i],
      ['birthplace heading', /Lugar de nacimiento/i],
      ['responsible person heading', /Responsable del paciente/i],
      ['patient links heading', /Vínculos del paciente/i],
    ];

    for (const [label, pattern] of requiredTexts) {
      expect(await isVisibleByText(page, pattern, 5_000), label).toBe(true);
    }

    // Los campos de seguro viven dentro del acordeón "6. Financiador";
    // se expande para validar el contenido real de la sección.
    await page
      .getByRole('heading', { name: /Financiador/i })
      .first()
      .click();
    expect(
      (await isVisibleByText(page, /^Seguro$/i, 5_000)) ||
        (await isVisibleByText(page, /Tipo de seguro|Financiador/i, 5_000)),
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

    expect(await isVisibleByText(page, /Nombre.*conocido|Patient.*Name.*Known/i, 5_000), 'unknown patient toggle').toBe(
      true,
    );

    await expect(page.getByText(/Nombre del acompañante o responsable/i)).toHaveCount(0);
    await expect(page.getByText(/Edad del acompañante o responsable/i)).toHaveCount(0);
    await expect(page.getByText(/Parentesco del acompañante o responsable/i)).toHaveCount(0);

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
    await page.goto('home/care-logbook/merge', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/openmrs\/admin\/patients\/findDuplicatePatients\.htm$|\/home\/care-logbook\/merge$/);
  });

  test('admission report by UPS exposes the required columns', async ({ page }) => {
    await page.goto('home/care-logbook', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Libro de Atenciones|Admissions report by UPS/i })).toBeVisible();

    for (const column of [
      /Fecha|Date/i,
      /HCE|MRN|código temporal/i,
      /Documento|Document/i,
      /Estado identificación|Identification status/i,
      /Responsable|Responsible/i,
      /Paciente|Patient|Nombres y apellidos/i,
      /Servicio|Service|UPSS/i,
    ]) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });
});
