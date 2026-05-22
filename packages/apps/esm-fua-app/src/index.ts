import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';

import { configSchema } from './config-schema';
import fuaEncounterActionComponent from './fua-encounter-action.component';
import { createLeftPanelLink } from './left-panel-link.component';
import rootComponent from './root.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-fua-app';

const options = {
  featureName: 'fua',
  moduleName,
};

// ================================================================================
// CONFIGURATION
// ================================================================================
export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// ROOT COMPONENT
// ================================================================================
export const root = getSyncLifecycle(rootComponent, options);

// ================================================================================
// DASHBOARD LINK
// ================================================================================
// t('fua', 'FUA')
export const fuaDashboardLink = getSyncLifecycle(
  createLeftPanelLink({
    name: 'fua-request',
    title: 'fua',
  }),
  options,
);

// ================================================================================
// TILES
// ================================================================================
export const allFuaRequestsTile = getAsyncLifecycle(
  () => import('./fua-tiles/all-fua-requests-tile.component'),
  options,
);

export const inProgressFuaRequestsTile = getAsyncLifecycle(
  () => import('./fua-tiles/in-progress-fua-requests-tile.component'),
  options,
);

export const completedFuaRequestsTile = getAsyncLifecycle(
  () => import('./fua-tiles/completed-fua-requests-tile.component'),
  options,
);

export const enviadoFuaRequestsTile = getAsyncLifecycle(
  () => import('./fua-tiles/enviado-fua-requests-tile.component'),
  options,
);

// ================================================================================
// TABLES/TABS
// ================================================================================
export const allFuaRequestsTable = getAsyncLifecycle(
  () => import('./fua-tabs/data-table-extensions/all-fua-requests-table.extension'),
  options,
);

export const inProgressFuaRequestsTable = getAsyncLifecycle(
  () => import('./fua-tabs/data-table-extensions/in-progress-fua-requests-table.extension'),
  options,
);

export const completedFuaRequestsTable = getAsyncLifecycle(
  () => import('./fua-tabs/data-table-extensions/completed-fua-requests-table.extension'),
  options,
);

export const envioFuasTable = getAsyncLifecycle(
  () => import('./fua-tabs/data-table-extensions/envio-fuas-table.extension'),
  options,
);

// ================================================================================
// HTML VIEWER
// ================================================================================
export const fuaHtmlViewer = getAsyncLifecycle(() => import('./components/fua-html-viewer.component'), options);

// ================================================================================
// WORKSPACES
// ================================================================================
export const fuaViewerWorkspace = getAsyncLifecycle(() => import('./workspaces/fua-viewer.workspace'), options);

// t('createFuaWorkspaceTitle', 'Crear FUA')
export const fuaEncounterWorkspace = getAsyncLifecycle(() => import('./workspaces/fua-encounter.workspace'), options);

// ================================================================================
// PATIENT CHART ACTION MENU
// ================================================================================
export const fuaEncounterActionButton = getSyncLifecycle(fuaEncounterActionComponent, options);

// ================================================================================
// FUA VIEWER PAGE
// ================================================================================
export const fuaViewerPage = getAsyncLifecycle(() => import('./fua-viewer-page/fua-viewer-page.component'), options);

// ================================================================================
// MODALS
// ================================================================================
export const changeFuaStatusModal = getAsyncLifecycle(() => import('./modals/change-fua-status.modal'), options);

export const cancelFuaModal = getAsyncLifecycle(() => import('./modals/cancel-fua.modal'), options);

export const fuaHistorialModal = getAsyncLifecycle(() => import('./modals/fua-historial.modal'), options);

// ================================================================================
// PATIENT CHART WIDGET
// ================================================================================
export const fuaPatientWidget = getAsyncLifecycle(() => import('./components/fua-patient-widget.component'), options);
