import { expect } from '@playwright/test';
import { test } from '../core';

let patientUuid: string;

test.beforeEach(async ({ api, patient, request }) => {
  patientUuid = patient.uuid;
});

test.describe
  .serial('ImagingDetailedSummary E2E', () => {
    test('navigate to patient chart with existing session', async ({ page }) => {
      await page.route('**/studies/**', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.route('**/requests/**', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      // Imaging buttons should exist
      await expect(page.getByText(/Upload/i)).toBeVisible();
      await expect(page.getByText(/Link studies/i)).toBeVisible();
    });

    test('should open Link and upload workspace', async ({ page }) => {
      await page.route('**/studies/**', async (route) => {
        await new Promise((r) => setTimeout(r, 2000)); // simulate loading
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.route('**/requests/**', async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      const linkButton = page.getByRole('button', { name: /Link studies/i });
      const uploadButton = page.getByRole('button', { name: /Upload/i });

      await expect(linkButton).toBeVisible();
      await expect(uploadButton).toBeVisible();

      await linkButton.click();
      await expect(page.getByPlaceholder(/Select an Orthanc server/i)).toBeVisible();

      await uploadButton.click();
      await expect(page.getByTestId('upload-studies-fileuploader')).toBeVisible();
    });

    test('should open Upload Studies workspace and display form controls', async ({ page }) => {
      // Navigate to Imaging dashboard
      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      // Click the "Upload" button in ImagingDetailedSummary
      const uploadButton = page.getByRole('button', { name: /upload/i });
      await uploadButton.click();

      // wait for upload studies workspace to open
      const uploadWorkspace = page.locator('#uploadStudies');
      await uploadWorkspace.waitFor({ state: 'visible', timeout: 40000 });

      // Assert workspace form is visible
      await expect(uploadWorkspace).toBeVisible();

      // check for Orthanc configuration
      const orthancGroup = page.getByRole('group', { name: /Orthanc configurations/i });
      await expect(orthancGroup).toBeVisible();

      // Check for ComboBox
      const comboBox = page.getByTestId('orthanc-server-combobox');
      await expect(comboBox).toBeVisible();
      await expect(comboBox).toBeEnabled();
      await comboBox.click();

      // Check for FileUpload
      const fileuploader = page.getByTestId('upload-studies-fileuploader');
      await expect(fileuploader).toBeVisible();

      // Check for upload and Cancel buttons
      const uploadSubmit = page.getByTestId('upload-studies-submit');
      const cancelButton = page.getByTestId('upload-studies-cancel');

      await expect(uploadSubmit).toBeVisible();
      await expect(cancelButton).toBeVisible();

      await uploadSubmit.click();
    });

    test('should display worklist or empty state', async ({ page }) => {
      await page.route('**/requests/**', async (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      );

      await page.route('**/studies/**', async (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        }),
      );

      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      await expect(page.getByText(/No worklist found/i).first()).toBeVisible();

      const emptyText = page.locator('.-esm-patient-imaging__empty-state__content___dNAYo', {
        hasText: /No worklist found/i,
      });
      await expect(emptyText).toBeVisible();
    });

    test('should open Add Request workspace and validate form', async ({ page }) => {
      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      const worklistBtn = page.getByRole('button', { name: /Record No worklist found/i });
      await worklistBtn.click();

      await expect(page.locator('#newRequestForm').first()).toBeVisible({ timeout: 10000 });

      await expect(page.getByPlaceholder(/Select an Orthanc server/i)).toBeVisible();
      await expect(page.getByPlaceholder(/Select the request priority/i)).toBeVisible();
    });

    test('show validation messages when saving empty request', async ({ page }) => {
      await page.goto(`${process.env.E2E_BASE_URL}/spa/patient/${patientUuid}/chart/Imaging#`);

      // Open the "Add Request" workspace
      const worklistBtn = page.getByRole('button', { name: /Record No worklist found/i });
      await worklistBtn.click();

      const form = page.locator('#newRequestForm');
      await form.waitFor({ state: 'visible', timeout: 20000 });
      await expect(form).toBeVisible();

      await page.getByRole('button', { name: /Save and close/i }).click();

      // Assert validation messages are visible
      const accessionError = page.locator('#accessionNumber-error-msg');
      await expect(accessionError).toHaveText('Required');

      const requestDescriptionError = page.locator('#requestDescription-error-msg');
      await expect(requestDescriptionError).toHaveText('Required');

      const requestingPhysicianError = page.locator('#requestingPhysician-error-msg');
      await expect(requestingPhysicianError).toHaveText('Required');
    });
  });
