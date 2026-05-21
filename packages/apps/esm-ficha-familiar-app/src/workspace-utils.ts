import { launchWorkspace } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';

export type FichaFamiliarWorkspaceProps = {
  patientUuid?: string;
  relationShipUuid?: string;
  workspaceTitle?: string;
  [key: string]: unknown;
};

export type FichaFamiliarWorkspaceComponentProps = FichaFamiliarWorkspaceProps & {
  closeWorkspace: () => void | Promise<boolean>;
  closeWorkspaceWithSavedChanges?: () => void;
  groupProps?: { patientUuid?: string } | null;
  promptBeforeClosing?: (testFcn: () => boolean) => void;
  workspaceProps?: FichaFamiliarWorkspaceProps | null;
};

export function launchFichaFamiliarWorkspace(workspaceName: string, props?: FichaFamiliarWorkspaceProps) {
  try {
    launchPatientWorkspace(workspaceName, props);
  } catch (error) {
    void error;
    launchWorkspace(workspaceName, props);
  }
}
