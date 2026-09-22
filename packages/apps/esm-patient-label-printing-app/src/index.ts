import { defineConfigSchema, getAsyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';

const moduleName = '@sihsalus/esm-patient-label-printing-app';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const printPatientIdentityModal = getAsyncLifecycle(
  () => import('./print-identifier-sticker/print-patient-identity.modal'),
  { featureName: 'print-patient-identity', moduleName },
);

export const printIdentifierStickerActionButton = getAsyncLifecycle(
  () => import('./print-identifier-sticker/print-identifier-sticker-action-button.component'),
  {
    featureName: 'patient-actions-slot-print-identifier-sticker-button',
    moduleName,
  },
);
