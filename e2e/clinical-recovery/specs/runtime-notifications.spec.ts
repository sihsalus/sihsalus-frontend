import { test } from '@playwright/test';
import { blockClinicalRecovery } from '../quarantine.mjs';

test.beforeAll(() => blockClinicalRecovery());

test('recovered proposal: role/facility isolation and minimal SSE/WebSocket notifications', async () => {
  blockClinicalRecovery();
  // Do not load the standalone ESM implementation through Playwright's CJS
  // discovery transform. Its future execution adapter also requires review.
  const { runRecoveredNotificationSmoke } = await import('../runtime-notifications-dev-smoke.mjs');
  await runRecoveredNotificationSmoke();
});
