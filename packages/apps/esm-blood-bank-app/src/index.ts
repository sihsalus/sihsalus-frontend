import { defineConfigSchema, getSyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';

import AppMenuLink from './app-menu-link.component';
import { configSchema } from './config-schema';
import { basePath, featureName, moduleName } from './constants';
import BloodBankHomeDashboardLink from './home-redirect/blood-bank-home-dashboard-link.extension';
import BloodBankHomeRedirect from './home-redirect/blood-bank-home-redirect.extension';
import BloodBankNav from './navigation/blood-bank-nav.extension';
import Root from './root.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const options = { featureName, moduleName };

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
  registerBreadcrumbs([
    {
      path: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`,
      title: () => Promise.resolve(globalThis.i18next.t('appTitle', { defaultValue: 'Banco de Sangre', ns: moduleName })),
      parent: `${globalThis.spaBase}/home`,
    },
  ]);
}

export const root = getSyncLifecycle(Root, options);
export const bloodBankAppMenuLink = getSyncLifecycle(AppMenuLink, options);
export const bloodBankNav = getSyncLifecycle(BloodBankNav, options);
export const bloodBankHomeDashboardLink = getSyncLifecycle(BloodBankHomeDashboardLink, options);
export const bloodBankHomeRedirect = getSyncLifecycle(BloodBankHomeRedirect, options);
