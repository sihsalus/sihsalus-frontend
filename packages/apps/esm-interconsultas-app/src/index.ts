import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import { configSchema } from './config-schema';
import { createHomeDashboardLink } from './dashboard-link.component';
import rootComponent from './root.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-interconsultas-app';
const options = {
  featureName: 'interconsultas',
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// Página/bandeja global
export const root = getSyncLifecycle(rootComponent, options);

// t('interconsultas', 'Interconsultas')
export const interconsultasDashboardLink = getSyncLifecycle(
  createHomeDashboardLink({
    name: 'interconsultas',
    title: 'interconsultas',
  }),
  options,
);

// Chart del paciente
const interconsultasChartDashboardMeta = {
  slot: 'patient-chart-interconsultas-slot',
  columns: 1,
  title: 'Interconsultas',
  path: 'interconsultas',
  icon: 'omrs-icon-referral-order',
  isLink: true,
};

export const interconsultasChartDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...interconsultasChartDashboardMeta, moduleName }),
  options,
);

export const interconsultasChartWidget = getAsyncLifecycle(
  () => import('./chart/interconsultas-chart-widget.component'),
  options,
);

export const requestInterconsultaActionButton = getAsyncLifecycle(
  () => import('./request/request-interconsulta-action-button.component'),
  options,
);

export const requestInterconsultaWorkspace = getAsyncLifecycle(
  () => import('./request/request-interconsulta.workspace'),
  options,
);

// Modales de la bandeja
export const receiveInterconsultaModal = getAsyncLifecycle(
  () => import('./modals/receive-interconsulta.modal'),
  options,
);

export const pickupInterconsultaModal = getAsyncLifecycle(() => import('./modals/pickup-interconsulta.modal'), options);

export const rejectInterconsultaModal = getAsyncLifecycle(() => import('./modals/reject-interconsulta.modal'), options);

export const respondInterconsultaModal = getAsyncLifecycle(
  () => import('./modals/respond-interconsulta.modal'),
  options,
);

export const interconsultaDetailModal = getAsyncLifecycle(() => import('./modals/interconsulta-detail.modal'), options);
