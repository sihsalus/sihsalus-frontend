import { expect, test } from '@playwright/test';
import { getOpenmrsBaseUrl } from '../utils/e2e-urls';

const API_BASE_URL = getOpenmrsBaseUrl();

test.describe('Peru admission accreditation checks', () => {
  test('patient registration exposes the admission data capture surface', async ({ page }) => {
    await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Crear nuevo paciente|Create new patient/i })).toBeVisible({
      timeout: 30_000,
    });

    const requiredSections: Array<[string, RegExp]> = [
      // Secciones del formulario de registro vigente (paneles 0-6).
      ['identityLookup', /Validación de identidad( y seguro)?/i],
      ['demographics', /Información básica/i],
      ['responsiblePerson', /Vínculos y responsable/i],
      ['contact', /Residencia, nacimiento y contacto/i],
      ['filiation', /Datos de filiación/i],
      ['bloodData', /Grupo sanguíneo y factor Rh/i],
      ['insurance', /Financiador/i],
    ];
    for (const [id, pattern] of requiredSections) {
      // The sidebar repeats these labels and is hidden on mobile. Check the real panel.
      await expect(page.locator(`#${id}`).getByRole('heading', { name: pattern }), `${id} section`).toBeVisible({
        timeout: 5_000,
      });
    }

    // The CSS required marker contributes "*" to the heading's accessible name.
    await expect(
      page.locator('#demographics').getByRole('heading', { name: /^Nacimiento(?:\s*\*)?$/i }),
      'birth field',
    ).toBeVisible({ timeout: 5_000 });

    // RelationshipsSection changes this region name only after metadata loading finishes.
    const relationships = page
      .locator('#responsiblePerson')
      .getByRole('region', { name: 'Relationships section', exact: true });
    await expect(relationships, 'relationship metadata loading must finish').toBeVisible({ timeout: 30_000 });
    await expect(
      relationships.getByText('Tipos de vínculo no disponibles', { exact: true }),
      'relationship metadata unavailable; verify the configured catalog and session',
    ).toHaveCount(0);

    const requiredHeadings: Array<[string, string, RegExp]> = [
      ['identityLookup', 'identification data heading', /Datos de identificación/i],
      ['identityLookup', 'identity lookup heading', /Buscar\/validar identidad/i],
      ['demographics', 'full name heading', /Nombre completo/i],
      ['demographics', 'sex field', /Sexo/i],
      ['contact', 'residence address heading', /Dirección de residencia/i],
      ['contact', 'birthplace heading', /Lugar de nacimiento/i],
      ['responsiblePerson', 'responsible person heading', /Responsable del paciente/i],
      ['responsiblePerson', 'patient links heading', /Vínculos del paciente/i],
    ];

    for (const [id, label, pattern] of requiredHeadings) {
      await expect(page.locator(`#${id}`).getByRole('heading', { name: pattern }), label).toBeVisible({
        timeout: 5_000,
      });
    }

    // SectionWrapper is always open. Require the input, not its heading or sidebar label.
    await expect(
      page.locator('#insurance').getByRole('combobox', { name: /^Financiador(?:\s*\*)?$/i }),
      'financer field',
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.locator('#filiation').getByRole('combobox', { name: /^Etnia(?:\s*\(opcional\))?$/i }),
      'ethnicity field',
    ).toBeVisible({ timeout: 5_000 });

    const nameFields = page.locator('#demographics [data-field-name="name"]');
    await expect(
      nameFields.getByRole('textbox', { name: /^Apellido materno(?:\s*\*)?$/i }),
      'second family name field',
    ).toBeVisible({ timeout: 5_000 });

    await expect(nameFields.getByText('¿Se conoce el nombre del paciente?', { exact: true })).toBeVisible({
      timeout: 5_000,
    });
    await expect(nameFields.getByRole('tab', { name: 'Sí', exact: true }), 'known patient option').toBeVisible({
      timeout: 5_000,
    });
    await expect(nameFields.getByRole('tab', { name: 'No', exact: true }), 'unknown patient option').toBeVisible({
      timeout: 5_000,
    });

    await expect(page.getByText(/Nombre del acompañante o responsable/i)).toHaveCount(0);
    await expect(page.getByText(/Edad del acompañante o responsable/i)).toHaveCount(0);
    await expect(page.getByText(/Parentesco del acompañante o responsable/i)).toHaveCount(0);

    await expect(
      page
        .locator('form')
        .filter({ has: page.locator('#demographics') })
        .getByRole('button', { name: /^Registrar paciente$/i }),
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
    await expect(page).toHaveURL(
      /\/openmrs\/admin\/patients\/findDuplicatePatients\.htm$|\/home\/care-logbook\/merge$/,
    );
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
