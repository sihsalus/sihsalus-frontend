import {
  defineConfigSchema,
  getAsyncLifecycle,
  getSyncLifecycle,
  registerBreadcrumbs,
  registerFeatureFlag,
} from '@openmrs/esm-framework';

import addPatientLinkComponent from './add-patient-link.extension';
import { esmPatientRegistrationSchema } from './config-schema';
import { externalIdentityLookupsFlag, moduleName, patientRegistration } from './constants';
import { setupOffline } from './offline';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const options = {
  featureName: 'Patient Registration',
  moduleName,
};

export function startupApp() {
  defineConfigSchema(moduleName, esmPatientRegistrationSchema);

  registerFeatureFlag(
    externalIdentityLookupsFlag,
    'Consultas externas RENIEC/SIS',
    'Muestra los botones de consulta a RENIEC y SIS en el formulario de registro de pacientes. Permanecen ocultos mientras esté desactivado.',
  );

  registerBreadcrumbs([
    {
      path: `${globalThis.spaBase}/${patientRegistration}`,
      // t('patientRegistrationBreadcrumb', 'Patient Registration')
      title: () =>
        Promise.resolve(
          globalThis.i18next.t('patientRegistrationBreadcrumb', {
            defaultValue: 'Patient Registration',
            ns: moduleName,
          }),
        ),
      parent: `${globalThis.spaBase}/home`,
    },
    {
      path: `${globalThis.spaBase}/patient/:patientUuid/edit`,
      // t('editPatientDetailsBreadcrumb', 'Edit patient details')
      title: () =>
        Promise.resolve(
          globalThis.i18next.t('editPatientDetailsBreadcrumb', {
            defaultValue: 'Edit patient details',
            ns: moduleName,
          }),
        ),
      parent: `${globalThis.spaBase}/patient/:patientUuid/chart`,
    },
  ]);

  setupOffline();
}

export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const editPatient = getAsyncLifecycle(() => import('./root.component'), options);

export const addPatientLink = getSyncLifecycle(addPatientLinkComponent, options);

export const cancelPatientEditModal = getAsyncLifecycle(() => import('./widgets/cancel-patient-edit.modal'), options);

export const patientPhotoExtension = getAsyncLifecycle(() => import('./patient-photo.extension'), options);

export const editPatientDetailsButton = getAsyncLifecycle(
  () => import('./widgets/edit-patient-details-button.component'),
  options,
);

export const deleteIdentifierConfirmationModal = getAsyncLifecycle(
  () => import('./widgets/delete-identifier-confirmation.modal'),
  options,
);
