import { showSnackbar, subscribePrecacheStaticDependencies, syncAllDynamicOfflineData } from '@openmrs/esm-framework';

import { serializeOfflineFormOperation } from './offline-form-membership';

const moduleName = '@sihsalus/esm-patient-forms-app';

function translate(key: string, defaultValue: string): string {
  return globalThis.i18next?.t?.(key, { defaultValue, ns: moduleName }) ?? defaultValue;
}

export function setupOfflineFormPrecache(): void {
  subscribePrecacheStaticDependencies(() => {
    void serializeOfflineFormOperation(() => syncAllDynamicOfflineData('form')).catch(() => {
      showSnackbar({
        kind: 'error',
        title: translate('offlineFormsRefreshFailed', 'Offline forms could not be refreshed'),
        subtitle: translate(
          'offlineFormsRefreshFailedSubtitle',
          'Some previously downloaded forms may be out of date. Please try again when online.',
        ),
      });
    });
  });
}
