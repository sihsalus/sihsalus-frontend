import { type APIRequestContext, expect } from '@playwright/test';
import { type Provider } from './types';

export const getProvider = async (api: APIRequestContext): Promise<Provider> => {
  const providerQuery = process.env.E2E_PROVIDER_QUERY?.trim();
  if (!providerQuery) throw new Error('E2E_PROVIDER_QUERY must identify a synthetic test provider.');
  const providerRes = await api.get(`provider?q=${encodeURIComponent(providerQuery)}`);
  expect(providerRes.ok()).toBeTruthy();
  const { results } = await providerRes.json();
  return await results[0];
};
