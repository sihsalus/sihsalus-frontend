import { expect } from '@playwright/test';
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

test('Reject a lab request', async ({ page }) => {
  const laboratoryPage = new LaboratoryPage(page);

  await test.step('Given I navigate to the laboratory page', async () => {
    await laboratoryPage.goTo();
    await expect(page.getByRole('tab', { name: 'Tests ordered' })).toBeVisible();
  });

  await test.step('When I expand the patient row', async () => {
    await laboratoryPage.expandPatientRow(fullName);
  });

  await test.step('Then I should see the test order', async () => {
    await expect(page.getByRole('cell', { name: testName, exact: true })).toBeVisible();
  });

  await test.step('When I click the Reject Lab Request button', async () => {
    await page.getByRole('button', { name: 'Reject Lab Request' }).first().click();
  });

  await test.step('Then I should see the rejection modal with the test type', async () => {
    await expect(page.getByRole('heading', { name: /Reject lab request/ })).toBeVisible();
    await expect(page.getByText(/Test type:/i)).toBeVisible();
  });

  await test.step('When I enter a rejection comment and confirm', async () => {
    await page.getByRole('textbox', { name: 'Fulfiller comment' }).fill('Sample was contaminated');
    await page.getByRole('button', { name: 'danger Reject', exact: true }).click();
  });

  await test.step('Then I should see a success notification', async () => {
    await expect(page.getByText(/Lab request rejected/i)).toBeVisible();
  });

  await test.step('When I navigate to the Declined tests tab', async () => {
    await laboratoryPage.navigateToTab('Declined tests');
  });

  await test.step('And I expand the patient row', async () => {
    await laboratoryPage.expandPatientRow(fullName);
  });

  await test.step('Then I should see the order with Declined status', async () => {
    await expect(page.getByRole('cell', { name: testName, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Declined' })).toBeVisible();
  });
});
