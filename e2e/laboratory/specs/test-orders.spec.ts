import { expect } from '@playwright/test';
import { getSpaUrl } from '../../utils/e2e-urls';
import { createEncounter, generateRandomTestOrder, getProvider } from '../commands';
import { type Encounter, type Order, type Provider } from '../commands/types';
import { test } from '../core';
import { LaboratoryPage } from '../pages';

let testOrder: Order;
let encounter: Encounter;
let orderer: Provider;
let fullName: string;
let testName: string;

test.beforeEach(async ({ api, patient, visit }) => {
  orderer = await getProvider(api);
  encounter = await createEncounter(api, patient.uuid, orderer.uuid, visit);
  testOrder = await generateRandomTestOrder(api, patient.uuid, encounter, orderer.uuid);
  fullName = patient.person?.display;
  testName = testOrder.concept.display?.trim() ?? '';
  expect(testName, 'The created laboratory order must identify its test').not.toBe('');
});

test('View test orders', async ({ page }) => {
  const laboratoryPage = new LaboratoryPage(page);

  await test.step('Given I navigate to the laboratory page', async () => {
    await laboratoryPage.goTo();
    await expect(page).toHaveURL(getSpaUrl('home/laboratory'));
  });

  await test.step('Then I should see the Tests ordered tab', async () => {
    await expect(page.getByRole('tab', { name: 'Tests ordered' })).toBeVisible();
  });

  await test.step('And I should see the patient in the orders list', async () => {
    await expect(laboratoryPage.getPatientRow(fullName)).toBeVisible();
  });

  await test.step('When I expand the patient row', async () => {
    await laboratoryPage.expandPatientRow(fullName);
  });

  await test.step('Then I should see the order status, test name, and urgency', async () => {
    await expect(page.getByText(/Status:Order not picked/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: testName, exact: true })).toBeVisible();
    await expect(page.getByText(/Rutina|Routine/i)).toBeVisible();
  });
});
