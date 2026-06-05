import type { DashboardLinkConfig } from '@openmrs/esm-patient-common-lib';
import { moduleName } from './constants';

export const dashboardMeta: DashboardLinkConfig & { slot: string } = {
  moduleName,
  slot: 'patient-chart-clinical-procedures-dashboard-slot',
  path: 'procedures',
  title: 'Procedimientos clínicos',
  icon: 'omrs-icon-procedure-order',
};
