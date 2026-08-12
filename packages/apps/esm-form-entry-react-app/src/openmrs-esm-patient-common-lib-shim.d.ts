declare module '@openmrs/esm-patient-common-lib' {
  import type { DefaultWorkspaceProps, Encounter, Visit } from '@openmrs/esm-framework';
  import type { OpenmrsEncounter } from '@sihsalus/esm-form-engine-lib';

  export interface FormRendererProps {
    additionalProps?: Record<string, unknown>;
    encounterUuid?: string;
    formUuid: string;
    patientUuid: string;
    patient: fhir.Patient;
    visit?: Visit;
    visitUuid?: string;
    hideControls?: boolean;
    hidePatientBanner?: boolean;
    handlePostResponse?: (encounter?: Encounter) => void;
    handleEncounterCreate?: (encounter: OpenmrsEncounter) => OpenmrsEncounter | void | Promise<OpenmrsEncounter | void>;
    onBeforeEncounterSave?: (encounter: OpenmrsEncounter) => void | Promise<void>;
    handleOnValidate?: (valid: boolean) => void;
    showDiscardSubmitButtons?: boolean;
    preFilledQuestions?: Record<string, unknown>;
    closeWorkspace?: DefaultWorkspaceProps['closeWorkspace'];
    closeWorkspaceWithSavedChanges?: () => void;
    setHasUnsavedChanges?: (hasUnsavedChanges: boolean) => void;
  }

  export const clinicalFormsWorkspace: string;
  export function launchPatientWorkspace(workspaceName: string, options?: Record<string, unknown>): Promise<void>;
}
