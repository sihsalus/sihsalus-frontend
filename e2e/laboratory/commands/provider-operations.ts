import { type APIRequestContext, expect } from '@playwright/test';
import { type Provider } from './types';

export const getProvider = async (api: APIRequestContext): Promise<Provider> => {
  const sessionRes = await api.get('session?v=custom:(currentProvider:(uuid,display,retired,person:(uuid,display)))');
  expect(sessionRes.ok(), 'The laboratory E2E session must be queryable').toBeTruthy();
  const session = (await sessionRes.json()) as { currentProvider?: (Provider & { retired?: boolean }) | null };
  expect(session.currentProvider?.uuid, 'The laboratory E2E account must have a provider').toBeTruthy();
  expect(session.currentProvider?.retired ?? false, 'The laboratory E2E provider must be active').toBe(false);
  if (!session.currentProvider?.uuid) {
    throw new Error('The laboratory E2E account must have a provider.');
  }

  return session.currentProvider;
};
