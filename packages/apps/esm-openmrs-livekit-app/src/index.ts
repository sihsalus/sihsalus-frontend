import { getAsyncLifecycle } from '@openmrs/esm-framework';

const moduleName = '@sihsalus/esm-openmrs-livekit-app';

const options = {
  featureName: 'openmrs-livekit',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const adminCardLink = getAsyncLifecycle(() => import('./openmrs-livekit-admin-card-link.component'), options);
