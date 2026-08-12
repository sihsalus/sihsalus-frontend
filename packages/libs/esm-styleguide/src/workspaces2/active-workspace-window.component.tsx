import { InlineLoading } from '@carbon/react';
import { type OpenedWindow, type OpenedWorkspace, workspace2Store } from '@openmrs/esm-extensions';
import { loadLifeCycles } from '@openmrs/esm-routes';
import { getCoreTranslation } from '@openmrs/esm-translations';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { mountRootParcel, type ParcelConfig } from 'single-spa';
import Parcel from 'single-spa-react/parcel';
import { userCanLaunch } from '../access';
import { promptForClosingWorkspaces, useWorkspace2Store } from './workspace2';
import { type Workspace2DefinitionProps } from './workspace2.component';
import styles from './workspace2.module.scss';

interface WorkspaceWindowProps {
  openedWindow: OpenedWindow;
  showActionMenu: boolean;
}
/**
 * Renders an opened workspace window.
 */
const ActiveWorkspaceWindow: React.FC<WorkspaceWindowProps> = ({ openedWindow, showActionMenu }) => {
  const { openedWorkspaces } = openedWindow;
  const [lifeCycles, setLifeCycles] = useState<ParcelConfig[]>();
  const { registeredWorkspacesByName } = workspace2Store.getState();

  useEffect(() => {
    Promise.all(
      openedWorkspaces.map((openedWorkspace) => {
        const { moduleName, component } = registeredWorkspacesByName[openedWorkspace.workspaceName];
        return loadLifeCycles(moduleName, component);
      }),
    ).then(setLifeCycles);
  }, [openedWorkspaces, registeredWorkspacesByName]);

  return (
    <>
      {openedWorkspaces.map((openedWorkspace, i) => (
        <ActiveWorkspace
          key={openedWorkspace.uuid}
          openedWorkspace={openedWorkspace}
          openedWindow={openedWindow}
          lifeCycle={lifeCycles && lifeCycles[i] ? lifeCycles[i] : undefined}
          isRootWorkspace={i === 0}
          isLeafWorkspace={i === openedWorkspaces.length - 1}
          showActionMenu={showActionMenu}
        />
      ))}
    </>
  );
};

interface ActiveWorkspaceProps {
  lifeCycle: ParcelConfig | undefined;
  openedWorkspace: OpenedWorkspace;
  openedWindow: OpenedWindow;
  isRootWorkspace: boolean;
  isLeafWorkspace: boolean;
  showActionMenu: boolean;
}

interface ChildWorkspaceLauncherDependencies {
  openedWorkspace: OpenedWorkspace;
  openedWindow: OpenedWindow;
  openChildWorkspace: ReturnType<typeof useWorkspace2Store>['openChildWorkspace'];
  getOpenedWindow?: (windowName: string) => OpenedWindow | undefined;
  getWorkspace?: (workspaceName: string) => { privileges?: string | Array<string> } | undefined;
  canLaunchWorkspace?: typeof userCanLaunch;
  promptForClosing?: typeof promptForClosingWorkspaces;
  warn?: (message: string) => void;
}

export function createChildWorkspaceLauncher({
  openedWorkspace,
  openedWindow,
  openChildWorkspace,
  getOpenedWindow = (windowName) =>
    workspace2Store.getState().openedWindows.find((window) => window.windowName === windowName),
  getWorkspace = (workspaceName) => workspace2Store.getState().registeredWorkspacesByName[workspaceName],
  canLaunchWorkspace = userCanLaunch,
  promptForClosing = promptForClosingWorkspaces,
  warn = console.warn,
}: ChildWorkspaceLauncherDependencies): Workspace2DefinitionProps['launchChildWorkspace'] {
  return async (childWorkspaceName, childWorkspaceProps) => {
    const childWorkspace = getWorkspace(childWorkspaceName);
    if (!childWorkspace || !canLaunchWorkspace(childWorkspace.privileges)) {
      warn(`Access denied while launching workspace "${childWorkspaceName}".`);
      return false;
    }

    const parentWorkspaceName = openedWorkspace.workspaceName;
    const getCurrentParent = () => {
      const currentOpenedWindow = getOpenedWindow(openedWindow.windowName);
      const parentIndex = currentOpenedWindow?.openedWorkspaces.findIndex(
        (workspace) => workspace.uuid === openedWorkspace.uuid,
      );

      if (!currentOpenedWindow || parentIndex == null || parentIndex < 0) {
        return null;
      }

      return { currentOpenedWindow, parentIndex };
    };

    let currentParent = getCurrentParent();
    if (!currentParent) {
      return false;
    }

    const { currentOpenedWindow, parentIndex } = currentParent;
    const { openedWorkspaces } = currentOpenedWindow;
    const isLeaf = parentIndex === openedWorkspaces.length - 1;
    const dirtyWorkspaceUuidsBeforePrompt = new Set(
      openedWorkspaces
        .slice(parentIndex + 1)
        .filter((workspace) => workspace.hasUnsavedChanges)
        .map((workspace) => workspace.uuid),
    );
    if (!isLeaf) {
      const workspacesAboveParent = openedWorkspaces.slice(parentIndex + 1);
      if (workspacesAboveParent.some((workspace) => workspace.hasUnsavedChanges)) {
        const okToClose = await promptForClosing({
          reason: 'CLOSE_WORKSPACE',
          explicit: true,
          windowName: openedWindow.windowName,
          workspaceName: openedWorkspaces[parentIndex + 1].workspaceName,
        });
        if (!okToClose) {
          return false;
        }
      }
    }

    currentParent = getCurrentParent();
    if (!currentParent) {
      return false;
    }

    const currentWorkspacesAboveParent = currentParent.currentOpenedWindow.openedWorkspaces.slice(
      currentParent.parentIndex + 1,
    );
    const newDirtyWorkspaceAppeared = currentWorkspacesAboveParent.some(
      (workspace) => workspace.hasUnsavedChanges && !dirtyWorkspaceUuidsBeforePrompt.has(workspace.uuid),
    );
    if (newDirtyWorkspaceAppeared) {
      return false;
    }

    openChildWorkspace(parentWorkspaceName, childWorkspaceName, childWorkspaceProps || {});
    return true;
  };
}

