import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { basePath, moduleName } from './constants';
import CareLogbookAppMenuLink from './links/care-logbook-app-menu-link.component';
import CareLogbookDashboardLink from './links/care-logbook-dashboard-link.component';
import CareLogbookMergePatientsAction from './links/care-logbook-merge-patients-action.component';
import Root from './root.component';

const options = {
  featureName: 'care-logbook',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);

  registerBreadcrumbs([
    {
      path: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`,
      title: () =>
        Promise.resolve(
          globalThis.i18next.t('admission', {
            defaultValue: 'Care logbook',
            ns: moduleName,
          }),
        ),
      parent: `${globalThis.spaBase}/home`,
    },
    {
      path: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}/merge`,
      title: () =>
        Promise.resolve(
          globalThis.i18next.t('mergeDuplicatePatientRecords', {
            defaultValue: 'Merge duplicate patient records',
            ns: moduleName,
          }),
        ),
      parent: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`,
    },
  ]);
}

export const root = getSyncLifecycle(Root, options);

export const careLogbookAppMenuLink = getSyncLifecycle(CareLogbookAppMenuLink, options);

export const careLogbookHomeDashboard = getAsyncLifecycle(() => import('./pages/admission-home.component'), options);

export const careLogbookHomeDashboardLink = getSyncLifecycle(CareLogbookDashboardLink, options);

export const careLogbookMergePatientsAction = getSyncLifecycle(CareLogbookMergePatientsAction, options);

export const patientMerge = getAsyncLifecycle(() => import('./pages/patient-merge.component'), options);
