import { Renew, UserMultiple } from '@carbon/react/icons';
import { defineConfigSchema, getSyncLifecycle, registerBreadcrumbs } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib/src/dashboards/createDashboardLink';

import offlineToolsConfirmationModalComponent from './components/confirmation.modal';
import { routes } from './constants';
import { dashboardMeta } from './dashboard.meta';
import OfflineToolsNavLink from './nav/offline-tools-nav-link.component';
import offlineToolsNavItemsComponent from './nav/offline-tools-nav-menu.component';
import { setupOffline } from './offline';
import offlineToolsActionsComponent from './offline-actions/offline-actions.component';
import offlineToolsOptInButtonComponent from './offline-actions/offline-actions-mode-button.extension';
import offlineToolsActionsCardComponent from './offline-actions/offline-actions-overview-card.component';
import offlineToolsPageActionsComponent from './offline-actions/offline-actions-page.component';
import offlineToolsPatientChartComponent from './offline-actions/offline-actions-patient-chart-widget.component';
import { setupSynchronizingOfflineActionsNotifications } from './offline-actions/synchronizing-notification';
import offlineToolsPatientsComponent from './offline-patients/offline-patients.component';
import offlineToolsPatientsCardComponent from './offline-patients/patients-overview-card.component';
import offlineToolsAppMenuItemComponent from './offline-tools-app-menu-item.component';
import offlineToolsLinkComponent from './offline-tools-app-menu-link.component';
import offlineToolsComponent from './root.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-offline-tools-app';
const options = {
  featureName: 'offline-tools',
  moduleName,
};

const startupKey = Symbol.for('sihsalus.esm-offline-tools-app.startup-complete');

export const offlineTools = getSyncLifecycle(offlineToolsComponent, options);

export const offlineToolsLink = getSyncLifecycle(offlineToolsLinkComponent, options);

export const offlineToolsAppMenuItem = getSyncLifecycle(offlineToolsAppMenuItemComponent, options);

export const offlineToolsNavItems = getSyncLifecycle(offlineToolsNavItemsComponent, {
  featureName: 'nav-items',
  moduleName,
});

export const offlineToolsConfirmationModal = getSyncLifecycle(offlineToolsConfirmationModalComponent, options);

export const offlineToolsPatientsCard = getSyncLifecycle(offlineToolsPatientsCardComponent, options);

export const offlineToolsActionsCard = getSyncLifecycle(offlineToolsActionsCardComponent, options);

export const offlineToolsPatientsLink = getSyncLifecycle(
  () =>
    OfflineToolsNavLink({
      icon: UserMultiple,
      page: 'patients',
      title: 'offlinePatients',
    }),
  options,
);

export const offlineToolsActionsLink = getSyncLifecycle(
  () =>
    OfflineToolsNavLink({
      icon: Renew,
      page: 'actions',
      title: 'offlineActions',
    }),
  options,
);

export const offlineToolsActions = getSyncLifecycle(offlineToolsActionsComponent, options);

export const offlineToolsPatients = getSyncLifecycle(offlineToolsPatientsComponent, options);

export const offlineToolsPageActions = getSyncLifecycle(offlineToolsPageActionsComponent, options);

export const offlineToolsPatientChartActions = getSyncLifecycle(offlineToolsPatientChartComponent, options);

export const offlineToolsPatientChartActionsDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...dashboardMeta, moduleName }),
  options,
);

export const offlineToolsOptInButton = getSyncLifecycle(offlineToolsOptInButtonComponent, options);

export function startupApp() {
  const globalScope = globalThis as typeof globalThis & { [startupKey]?: boolean };
  if (globalScope[startupKey]) {
    return;
  }

  globalScope[startupKey] = true;

  defineConfigSchema(moduleName, {});
  setupOffline();
  setupSynchronizingOfflineActionsNotifications();

  registerBreadcrumbs([
    {
      path: `${globalThis.spaBase}/${routes.offlineTools}`,
      title: 'Offline Tools',
      parent: `${globalThis.spaBase}/${routes.home}`,
    },
    {
      path: `${globalThis.spaBase}/${routes.offlineToolsPatients}`,
      title: 'Patients',
      parent: `${globalThis.spaBase}/${routes.offlineTools}`,
    },
    {
      path: `${globalThis.spaBase}/${routes.offlineToolsPatientOfflineData}`,
      title: 'Data',
      parent: `${globalThis.spaBase}/${routes.offlineToolsPatients}`,
    },
    {
      path: `${globalThis.spaBase}/${routes.offlineToolsActions}`,
      title: 'Actions',
      parent: `${globalThis.spaBase}/${routes.offlineTools}`,
    },
  ]);
}
