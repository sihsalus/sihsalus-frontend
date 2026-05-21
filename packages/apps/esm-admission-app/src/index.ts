import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { basePath, moduleName } from './constants';
import AdmissionAppMenuLink from './links/admission-app-menu-link.component';
import AdmissionDashboardLink from './links/admission-dashboard-link.component';
import AdmissionMergePatientsAction from './links/admission-merge-patients-action.component';
import ClinicalIdentitySummary from './patient/clinical-identity-summary.component';
import Root from './root.component';

const options = {
  featureName: 'admission',
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
            defaultValue: 'Care encounters',
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

export const admissionAppMenuLink = getSyncLifecycle(AdmissionAppMenuLink, options);

export const admissionHomeDashboard = getAsyncLifecycle(() => import('./pages/admission-home.component'), options);

export const admissionHomeDashboardLink = getSyncLifecycle(AdmissionDashboardLink, options);

export const admissionMergePatientsAction = getSyncLifecycle(AdmissionMergePatientsAction, options);

export const clinicalIdentitySummary = getSyncLifecycle(ClinicalIdentitySummary, options);

export const patientMerge = getAsyncLifecycle(() => import('./pages/patient-merge.component'), options);
