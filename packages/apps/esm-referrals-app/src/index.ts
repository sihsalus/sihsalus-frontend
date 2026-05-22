import { defineConfigSchema, getAsyncLifecycle } from '@openmrs/esm-framework';

import { configSchema } from './config-schema';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-referrals-app';
const options = {
  featureName: 'referrals',
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

export const referralsRoot = getAsyncLifecycle(() => import('./referrals-root.component'), options);
export const referralsAppMenuLink = getAsyncLifecycle(() => import('./referrals-app-menu-link.component'), options);
export const referralsAppMenuItem = getAsyncLifecycle(() => import('./referrals-app-menu-item.component'), options);
export const referralReasonsDialogPopup = getAsyncLifecycle(() => import('./referral-reasons.modal'), options);
export const facilityReferralForm = getAsyncLifecycle(() => import('./facility-referral.workspace'), options);
