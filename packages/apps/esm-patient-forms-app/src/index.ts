import {
  defineConfigSchema,
  getAsyncLifecycle,
  getSyncLifecycle,
  subscribePrecacheStaticDependencies,
  syncAllDynamicOfflineData,
} from '@openmrs/esm-framework';

import clinicalFormActionMenuComponent from './clinical-form-action-menu.component';
import { configSchema } from './config-schema';
import { setupDynamicFormDataHandler, setupPatientFormSync } from './offline';
import OfflineForms from './offline-forms/offline-forms.component';
import OfflineToolsNavLink from './offline-forms/offline-tools-nav-link.component';

const moduleName = '@sihsalus/esm-patient-forms-app';

const options = {
  featureName: 'patient-forms',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const startupKey = Symbol.for('sihsalus.esm-patient-forms-app.startup-complete');

export function startupApp() {
  const globalScope = globalThis as typeof globalThis & { [startupKey]?: boolean };
  if (globalScope[startupKey]) {
    return;
  }

  globalScope[startupKey] = true;

  defineConfigSchema(moduleName, configSchema);

  setupPatientFormSync();
  setupDynamicFormDataHandler();
  subscribePrecacheStaticDependencies(() => syncAllDynamicOfflineData('form'));
}

// t('clinicalForm', 'Clinical form')
export const patientFormEntryWorkspace = getAsyncLifecycle(() => import('./forms/form-entry.workspace'), options);

export const patientHtmlFormEntryWorkspace = getAsyncLifecycle(
  () => import('./htmlformentry/html-form-entry.workspace'),
  options,
);

export const clinicalFormsWorkspace = getAsyncLifecycle(() => import('./forms/forms-dashboard.workspace'), options);
export const clinicalFormsWorkspaceExtension = getAsyncLifecycle(
  () => import('./forms/forms-dashboard.workspace'),
  options,
);

export const clinicalFormActionMenu = getSyncLifecycle(clinicalFormActionMenuComponent, options);

export const clinicalFormActionButton = getAsyncLifecycle(
  () => import('./clinical-form-action-button.component'),
  options,
);

export const offlineFormOverviewCard = getAsyncLifecycle(
  () => import('./offline-forms/offline-forms-overview-card.component'),
  options,
);

export const offlineFormsNavLink = getSyncLifecycle(
  () =>
    OfflineToolsNavLink({
      page: 'forms',
      title: 'offlineForms',
    }),
  options,
);

export const offlineForms = getSyncLifecycle(OfflineForms, options);
