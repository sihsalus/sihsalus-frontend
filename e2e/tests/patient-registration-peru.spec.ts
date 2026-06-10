import { expect, type Locator, type Page, test } from '@playwright/test';

async function gotoPatientRegistration(page: Page) {
  await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/Crear nuevo paciente|Create new patient/i).first()).toBeVisible({ timeout: 30_000 });
}

async function expectSectionVisible(page: Page, id: string, name: RegExp) {
  const section = page.locator(`div[id="${id}"]`);
  await expect(section).toBeVisible({ timeout: 15_000 });
  await expect(section.getByRole('heading', { name })).toBeVisible();

  return section;
}

async function expectSectionOrder(page: Page, sectionIds: Array<string>) {
  const sectionPositions = await Promise.all(
    sectionIds.map(async (id) => {
      const top = await page.locator(`div[id="${id}"]`).evaluate((element) => element.getBoundingClientRect().top);
      return { id, top };
    }),
  );

  for (let index = 1; index < sectionPositions.length; index++) {
    const previous = sectionPositions[index - 1];
    const current = sectionPositions[index];

    if (!previous || !current) {
      throw new Error('Could not calculate patient registration section order.');
    }

    expect(current.top, `${current.id} should render after ${previous.id}`).toBeGreaterThan(previous.top);
  }
}

async function fillTextbox(locator: Locator, value: string) {
  await expect(locator).toBeVisible({ timeout: 15_000 });
  await locator.fill(value);
}

test.describe('Peru patient registration', () => {
  test('renders Peru-specific sections in the expected order', async ({ page }) => {
    await gotoPatientRegistration(page);

    const contact = await expectSectionVisible(page, 'contact', /Residencia, nacimiento y contacto/i);
    const filiation = await expectSectionVisible(page, 'filiation', /Datos de filiaci[oó]n/i);
    const bloodData = await expectSectionVisible(page, 'bloodData', /Datos sangu[ií]neos/i);
    await expectSectionVisible(page, 'medicalRecord', /Historia cl[ií]nica/i);
    await expectSectionVisible(page, 'insurance', /Seguro/i);
    await expectSectionVisible(page, 'responsiblePerson', /Acompa[nñ]ante o responsable/i);

    await expectSectionOrder(page, [
      'demographics',
      'contact',
      'filiation',
      'bloodData',
      'medicalRecord',
      'insurance',
      'responsiblePerson',
    ]);

    await expect(page.locator('div[id="birthplace"]')).toHaveCount(0);
    await expect(contact.getByRole('heading', { name: /Direcci[oó]n de residencia/i })).toBeVisible();
    await expect(contact.getByLabel(/Lugar de nacimiento/i)).toBeVisible();
    await expect(contact.getByLabel(/N[uú]mero de Tel[eé]fono|N[uú]mero de celular/i)).toBeVisible();
    await expect(filiation.getByText(/Estado civil/i)).toBeVisible();
    await expect(filiation.getByText(/Grupo sangu[ií]neo/i)).toHaveCount(0);
    await expect(filiation.getByText(/Factor Rh/i)).toHaveCount(0);
    await expect(bloodData.getByText(/Grupo sangu[ií]neo/i)).toBeVisible();
    await expect(bloodData.getByText(/Factor Rh/i)).toBeVisible();
  });

  test('validates contact fields before registration submit', async ({ page }) => {
    await gotoPatientRegistration(page);

    const contact = await expectSectionVisible(page, 'contact', /Residencia, nacimiento y contacto/i);
    await fillTextbox(contact.getByLabel(/N[uú]mero de Tel[eé]fono|N[uú]mero de celular/i).first(), 'e100');
    await contact
      .getByLabel(/N[uú]mero de Tel[eé]fono|N[uú]mero de celular/i)
      .first()
      .blur();

    await expect(contact.getByText(/Entrada inv[aá]lida|Invalid Input/i)).toBeVisible({ timeout: 10_000 });
  });

  test('fills basic patient data from the RENIEC mock lookup', async ({ page }) => {
    await gotoPatientRegistration(page);

    await fillTextbox(
      page.locator('input[name="identifiers.dni.identifierValue"], #identifiers\\.dni\\.identifierValue').first(),
      '12345678',
    );
    await page.getByRole('button', { name: /Buscar en RENIEC/i }).click();

    await expect(page.getByText(/Datos RENIEC cargados/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#givenName')).toHaveValue('Juan');
    await expect(page.locator('#middleName')).toHaveValue('Carlos');
    await expect(page.locator('#familyName')).toHaveValue('Perez');
    await expect(page.locator('#familyName2')).toHaveValue('Garcia');
    await expect(page.getByRole('spinbutton', { name: /d[ií]a, Fecha de nacimiento/i })).toContainText('14');
    await expect(page.getByRole('spinbutton', { name: /mes, Fecha de nacimiento/i })).toContainText('5');
    await expect(page.getByRole('spinbutton', { name: /a[nñ]o, Fecha de nacimiento/i })).toContainText('1990');
    await expect(page.locator('input[name="gender"][value="male"]')).toBeChecked();
  });
});
