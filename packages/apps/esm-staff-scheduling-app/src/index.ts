import { getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import StaffSchedulingAppMenuItem from './staff-scheduling-app-menu-item.component';

const moduleName = '@sihsalus/esm-staff-scheduling-app';

const options = {
  featureName: 'staff-scheduling',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export const staffSchedulingAppMenuItem = getSyncLifecycle(StaffSchedulingAppMenuItem, options);

export const staffSchedulingPage = getAsyncLifecycle(() => import('./staff-scheduling.component'), options);
