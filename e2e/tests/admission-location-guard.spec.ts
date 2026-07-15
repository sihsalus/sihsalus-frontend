import { expect, test } from '@playwright/test';

test.describe('Admission session location', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('requires admission users to select a location before opening patient registration', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The session-location regression only needs one browser project');

    let sessionWasIntercepted = false;
    let selectedLocationUuid: string | undefined;
    let mockedSession: Record<string, unknown> | undefined;

    await page.route(/\/ws\/fhir2\/R4\/Location\?.*_count=1/, async (route) => {
      const response = await route.fetch();
      const locations = await response.json();

      await route.fulfill({
        response,
        json: {
          ...locations,
          total: Math.max(2, locations.total ?? 0),
        },
      });
    });

    const sessionEndpointPattern = /\/ws\/rest\/v1\/session\/?(?:\?.*)?$/;

    await page.route(sessionEndpointPattern, async (route) => {
      if (route.request().method() === 'POST') {
        const requestedLocation = route.request().postDataJSON()?.sessionLocation;
        if (typeof requestedLocation === 'string' && requestedLocation) {
          selectedLocationUuid = requestedLocation;
          mockedSession = {
            ...mockedSession,
            sessionLocation: {
              display: 'E2E selected location',
              uuid: selectedLocationUuid,
            },
          };
        }
        await route.fulfill({ json: mockedSession });
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
      const userProperties = { ...(session.user?.userProperties ?? {}) };
      delete userProperties.defaultLocation;

      sessionWasIntercepted = true;
      mockedSession = {
        ...session,
        sessionLocation: selectedLocationUuid
          ? {
              display: 'E2E selected location',
              uuid: selectedLocationUuid,
            }
          : null,
        user: {
          ...session.user,
          userProperties,
          roles: [...roles, { display: 'Admisión', name: 'Admisión' }],
          privileges: [...privileges, { display: 'app:home.admision', name: 'app:home.admision' }],
        },
      };

      await route.fulfill({
        response,
        json: mockedSession,
      });
    });

    await page.goto('patient-registration', { waitUntil: 'domcontentloaded' });

    await expect.poll(() => sessionWasIntercepted, { timeout: 30_000 }).toBe(true);
    await expect(page).toHaveURL(/\/login\/location(?:\?|$)/, { timeout: 30_000 });
    const confirmButton = page.getByRole('button', { name: /Confirmar|Confirm/i });
    await expect(confirmButton).toBeVisible({ timeout: 30_000 });

    await page.getByRole('radio').first().check({ force: true });
    await expect(confirmButton).toBeEnabled();
    const sessionUpdateRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        sessionEndpointPattern.test(request.url()) &&
        typeof request.postDataJSON()?.sessionLocation === 'string',
    );
    await confirmButton.click();
    await sessionUpdateRequest;

    await expect.poll(() => selectedLocationUuid, { timeout: 30_000 }).toBeTruthy();
    await expect(page).toHaveURL(/\/patient-registration(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByText(/Crear nuevo paciente|Create new patient/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Cambiar ubicaci[oó]n|Change location/i })).toBeVisible();
  });
});
