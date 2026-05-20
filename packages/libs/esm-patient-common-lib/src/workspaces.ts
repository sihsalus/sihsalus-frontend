import { getGroupByWindowName, getWindowByWorkspaceName, workspace2Store } from '@openmrs/esm-extensions';
import { getGlobalStore, navigate, showModal, useFeatureFlag, type Visit } from '@openmrs/esm-framework';
import {
  closeWorkspace,
  closeWorkspaceGroup2,
  type DefaultWorkspaceProps,
  getRegisteredWorkspace2Names,
  launchWorkspace,
  launchWorkspace2,
  navigateAndLaunchWorkspace,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-styleguide';
import { useCallback } from 'react';

import { launchStartVisitPrompt } from './launchStartVisitPrompt';
import { useVisitOrOfflineVisit } from './offline/visit';
import { getPatientChartStore, getPatientUuidFromStore, usePatientChartStore } from './store/patient-chart-store';
import { useSystemVisitSetting } from './useSystemVisitSetting';

export interface DefaultPatientWorkspaceProps extends DefaultWorkspaceProps {
  patientUuid: string;
}

export interface PatientWorkspaceGroupProps {
  patient: fhir.Patient | null;
  patientUuid: string;
  visitContext: Visit | null;
  mutateVisitContext: (() => void) | null;
}

export interface PatientChartWorkspaceActionButtonProps {
  groupProps: PatientWorkspaceGroupProps;
}

export type PatientWorkspace2DefinitionProps<
  WorkspaceProps extends object,
  WindowProps extends object,
> = Workspace2DefinitionProps<WorkspaceProps, WindowProps, PatientWorkspaceGroupProps>;

const legacyFirstPatientChartWorkspaces = new Set<string>([
  'start-visit-workspace-form',
  'mark-patient-deceased-workspace-form',
  'patient-vitals-biometrics-form-workspace',
  'conditions-form-workspace',
  'patient-allergy-form-workspace',
  'visit-notes-form-workspace',
  'clinical-forms-workspace',
  'patient-form-entry-workspace',
  'patient-html-form-entry-workspace',
  'order-basket',
  'patient-orders-form-workspace',
  'test-results-form-workspace',
  'orderable-concept-workspace',
  'add-radiology-order',
  'add-immunization-order',
  'add-referral-order',
  'appointments-form-workspace',
]);

const patientChartLegacyWorkspaceGroups = new Map<string, string>([
  ['clinical-forms-workspace', 'clinical-forms'],
  ['patient-form-entry-workspace', 'clinical-forms'],
  ['patient-html-form-entry-workspace', 'clinical-forms'],
  ['order-basket', 'orders'],
  ['orderable-concept-workspace', 'orders'],
  ['patient-orders-form-workspace', 'orders'],
  ['test-results-form-workspace', 'orders'],
  ['fua-encounter-workspace', 'fua'],
  ['fua-viewer-workspace', 'fua'],
]);

const exclusivePatientChartLegacyWorkspaceGroups = new Set(['clinical-forms', 'orders', 'fua']);

function isWorkspace2Registered(workspaceName: string): boolean {
  return getRegisteredWorkspace2Names().includes(workspaceName);
}

function getPatientWorkspaceGroupProps(): PatientWorkspaceGroupProps | null {
  const workspace2State = workspace2Store.getState();
  if (workspace2State.openedGroup?.groupName === 'patient-chart') {
    return workspace2State.openedGroup.props as PatientWorkspaceGroupProps | null;
  }

  const { patientUuid, patient, visitContext, mutateVisitContext } = getPatientChartStore().getState();

  if (!patientUuid) {
    return null;
  }

  return {
    patient,
    patientUuid,
    visitContext,
    mutateVisitContext,
  };
}

function isPatientChartWorkspace2(workspaceName: string): boolean {
  const windowDefinition = getWindowByWorkspaceName(workspaceName);
  if (!windowDefinition) {
    return false;
  }

  return getGroupByWindowName(windowDefinition.name)?.name === 'patient-chart';
}

interface LegacyWorkspaceStoreState {
  openWorkspaces?: Array<{ name: string }>;
}

function closeOpenLegacyWorkspaces(): boolean {
  const workspaceStore = getGlobalStore<LegacyWorkspaceStoreState>('workspace');
  const openWorkspaces = workspaceStore.getState().openWorkspaces ?? [];

  if (!openWorkspaces.length) {
    return true;
  }

  return openWorkspaces.every((workspace, index) =>
    closeWorkspace(workspace.name, {
      closeWorkspaceGroup: index === openWorkspaces.length - 1,
    }),
  );
}

function closeLegacyPatientChartWorkspaceGroup(workspaceName: string): boolean {
  const targetGroup = patientChartLegacyWorkspaceGroups.get(workspaceName);

  if (!targetGroup || !exclusivePatientChartLegacyWorkspaceGroups.has(targetGroup)) {
    return true;
  }

  const workspaceStore = getGlobalStore<LegacyWorkspaceStoreState>('workspace');
  const openWorkspaces = workspaceStore
    .getState()
    .openWorkspaces?.filter(
      (workspace) =>
        patientChartLegacyWorkspaceGroups.get(workspace.name) != null &&
        patientChartLegacyWorkspaceGroups.get(workspace.name) !== targetGroup,
    );

  if (!openWorkspaces?.length) {
    return true;
  }

  return openWorkspaces.every((workspace, index) =>
    closeWorkspace(workspace.name, {
      closeWorkspaceGroup: index === openWorkspaces.length - 1,
    }),
  );
}

export function launchPatientWorkspace(workspaceName: string, additionalProps?: object): void {
  const patientUuid = getPatientUuidFromStore();
  const shouldPreferLegacyWorkspace = legacyFirstPatientChartWorkspaces.has(workspaceName);
  const workspace2Registered = !shouldPreferLegacyWorkspace && isWorkspace2Registered(workspaceName);
  const patientChartWorkspace2 = workspace2Registered && isPatientChartWorkspace2(workspaceName);

  if (workspace2Registered && patientChartWorkspace2) {
    if (closeOpenLegacyWorkspaces()) {
      void launchWorkspace2(workspaceName, additionalProps ?? null, null, getPatientWorkspaceGroupProps());
    }
    return;
  }

  void closeWorkspaceGroup2().then((isClosed) => {
    if (!isClosed || !closeLegacyPatientChartWorkspaceGroup(workspaceName)) {
      return;
    }

    launchWorkspace(workspaceName, {
      patientUuid,
      ...additionalProps,
    });
  });
}

export function launchPatientChartWithWorkspaceOpen({
  patientUuid,
  workspaceName,
  dashboardName,
  additionalProps,
}: {
  patientUuid: string;
  workspaceName: string;
  dashboardName?: string;
  additionalProps?: object;
}): void {
  // Keep legacy workspace launching for callers that still target the v9-style
  // workspace contract while exposing Workspace2 helpers alongside it.
  navigateAndLaunchWorkspace({
    targetUrl: '${openmrsSpaBase}/patient/' + `${patientUuid}/chart` + (dashboardName ? `/${dashboardName}` : ''),
    workspaceName,
    contextKey: `patient/${patientUuid}`,
    additionalProps,
  });
}

export function useStartVisitIfNeeded(patientUuid?: string): () => Promise<boolean> {
  const store = usePatientChartStore(patientUuid);
  const { systemVisitEnabled } = useSystemVisitSetting();
  const isRdeEnabled = useFeatureFlag('rde');

  const startVisitIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!systemVisitEnabled || store.visitContext) {
      return true;
    }

    if (!patientUuid) {
      launchStartVisitPrompt();
      return false;
    }

    return new Promise<boolean>((resolve) => {
      if (isRdeEnabled) {
        const dispose = showModal('visit-context-switcher', {
          patientUuid,
          closeModal: () => {
            dispose();
            resolve(false);
          },
          onAfterVisitSelected: () => {
            dispose();
            resolve(true);
          },
          size: 'sm',
        });
      } else {
        const dispose = showModal('start-visit-dialog', {
          closeModal: () => {
            dispose();
            resolve(false);
          },
          onVisitStarted: () => {
            dispose();
            resolve(true);
          },
        });
      }
    });
  }, [isRdeEnabled, patientUuid, store.visitContext, systemVisitEnabled]);

  return startVisitIfNeeded;
}