const ActiveWorkspace: React.FC<ActiveWorkspaceProps> = ({
  lifeCycle,
  openedWorkspace,
  openedWindow,
  isRootWorkspace,
  isLeafWorkspace,
  showActionMenu,
}) => {
  const { openedGroup, closeWorkspace, openChildWorkspace } = useWorkspace2Store();

  const props: Workspace2DefinitionProps = useMemo(
    () =>
      openedWorkspace && {
        closeWorkspace: async (options = {}) => {
          const { closeWindow = false, discardUnsavedChanges = false } = options;
          if (closeWindow) {
            const okToCloseWorkspaces =
              discardUnsavedChanges ||
              (await promptForClosingWorkspaces({
                reason: 'CLOSE_WINDOW',
                explicit: true,
                windowName: openedWindow.windowName,
              }));
            if (okToCloseWorkspaces) {
              closeWorkspace(openedWindow.openedWorkspaces[0].workspaceName);
              return true;
            }
            return false;
          } else {
            const okToCloseWorkspaces =
              discardUnsavedChanges ||
              (await promptForClosingWorkspaces({
                reason: 'CLOSE_WORKSPACE',
                explicit: true,
                windowName: openedWindow.windowName,
                workspaceName: openedWorkspace.workspaceName,
              }));
            if (okToCloseWorkspaces) {
              closeWorkspace(openedWorkspace.workspaceName);
              return true;
            }
            return false;
          }
        },
        launchChildWorkspace: createChildWorkspaceLauncher({ openedWorkspace, openedWindow, openChildWorkspace }),
        workspaceName: openedWorkspace.workspaceName,
        workspaceProps: openedWorkspace.props,
        windowProps: openedWindow.props,
        groupProps: openedGroup && openedGroup.props ? openedGroup.props : null,
        isRootWorkspace,
        isLeafWorkspace,
        windowName: openedWindow.windowName,
        showActionMenu,
      },
    [
      openedWorkspace,
      closeWorkspace,
      openedGroup,
      openedWindow,
      openChildWorkspace,
      isRootWorkspace,
      isLeafWorkspace,
      showActionMenu,
    ],
  );

  if (!lifeCycle) {
    const { registeredWorkspacesByName } = workspace2Store.getState();
    const workspaceDef = registeredWorkspacesByName[openedWorkspace.workspaceName];
    const windowName = workspaceDef && workspaceDef.window ? workspaceDef.window : undefined;
    const { registeredWindowsByName } = workspace2Store.getState();
    const windowDef = windowName ? registeredWindowsByName[windowName] : undefined;
    const width = windowDef && windowDef.width ? windowDef.width : 'narrow';
    const isActionMenuOpened = Object.values(registeredWindowsByName).some(
      (window) => window.group === openedGroup?.groupName && window.icon !== undefined,
    );

    return (
      <div
        className={classNames(styles.workspaceOuterContainer, {
          [styles.narrowWorkspace]: width === 'narrow',
          [styles.widerWorkspace]: width === 'wider',
          [styles.extraWideWorkspace]: width === 'extra-wide',
          [styles.isActionMenuOpened]: isActionMenuOpened,
        })}
      >
        <div className={styles.workspaceSpacer} />
        <div
          className={classNames(styles.workspaceMiddleContainer, {
            [styles.isRootWorkspace]: isRootWorkspace,
            [styles.showActionMenu]: showActionMenu,
          })}
        >
          <div
            className={classNames(styles.workspaceInnerContainer, {
              [styles.isRootWorkspace]: isRootWorkspace,
            })}
          >
            <InlineLoading className={styles.loader} description={`${getCoreTranslation('loading')} ...`} />
          </div>
        </div>
      </div>
    );
  }

  return <Parcel key={openedWorkspace.workspaceName} config={lifeCycle} mountParcel={mountRootParcel} {...props} />;
};

export default ActiveWorkspaceWindow;
