import { type APIRequestContext, test as base, type Page } from '@playwright/test';
import { type Patient, type Visit } from '../commands/types';
import { api } from '../fixtures';
import { type LaboratoryFixture, withLaboratoryFixture } from './synthetic-fixtures';

// This file sets up our custom test harness using the custom fixtures.
// See https://playwright.dev/docs/test-fixtures#creating-a-fixture for details.
// If a spec intends to use one of the custom fixtures, the special `test` function
// exported from this file must be used instead of the default `test` function
// provided by playwright.

export interface CustomTestFixtures {
  loginAsAdmin: Page;
  patient: Patient;
  visit: Visit;
  laboratoryFixture: LaboratoryFixture;
}

export interface CustomWorkerFixtures {
  api: APIRequestContext;
}

export const test = base.extend<CustomTestFixtures, CustomWorkerFixtures>({
  api: [api, { scope: 'worker' }],
  laboratoryFixture: [
    async ({ api }, use, testInfo) => withLaboratoryFixture(api, testInfo, use),
    { scope: 'test', auto: true },
  ],
  patient: async ({ laboratoryFixture }, use) => use(laboratoryFixture.patient),
  visit: async ({ laboratoryFixture }, use) => use(laboratoryFixture.visit),
});