export function useLaunchWorkspaceRequiringVisit<T extends object>(
  patientUuid: string,
  workspaceName: string,
): (workspaceProps?: T, windowProps?: object, groupProps?: object) => void;
export function useLaunchWorkspaceRequiringVisit<T extends object>(
  workspaceName: string,
): (additionalProps?: T) => void;
export function useLaunchWorkspaceRequiringVisit<T extends object>(
  patientUuidOrWorkspaceName: string,
  maybeWorkspaceName?: string,
): (workspaceProps?: T, windowProps?: object, groupProps?: object) => void {
  const workspaceName = maybeWorkspaceName ?? patientUuidOrWorkspaceName;
  const patientUuid = maybeWorkspaceName ? patientUuidOrWorkspaceName : null;
  const { patientUuid: storedPatientUuid } = usePatientChartStore(patientUuid ?? undefined);
  const { systemVisitEnabled } = useSystemVisitSetting();
  const activePatientUuid = patientUuid ?? storedPatientUuid ?? '';
  const { currentVisit } = useVisitOrOfflineVisit(activePatientUuid);
  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid ?? undefined);

  return useCallback(
    (workspaceProps?: T, windowProps?: object, groupProps?: object): void => {
      if (patientUuid) {
        const patientChartGroupProps = groupProps ?? getPatientWorkspaceGroupProps();
        void startVisitIfNeeded().then((didStartVisit) => {
          if (didStartVisit) {
            void launchWorkspace2(workspaceName, workspaceProps ?? null, windowProps ?? null, patientChartGroupProps);
          }
        });
        return;
      }

      if (!systemVisitEnabled || currentVisit) {
        launchPatientWorkspace(workspaceName, workspaceProps);
      } else {
        launchStartVisitPrompt();
      }
    },
    [currentVisit, patientUuid, startVisitIfNeeded, systemVisitEnabled, workspaceName],
  );
}

export function launchPatientChartWithWorkspaceOpen2({
  patientUuid,
  workspaceName,
  dashboardName,
  additionalProps,
}: {
  patientUuid: string;
  workspaceName: string;
  dashboardName?: string;
  additionalProps?: object;
}): void {
  void launchWorkspace2(workspaceName, additionalProps);
  navigate({ to: '${openmrsSpaBase}/patient/' + `${patientUuid}/chart` + (dashboardName ? `/${dashboardName}` : '') });
}
