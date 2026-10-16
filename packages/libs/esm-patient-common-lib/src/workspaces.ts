import {
  getGroupByWindowName,
  getModalRegistration,
  getWindowByWorkspaceName,
  workspace2Store,
} from '@openmrs/esm-extensions';
import { navigate, showModal, useFeatureFlag, type Visit } from '@openmrs/esm-framework';
import {
  type DefaultWorkspaceProps,
  getRegisteredWorkspace2Names,
  launchWorkspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-styleguide';
import { useCallback, useEffect, useMemo } from 'react';

import { launchStartVisitPrompt } from './launchStartVisitPrompt';
import { useVisitOrOfflineVisit } from './offline/visit';
import { getPatientChartStore, getPatientUuidFromStore, usePatientChartStore } from './store/patient-chart-store';
import { useSystemVisitSetting } from './useSystemVisitSetting';

/** Props injected by the legacy Workspace v1 runtime. */
export interface LegacyPatientWorkspaceProps extends DefaultWorkspaceProps {
  patientUuid: string;
}

/**
 * @deprecated Use `LegacyPatientWorkspaceProps` for an explicit Workspace v1
 * compatibility boundary, or `PatientWorkspace2DefinitionProps` for Workspace v2.
 */
export type DefaultPatientWorkspaceProps = LegacyPatientWorkspaceProps;

export interface PatientWorkspaceGroupProps {
  patient: fhir.Patient | null;
  patientUuid: string;
  visitContext: Visit | null;
  mutateVisitContext: (() => void) | null;
}

export interface PatientChartWorkspaceActionButtonProps {
  groupProps: PatientWorkspaceGroupProps | null;
}

export type PatientWorkspace2DefinitionProps<
  WorkspaceProps extends object = Record<string, never>,
  WindowProps extends object = Record<string, never>,
> = Workspace2DefinitionProps<WorkspaceProps, WindowProps, PatientWorkspaceGroupProps>;

/**
 * Props accepted while a patient workspace is being migrated from Workspace v1
 * to Workspace v2. Consumers must narrow the generation before reading its
 * payload or invoking lifecycle callbacks.
 */
export type PatientWorkspaceProps<
  WorkspaceProps extends object = Record<string, never>,
  WindowProps extends object = Record<string, never>,
> = PatientWorkspace2DefinitionProps<WorkspaceProps, WindowProps> | (LegacyPatientWorkspaceProps & WorkspaceProps);

export function isPatientWorkspace2Props<
  WorkspaceProps extends object = Record<string, never>,
  WindowProps extends object = Record<string, never>,
>(
  props: PatientWorkspaceProps<WorkspaceProps, WindowProps>,
): props is PatientWorkspace2DefinitionProps<WorkspaceProps, WindowProps> {
  return 'workspaceProps' in props && 'groupProps' in props && 'launchChildWorkspace' in props;
}

type WorkspaceFrameworkApi = {
  getRegisteredWorkspace2Names?: typeof getRegisteredWorkspace2Names;
  launchWorkspace2?: typeof launchWorkspace2;
};

function getWorkspaceFrameworkApi(): WorkspaceFrameworkApi {
  return (
    (
      globalThis as typeof globalThis & {
        _openmrs_esm_framework?: WorkspaceFrameworkApi;
      }
    )._openmrs_esm_framework ?? {}
  );
}

function isWorkspace2Registered(workspaceName: string): boolean {
  const shellGetRegisteredWorkspace2Names = getWorkspaceFrameworkApi().getRegisteredWorkspace2Names;
  const registeredWorkspace2Names =
    typeof shellGetRegisteredWorkspace2Names === 'function'
      ? shellGetRegisteredWorkspace2Names()
      : getRegisteredWorkspace2Names();

  return registeredWorkspace2Names.includes(workspaceName);
}

function launchWorkspace2FromAppShell<
  WorkspaceProps extends object,
  WindowProps extends object,
  GroupProps extends object,
>(
  workspaceName: string,
  workspaceProps: WorkspaceProps | null = null,
  windowProps: WindowProps | null = null,
  groupProps: GroupProps | null = null,
): Promise<boolean> {
  const shellLaunchWorkspace2 = getWorkspaceFrameworkApi().launchWorkspace2;
  const launcher = typeof shellLaunchWorkspace2 === 'function' ? shellLaunchWorkspace2 : launchWorkspace2;

  return launcher(workspaceName, workspaceProps, windowProps, groupProps);
}

function getPatientWorkspaceGroupProps(requestedPatientUuid?: string): PatientWorkspaceGroupProps | null {
  const workspace2State = workspace2Store.getState();
  if (workspace2State.openedGroup?.groupName === 'patient-chart') {
    const props = workspace2State.openedGroup.props as PatientWorkspaceGroupProps | null;
    if (props && (!requestedPatientUuid || props.patientUuid === requestedPatientUuid)) {
      return props;
    }
  }

  const { patientUuid, patient, visitContext, mutateVisitContext } = getPatientChartStore().getState();

  if (!patientUuid || (requestedPatientUuid && patientUuid !== requestedPatientUuid)) {
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
  try {
    const windowDefinition = getWindowByWorkspaceName(workspaceName);
    if (!windowDefinition) {
      return false;
    }

    return getGroupByWindowName(windowDefinition.name)?.name === 'patient-chart';
  } catch (error) {
    void error;
    return isWorkspace2Registered(workspaceName);
  }
}

function getPatientUuidFromAdditionalProps(additionalProps?: object): string | null {
  const props = additionalProps as
    | {
        patientUuid?: unknown;
        formInfo?: {
          patientUuid?: unknown;
        };
      }
    | undefined;

  if (typeof props?.patientUuid === 'string') {
    return props.patientUuid;
  }

  if (typeof props?.formInfo?.patientUuid === 'string') {
    return props.formInfo.patientUuid;
  }

  return null;
}

export function launchPatientWorkspace(workspaceName: string, additionalProps?: object): void {
  const patientUuid = getPatientUuidFromStore() || getPatientUuidFromAdditionalProps(additionalProps);
  const workspace2Registered = isWorkspace2Registered(workspaceName);

  if (!workspace2Registered) {
    throw new Error(`Workspace ${workspaceName} is not registered as a Workspace2 workspace.`);
  }

  const patientChartWorkspace2 = isPatientChartWorkspace2(workspaceName);
  const patientChartGroupProps =
    getPatientWorkspaceGroupProps() ??
    (patientUuid
      ? {
          patient: null,
          patientUuid,
          visitContext: null,
          mutateVisitContext: null,
        }
      : null);

  if (patientChartWorkspace2 && !patientChartGroupProps?.patientUuid) {
    throw new Error(`Unable to launch patient chart workspace ${workspaceName}. Missing patientUuid.`);
  }

  const workspaceProps = patientChartWorkspace2
    ? (additionalProps ?? null)
    : {
        ...(patientUuid ? { patientUuid } : {}),
        ...(additionalProps ?? {}),
      };

  void launchWorkspace2FromAppShell(
    workspaceName,
    workspaceProps,
    null,
    patientChartWorkspace2 ? patientChartGroupProps : null,
  );
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
  navigate({ to: '${openmrsSpaBase}/patient/' + `${patientUuid}/chart` + (dashboardName ? `/${dashboardName}` : '') });

  if (!isWorkspace2Registered(workspaceName)) {
    console.error(`Workspace ${workspaceName} is not registered as a Workspace2 workspace.`);
    return;
  }

  void launchWorkspace2FromAppShell(workspaceName, additionalProps ?? null, null, {
    patient: null,
    patientUuid,
    visitContext: null,
    mutateVisitContext: null,
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
      if (isRdeEnabled && getModalRegistration('visit-context-switcher')) {
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
  const launchScope = useMemo(
    () => ({ active: true, patientUuid: activePatientUuid, workspaceName }),
    [activePatientUuid, workspaceName],
  );
  useEffect(() => {
    launchScope.active = true;
    return () => {
      launchScope.active = false;
    };
  }, [launchScope]);

  return useCallback(
    (workspaceProps?: T, windowProps?: object, groupProps?: object): void => {
      if (!launchScope.active) return;
      if (patientUuid) {
        const requestedPatientUuid = getPatientUuidFromAdditionalProps(workspaceProps);
        if (requestedPatientUuid && requestedPatientUuid !== activePatientUuid) return;
        const patientChartWorkspace2 = isPatientChartWorkspace2(workspaceName);
        if (
          patientChartWorkspace2 &&
          groupProps &&
          (groupProps as Partial<PatientWorkspaceGroupProps>).patientUuid !== activePatientUuid
        ) {
          return;
        }
        const resolvedWorkspaceProps = patientChartWorkspace2
          ? (workspaceProps ?? null)
          : ({
              ...(workspaceProps ?? {}),
              patientUuid: activePatientUuid,
            } as T & { patientUuid: string });

        void startVisitIfNeeded().then((didStartVisit) => {
          if (didStartVisit && launchScope.active) {
            const patientChartGroupProps = groupProps ??
              getPatientWorkspaceGroupProps(activePatientUuid) ?? {
                patient: null,
                patientUuid: activePatientUuid,
                visitContext: currentVisit ?? null,
                mutateVisitContext: null,
              };
            void launchWorkspace2FromAppShell(
              workspaceName,
              resolvedWorkspaceProps,
              windowProps ?? null,
              patientChartWorkspace2 ? patientChartGroupProps : null,
            );
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
    [activePatientUuid, currentVisit, patientUuid, startVisitIfNeeded, systemVisitEnabled, workspaceName, launchScope],
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
  launchPatientChartWithWorkspaceOpen({ patientUuid, workspaceName, dashboardName, additionalProps });
}
