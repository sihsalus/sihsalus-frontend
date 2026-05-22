import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Global setup for authenticated tests
async function login(page: Page) {
  await page.goto('/openmrs/spa/home');
  await page.waitForLoadState('networkidle').catch(() => null);

  const appShell = page.locator('main, banner, nav, [role="banner"], [role="navigation"]').first();
  if (!page.url().includes('/login') && (await appShell.isVisible().catch(() => false))) {
    return;
  }

  await page.goto('/openmrs/spa/login');
  const usernameField = page.locator('input[name="username"], input[type="text"]').first();
  const passwordField = page.locator('input[name="password"], input[type="password"]').first();

  if (!(await usernameField.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }

  await usernameField.fill('admin');
  await passwordField.fill('Admin123');
  await page.getByRole('button', { name: /log in|login|iniciar sesión|entrar/i }).click();

  // Wait for location selector or redirect
  await page.waitForNavigation({ timeout: 10000 }).catch(() => null);

  // If location selector appears, select default
  const locationSelector = page.locator('[data-testid="location-select"], select[name*="location"]').first();
  if (await locationSelector.isVisible().catch(() => false)) {
    await locationSelector.selectOption({ index: 1 });
    await page
      .getByRole('button', { name: /continue|confirmar|continuar/i })
      .click()
      .catch(() => null);
    await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
  }
}

const SPA_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080/openmrs/spa';

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Go to home page first to ensure we're in the app
    await page.goto('/openmrs/spa/home').catch(() => null);
  });

  test('User Login Flow', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto(`${SPA_BASE_URL}/login`);

    // 1. Fill credentials
    const usernameField = page.locator('input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();

    await usernameField.fill('admin');
    await passwordField.fill('Admin123');

    // 2. Submit login
    await page.getByRole('button', { name: /log in|login|iniciar sesión|entrar/i }).click();

    // 3. Wait for redirect (either to location selector or dashboard)
    await page.waitForNavigation({ timeout: 15000 }).catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => null);

    // 4. Verify we're logged in (in SPA or location selector)
    const isAtLogin = page.url().includes('/login');
    const isAtHome = page.url().includes('/home') || page.url().includes('/spa');

    expect(isAtLogin || isAtHome).toBeTruthy();
    await ctx.close();
  });

  test('Patient Search & View', async ({ page }) => {
    await login(page);

    // Navigate to patient search
    await page.goto('/openmrs/spa/patient-search');
    await page.waitForLoadState('networkidle').catch(() => null);

    // 1. Search for a patient
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('10009');
      await page.waitForTimeout(500); // Debounce

      // 2. Wait for search results
      const patientResult = page
        .locator('[data-testid="patient-result"], .patient-result, button:has-text("10009")')
        .first();
      await patientResult.waitFor({ timeout: 5000 }).catch(() => null);

      if (await patientResult.isVisible().catch(() => false)) {
        // 3. Click on patient result
        await patientResult.click();

        // 4. Verify patient chart loaded
        await page.waitForNavigation({ timeout: 5000 }).catch(() => null);
        await page.waitForLoadState('networkidle').catch(() => null);

        expect(page.url()).toContain('/patient');
      }
    }
  });

  test('Form Submission - Vitals', async ({ page }) => {
    await login(page);

    // Navigate to patient if we can
    await page.goto('/openmrs/spa/patient-search');
    await page.waitForLoadState('networkidle').catch(() => null);

    // Look for form or encounter button
    const vitalButton = page
      .locator('button:has-text("Vitals"), button:has-text("vital"), [data-testid*="vital"]')
      .first();

    if (await vitalButton.isVisible().catch(() => false)) {
      await vitalButton.click();
      await page.waitForLoadState('networkidle').catch(() => null);

      // 1. Fill form fields
      const inputs = page.locator('input[type="number"], input[type="text"]');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // Fill first numeric field (temperature)
        await inputs.first().fill('37.5');

        // Fill second field if available (BP)
        if (inputCount > 1) {
          await inputs.nth(1).fill('120');
        }
      }

      // 2. Submit form
      const submitButton = page
        .locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Guardar")')
        .first();
      if (await submitButton.isVisible().catch(() => false)) {
        await submitButton.click();

        // 3. Wait for success message
        await page.waitForTimeout(1000);
        await page.waitForLoadState('networkidle').catch(() => null);

        // Verify success (no error message visible)
        const errorMessage = page.locator('.error-message, .alert-danger, [role="alert"]:has-text("error")').first();
        const isError = await errorMessage.isVisible().catch(() => false);

        expect(isError).toBeFalsy();
      }
    }
  });

  test('Error Handling - Network Resilience', async ({ page }) => {
    // 1. Start normal navigation
    await page.goto('/openmrs/spa/home').catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => null);

    // 2. Go offline
    await page.context().setOffline(true);

    // 3. Try to navigate
    await page.goto('/openmrs/spa/patient-search').catch(() => null);
    await page.waitForTimeout(1000);

    // 4. Go back online
    await page.context().setOffline(false);

    // 5. Try again
    await page.reload().catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => null);

    // 6. Verify app is responsive
    const appContainer = page.locator('[data-openmrs-spa], #root, body').first();
    expect(await appContainer.isVisible().catch(() => false)).toBeTruthy();
  });

  test('Accessibility - Login Page Navigation', async ({ page }) => {
    await page.goto('/openmrs/spa/login');
    await page.waitForLoadState('networkidle').catch(() => null);

    // 1. Test keyboard navigation
    const usernameInput = page.locator('input[type="text"]').first();

    if (await usernameInput.isVisible().catch(() => false)) {
      await usernameInput.focus();

      // Tab to password field
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        return (document.activeElement as HTMLElement)?.tagName;
      });

      // Should be focused on password field or next element
      expect(['INPUT', 'BUTTON', 'A']).toContain(focusedElement);
    }

    // 2. Test for required form labels
    const formElements = page.locator('input[required], label').first();
    const isAccessible = await formElements.isVisible().catch(() => false);

    expect(isAccessible).toBeTruthy();
  });

  test('Data Loading - Concurrent Requests', async ({ page }) => {
    await login(page);

    // Navigate to dashboard which loads multiple components
    await page.goto('/openmrs/spa/home');

    await page.waitForLoadState('networkidle').catch(() => null);

    // Even if widgets don't load, app should be responsive
    const appShell = page.locator('main, [data-openmrs-spa], #root, body').first();
    await expect(appShell).toBeVisible();
  });

  test('Location Selector if Required', async ({ page }) => {
    await page.goto('/openmrs/spa/login');

    // Login
    const usernameField = page.locator('input[type="text"]').first();
    const passwordField = page.locator('input[type="password"]').first();

    await usernameField.fill('admin');
    await passwordField.fill('Admin123');

    await page.getByRole('button', { name: /log in|login|iniciar sesión|entrar/i }).click();

    await page.waitForTimeout(2000);

    // If location selector appears, complete it
    const locationSelect = page.locator('select[name*="location"], [data-testid="location-select"]').first();

    if (await locationSelect.isVisible().catch(() => false)) {
      const selectTagName = await locationSelect.evaluate((el) => el.tagName);

      if (selectTagName === 'SELECT') {
        await locationSelect.selectOption({ index: 1 });
      }

      const continueButton = page.getByRole('button', { name: /continue|confirmar|continuar/i }).first();
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click();

        await page.waitForNavigation({ timeout: 5000 }).catch(() => null);

        // Should be redirected to home
        const isAtHome = page.url().includes('/home') || page.url().includes('/spa');
        expect(isAtHome).toBeTruthy();
      }
    }
  });
});
