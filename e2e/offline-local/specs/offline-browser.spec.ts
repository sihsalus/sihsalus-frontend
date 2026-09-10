import { expect, test } from '@playwright/test';
import type { OfflineHarness } from '../contract';

declare global {
  interface Window {
    offlineHarness: OfflineHarness;
  }
}
const scope = '/openmrs/spa/';
const session = '/openmrs/ws/rest/v1/session';
const resource = '/openmrs/ws/resource';
test.beforeEach(async ({ page, request }) => {
  await request.get('/control?reset');
  await page.goto(scope);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/openmrs/spa/service-worker.js', { scope: '/openmrs/spa/' });
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate((url) => fetch(url), session);
  await expect.poll(() => page.evaluate(() => window.offlineHarness.profile().then((p) => p?.phase))).toBe('active');
});

test('real worker serves owned downloads after reload, bypasses cache for fresh reads and blocks another account', async ({
  page,
  context,
  request,
}) => {
  await page.evaluate(
    (url) => fetch(url, { headers: { 'x-omrs-offline-caching-strategy': 'network-first' } }),
    resource,
  );
  await request.get('/control?offline');
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate((url) => fetch(url).then((r) => r.text()), resource)).toBe('synthetic-synthetic-a');
  expect(await page.evaluate((url) => fetch(url, { cache: 'no-store' }).then((r) => r.status), resource)).toBe(503);
  await request.get('/control');
  await context.setOffline(false);
  await request.get('/control?user=synthetic-b');
  await page.evaluate((url) => fetch(url), session);
  await request.get('/control?offline');
  await context.setOffline(true);
  expect(await page.evaluate((url) => fetch(url).then((r) => r.status), resource)).toBe(503);
});

test('queue survives reload and lost responses, then reconciles each synthetic workflow without replaying queued writes', async ({
  page,
  context,
  request,
}) => {
  await request.get('/control?offline');
  await context.setOffline(true);
  await page.evaluate(() => window.offlineHarness.add());
  await page.reload();
  expect(
    await page.evaluate(() => window.offlineHarness.queue().then((items) => items.map((item) => item.type))),
  ).toEqual(['registration', 'form', 'vitals', 'triage']);
  await request.get('/control');
  await context.setOffline(false);
  await request.get('/control?fail');
  expect(
    await page.evaluate(() =>
      window.offlineHarness.sync().then(
        () => true,
        () => false,
      ),
    ),
  ).toBe(false);
  expect(await page.evaluate(() => window.offlineHarness.queue().then((items) => items.length))).toBe(4);
  const attempted: Array<[string, number]> = await (await request.get('/control')).json();
  expect(attempted.map(([id]) => id).sort()).toEqual([
    'synthetic-form',
    'synthetic-registration',
    'synthetic-triage',
    'synthetic-vitals',
  ]);
  await page.reload();
  await page.evaluate(() => window.offlineHarness.sync());
  expect(await page.evaluate(() => window.offlineHarness.queue().then((items) => items.length))).toBe(0);
  // A browser may retry a reset TCP request; reconnecting the queue must add no create attempt.
  expect(await (await request.get('/control')).json()).toEqual(attempted);
});

test('cleanup refuses queued actions and keeps the app shell after verified removal', async ({
  page,
  context,
  request,
}) => {
  await page.evaluate(
    (url) => fetch(url, { headers: { 'x-omrs-offline-caching-strategy': 'network-first' } }),
    resource,
  );
  await page.evaluate(() => window.offlineHarness.add());
  expect(await page.evaluate(() => window.offlineHarness.message('clearOfflineDownloads'))).toMatchObject({
    success: false,
  });
  expect(await page.evaluate(() => window.offlineHarness.queue().then((items) => items.length))).toBe(4);
  // Only synthetic fixture rows in this fresh browser context are removed.
  await page.evaluate(() => window.offlineHarness.clearQueue());
  expect(await page.evaluate(() => window.offlineHarness.message('clearOfflineDownloads'))).toMatchObject({
    success: true,
  });
  await request.get('/control?offline');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Local synthetic regression')).toBeVisible();
  expect(await page.evaluate((url) => fetch(url).then((r) => r.status), resource)).toBe(503);
});

test('another account cannot inspect or delete the original queue after a reload', async ({ page, request }) => {
  await page.evaluate(() => window.offlineHarness.add());
  await request.get('/control?user=synthetic-b');
  await page.evaluate(async (url) => {
    await fetch(url);
    window.offlineHarness.setUser('synthetic-b');
  }, session);
  expect(await page.evaluate(() => window.offlineHarness.queue())).toEqual([]);
  expect(await page.evaluate(() => window.offlineHarness.message('clearOfflineDownloads'))).toMatchObject({
    success: false,
  });
  await request.get('/control');
  await page.evaluate((url) => fetch(url), session);
  await page.reload();
  expect(await page.evaluate(() => window.offlineHarness.queue().then((items) => items.length))).toBe(4);
});
