import { defineConfigSchema, getAsyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';
import { getFixedT } from 'i18next';

import { configSchema } from './config-schema';
import { basePath, moduleName } from './constants';

const options = {
  featureName: 'reports',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  const t = getFixedT(undefined, moduleName);

  registerBreadcrumbs([
    {
      title: 'Home',
      path: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`,
    },
    {
      path: `${globalThis.getOpenmrsSpaBase()}system-administration`,
      title: () => Promise.resolve(t('systemAdmin', 'System Administration')),
      parent: `${globalThis.getOpenmrsSpaBase()}home`,
    },
    {
      title: () => Promise.resolve(t('reports', 'Reports')),
      path: `${globalThis.getOpenmrsSpaBase()}reports`,
      parent: `${globalThis.getOpenmrsSpaBase()}system-administration`,
    },
    {
      title: () => Promise.resolve(t('scheduledReports', 'Scheduled Reports')),
      path: `${globalThis.getOpenmrsSpaBase()}reports/scheduled-overview`,
      parent: `${globalThis.getOpenmrsSpaBase()}reports`,
    },
    {
      title: () => Promise.resolve(t('reportsDataOverview', 'Reports Data Overview')),
      path: `${globalThis.getOpenmrsSpaBase()}reports/reports-data-overview`,
      parent: `${globalThis.getOpenmrsSpaBase()}reports`,
    },
  ]);
  defineConfigSchema(moduleName, configSchema);
}

export const root = getAsyncLifecycle(() => import('./reports.component'), options);

export const reportsLink = getAsyncLifecycle(() => import('./reports-link'), options);

export const overview = getAsyncLifecycle(() => import('./components/overview.component'), options);

export const scheduledOverview = getAsyncLifecycle(() => import('./components/scheduled-overview.component'), options);

export const runReport = getAsyncLifecycle(() => import('./components/run-report/run-report-form.component'), options);

export const reportsAppMenuLink = getAsyncLifecycle(() => import('./reports-app-menu-link.component'), options);

export const reportsAppMenuItem = getAsyncLifecycle(() => import('./reports-app-menu-item.component'), options);

export const cancelReportModal = getAsyncLifecycle(
  () => import('./components/run-report/cancel-report-modal.component'),
  options,
);
