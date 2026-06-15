import { showSnackbar, type Visit } from '@openmrs/esm-framework';
import { getPatientChartStore, launchPatientWorkspace, launchStartVisitPrompt } from '@openmrs/esm-patient-common-lib';

import { invalidateCachedVitalsAndBiometrics } from './common';
import { type ConfigObject } from './config-schema';
import { patientVitalsBiometricsFormWorkspace } from './constants';

/**
 * Launches the for entry workspace with the custom form
 *
 * @param formUuid The form to use
 * @param encounterUuid The current encounter, if any
 * @param formName The name of the form to use
 */
export function launchFormEntry(
  formUuid: string,
  encounterUuid?: string,
  formName?: string,
  formEntryWorkspaceName = 'patient-form-entry-workspace',
) {
  launchPatientWorkspace(formEntryWorkspaceName, {
    workspaceTitle: formName,
    formInfo: { formUuid, encounterUuid },
    mutateForm: invalidateCachedVitalsAndBiometrics,
  });
}

/**
 * Launches the appropriate workspace based on the current visit and configuration.
 * @param currentVisit - The current visit.
 * @param config - The configuration object.
 */
interface LaunchVitalsAndBiometricsFormOptions {
  workspaceErrorMessage?: string;
}

export function launchVitalsAndBiometricsForm(
  currentVisit: Visit | null | undefined,
  config: ConfigObject,
  options: LaunchVitalsAndBiometricsFormOptions = {},
) {
  try {
    const patientChartVisit = getPatientChartStore().getState().visitContext;
    const activeVisit = currentVisit ?? patientChartVisit;

    if (config.vitals.useFormEngine) {
      if (!activeVisit || activeVisit.stopDatetime) {
        launchStartVisitPrompt();
        return;
      }

      const { formUuid, formName, formEntryWorkspaceName } = config.vitals;
      launchFormEntry(formUuid, '', formName, formEntryWorkspaceName);
    } else {
      launchPatientWorkspace(patientVitalsBiometricsFormWorkspace);
    }
  } catch (error) {
    showSnackbar({
      kind: 'error',
      title:
        options.workspaceErrorMessage ??
        'The vitals and biometrics form is not available. Please contact the system administrator.',
    });
    console.error('Error launching vitals and biometrics workspace:', error);
  }
}
