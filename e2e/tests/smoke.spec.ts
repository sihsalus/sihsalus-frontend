import { expect, test } from '@playwright/test';

test.describe('SPA Smoke Tests', () => {
  test('shell loads and renders the login page when unauthenticated', async ({ browser }) => {
    // Use a fresh context (no stored auth) to verify login page renders
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto('login');
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test('authenticated user reaches the home page', async ({ page }) => {
    await page.goto('home');

    // The home page should render without crashing — check for the main content area
    await expect(page.locator('main, [data-testid="home-page"]')).toBeVisible({ timeout: 30_000 });

    // Should NOT be redirected back to login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('importmap is served and contains expected modules', async ({ page }) => {
    const res = await page.request.get('/openmrs/spa/importmap.json');
    expect(res.ok()).toBeTruthy();

    const importmap = await res.json();
    expect(importmap).toHaveProperty('imports');
    expect(Object.keys(importmap.imports).length).toBeGreaterThan(0);
  });

  test('routes registry is served', async ({ page }) => {
    const res = await page.request.get('/openmrs/spa/routes.registry.json');
    expect(res.ok()).toBeTruthy();

    const routes = await res.json();
    expect(Object.keys(routes).length).toBeGreaterThan(0);
  });

  test('no console errors on home page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('home');
    await page.waitForLoadState('networkidle');

    // Filter out known noisy errors (e.g. missing favicon, dev warnings)
    const critical = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('DevTools') &&
        !e.includes('third-party') &&
        !e.includes("O3 Core Translations does not provide key 'SIHSALUS'"),
    );

    expect(critical).toEqual([]);
  });

  test('navigation between pages works', async ({ page }) => {
    await page.goto('home');
    await page.waitForLoadState('networkidle');

    // Try navigating to a different SPA route — the app should handle it client-side
    await page.goto('search');
    await expect(page.locator('main, input[type="search"], input[placeholder*="Buscar"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
