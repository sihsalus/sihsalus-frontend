import { expect, type Page, test } from '@playwright/test';

async function gotoLogin(page: Page) {
  await page.goto('./login');
  await page.getByRole('textbox', { name: /username|nombre de usuario/i }).waitFor();
}

test.describe('Accessibility checks @accessibility', () => {
  test('Login page has basic semantic structure @accessibility', async ({ page }) => {
    await gotoLogin(page);

    await expect(page.locator('main, [role="main"]').first()).toBeVisible();

    const headingCount = await page.locator('h1, h2, [role="heading"]').count();
    expect(headingCount).toBeGreaterThan(0);

    const interactiveCount = await page.locator('button, input, select, textarea, a[href], [role="button"]').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });

  test('Keyboard navigation reaches primary controls @accessibility', async ({ page }) => {
    await gotoLogin(page);

    await page.keyboard.press('Tab');
    const firstFocusedTag = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.tagName ?? '');
    expect(firstFocusedTag.length).toBeGreaterThan(0);

    const focusedTags = [firstFocusedTag];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      focusedTags.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.tagName ?? ''));
    }

    expect(focusedTags.some((tag) => ['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(tag))).toBe(true);
  });

  test('Form fields have accessible names @accessibility', async ({ page }) => {
    await gotoLogin(page);

    const controls = page.locator('input, select, textarea');
    const total = await controls.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const control = controls.nth(i);
      const hasLabel = await control.evaluate((el) => {
        const id = el.getAttribute('id');
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const hasPlaceholder = el.getAttribute('placeholder');
        const hasAssociatedLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        return !!(ariaLabel || ariaLabelledBy || hasAssociatedLabel || hasPlaceholder);
      });

      expect(hasLabel).toBeTruthy();
    }
  });

  test('Images must have alt text when present @accessibility', async ({ page }) => {
    await gotoLogin(page);

    const images = page.locator('img');
    const total = await images.count();

    for (let i = 0; i < total; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).not.toBeNull();
    }
  });
});
