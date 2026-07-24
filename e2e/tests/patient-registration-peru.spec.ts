import { expect, type Locator, type Page, test } from '@playwright/test';

const e2eHostname = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8080/openmrs/spa').hostname;
const isLocalDevelopment = e2eHostname === 'localhost' || e2eHostname === '127.0.0.1';

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

async function enableExternalIdentityLookups(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('openmrs:feature-flag:patient-registration-external-lookups', 'true');
    localStorage.setItem(
      'openmrs:feature-flag-meta:patient-registration-external-lookups',
      JSON.stringify({
        label: 'Consultas externas RENIEC/SIS',
        description: 'Muestra los botones de consulta a RENIEC y SIS en el formulario de registro de pacientes.',
      }),
    );
  });
}

test.describe('Peru patient registration', () => {
  test('renders Peru-specific sections in the expected order', async ({ page }) => {
    await gotoPatientRegistration(page);

    const contact = await expectSectionVisible(page, 'contact', /Residencia, nacimiento y contacto/i);
    const filiation = await expectSectionVisible(page, 'filiation', /Datos de filiaci[oó]n/i);
    const bloodData = await expectSectionVisible(page, 'bloodData', /Grupo sangu[ií]neo y factor Rh/i);
    await expectSectionVisible(page, 'insurance', /Financiador|Funder/i);
    const responsiblePerson = await expectSectionVisible(
      page,
      'responsiblePerson',
      /V[ií]nculos y responsable|Family links and responsible person/i,
    );

    await expectSectionOrder(page, [
      'demographics',
      'responsiblePerson',
      'contact',
      'filiation',
      'bloodData',
      'insurance',
    ]);

    await expect(page.locator('div[id="birthplace"]')).toHaveCount(0);
    await expect(contact.getByRole('heading', { name: /Direcci[oó]n de residencia/i })).toBeVisible();
    await expect(contact.getByRole('heading', { name: /Lugar de nacimiento/i })).toBeVisible();
    await expect(contact.getByLabel(/N[uú]mero de Tel[eé]fono/i)).toBeVisible();
    await expect(contact.getByLabel(/^Celular/i)).toBeVisible();
    await expect(filiation.getByText(/Estado civil/i)).toBeVisible();
    await expect(filiation.getByText(/Grupo sangu[ií]neo/i)).toHaveCount(0);
    await expect(filiation.getByText(/Factor Rh/i)).toHaveCount(0);
    await expect(bloodData.getByRole('group', { name: /Grupo sangu[ií]neo/i })).toBeVisible();
    await expect(bloodData.getByRole('group', { name: /Factor Rh/i })).toBeVisible();
    await expect(
      responsiblePerson.getByRole('heading', { name: /V[ií]nculos del paciente|Patient family links/i }),
    ).toBeVisible();
    await expect(
      responsiblePerson.getByRole('button', { name: /Agregar v[ií]nculo familiar|Add family link/i }),
    ).toBeVisible();
    await expect(
      responsiblePerson.getByRole('heading', { name: /Responsable del paciente|Patient responsible person/i }),
    ).toBeVisible();
    await expect(
      responsiblePerson.getByText(
        /Agregue un v[ií]nculo familiar antes de seleccionar al responsable principal|Add a family link before selecting the primary responsible person/i,
      ),
    ).toBeVisible();
  });

  test('stacks blood group and Rh factor as separate types', async ({ page }) => {
    await gotoPatientRegistration(page);

    const bloodData = await expectSectionVisible(page, 'bloodData', /Grupo sangu[ií]neo y factor Rh/i);
    const bloodGroup = bloodData.getByRole('group', { name: /Grupo sangu[ií]neo/i });
    const rhFactor = bloodData.getByRole('group', { name: /Factor Rh/i });
    await expect(bloodGroup).toBeVisible();
    await expect(rhFactor).toBeVisible();

    const [bloodGroupBottom, rhFactorTop] = await Promise.all([
      bloodGroup.evaluate((element) => element.getBoundingClientRect().bottom),
      rhFactor.evaluate((element) => element.getBoundingClientRect().top),
    ]);
    expect(rhFactorTop, 'Factor Rh should render below blood group').toBeGreaterThanOrEqual(bloodGroupBottom);
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

  test('completes a DNI and assigns Peru without blocking the registration form', async ({ page }) => {
    await gotoPatientRegistration(page);

    const dni = page.locator('input[name="identifiers.dni.identifierValue"]').first();
    await dni.fill('1234567');
    await expect(dni).toHaveValue('1234567');

    await dni.pressSequentially('8');

    await expect(dni).toHaveValue('12345678');
    await expect(page.getByRole('combobox', { name: /Nacionalidad/i })).toHaveValue('Perú');
    await fillTextbox(page.locator('#givenName'), 'Juan');
    await expect(page.locator('#givenName')).toHaveValue('Juan');
  });

  test('clears automatic Peru and unlocks nationality when a DNI becomes incomplete', async ({ page }) => {
    await gotoPatientRegistration(page);

    const dni = page.locator('input[name="identifiers.dni.identifierValue"]').first();
    const nationality = page.getByRole('combobox', { name: /Nacionalidad/i });

    await dni.fill('1234567');
    await dni.pressSequentially('8');
    await expect(nationality).toHaveValue('Perú');
    await expect(nationality).toBeDisabled();

    await dni.press('Backspace');

    await expect(dni).toHaveValue('1234567');
    await expect(nationality).toHaveValue('');
    await expect(nationality).toBeEnabled();
    await fillTextbox(page.locator('#givenName'), 'Juana');
    await expect(page.locator('#givenName')).toHaveValue('Juana');
  });

  test('quick searches residence addresses from the configured address hierarchy', async ({ page }) => {
    await gotoPatientRegistration(page);

    const contact = await expectSectionVisible(page, 'contact', /Residencia, nacimiento y contacto/i);
    const residenceSearch = contact.getByRole('searchbox', { name: /Buscar direcci[oó]n|Search address/i }).first();

    await residenceSearch.fill('PER');
    const peruOption = contact.getByRole('button', { name: /^PERU(?:\s+\(00\))?$/i });
    await expect(peruOption).toBeVisible({ timeout: 15_000 });

    await peruOption.click();
    await expect(contact.getByLabel(/^Pa[ií]s/i).first()).toHaveValue(/^PERU$/i);
    await expect(residenceSearch).toHaveValue('');
  });

  test('fills basic patient data from the RENIEC mock lookup', async ({ page }) => {
    test.skip(!isLocalDevelopment, 'Synthetic RENIEC identities are only available in local development.');
    await enableExternalIdentityLookups(page);
    await gotoPatientRegistration(page);

    await fillTextbox(
      page.locator('input[name="identifiers.dni.identifierValue"], #identifiers\\.dni\\.identifierValue').first(),
      '12345678',
    );
    await page.getByRole('button', { name: /Buscar.*RENIEC/i }).click();

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

  test('does not expose synthetic RENIEC identities in deployed environments', async ({ page }) => {
    test.skip(isLocalDevelopment, 'Deployed-environment safety check.');
    await enableExternalIdentityLookups(page);
    await gotoPatientRegistration(page);

    await fillTextbox(
      page.locator('input[name="identifiers.dni.identifierValue"], #identifiers\\.dni\\.identifierValue').first(),
      '12345678',
    );
    await page.getByRole('button', { name: /Buscar.*RENIEC/i }).click();

    await expect(page.getByText(/Sin coincidencias locales ni datos RENIEC/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Datos RENIEC cargados/i)).toHaveCount(0);
    await expect(page.locator('#givenName')).toHaveValue('');
  });
});
