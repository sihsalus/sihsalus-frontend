import { expect, test } from '@playwright/test';

test.describe('Admission session location', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('does not require or expose a session location for admission users', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The admission location contract only needs one browser project');

    let sessionWasIntercepted = false;
    let sessionLocationUpdateAttempts = 0;
    let mockedSession: Record<string, unknown> | undefined;
    const sessionEndpointPattern = /\/ws\/rest\/v1\/session\/?(?:\?.*)?$/;

    await page.route(sessionEndpointPattern, async (route) => {
      if (route.request().method() === 'POST') {
        sessionLocationUpdateAttempts += 1;
        await route.fulfill({ json: mockedSession ?? {} });
        return;
      }

      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const response = await route.fetch();
      const session = await response.json();
      const roles = Array.isArray(session.user?.roles) ? session.user.roles : [];
      const privileges = Array.isArray(session.user?.privileges) ? session.user.privileges : [];

      sessionWasIntercepted = true;
      mockedSession = {
        ...session,
        sessionLocation: null,
        user: {
          ...session.user,
          roles: [...roles, { display: 'Admisión', name: 'Admisión' }],
          privileges: [...privileges, { display: 'app:home.admision', name: 'app:home.admision' }],
        },
      };

      await route.fulfill({ response, json: mockedSession });
    });

    await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });

    await expect.poll(() => sessionWasIntercepted, { timeout: 30_000 }).toBe(true);
    await expect(page).toHaveURL(/\/patient-registration(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByText(/Crear nuevo paciente|Create new patient/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Cambiar ubicaci[oó]n|Change location/i })).toHaveCount(0);
    expect(sessionLocationUpdateAttempts).toBe(0);

    await page.goto('login/location?update=true', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/login\/location(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Confirmar|Confirm/i })).toHaveCount(0);
    expect(sessionLocationUpdateAttempts).toBe(0);
  });
});
