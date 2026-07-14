import { userHasAccess } from '@openmrs/esm-api';
import { subscribeOpenmrsEvent } from '@openmrs/esm-emr-api';
import { type OpenedWindow, type WorkspaceStoreState2 } from '@openmrs/esm-extensions';
import { useSession } from '@openmrs/esm-react-utils';
import classNames from 'classnames';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionMenu } from './action-menu2/action-menu2.component';
import ActiveWorkspaceWindow from './active-workspace-window.component';
import { shouldCloseOnUrlChange } from './scope-utils';
import styles from './workspace-windows-and-menu.module.scss';
import { canLaunchWorkspace2, closeWorkspaceGroup2, useWorkspace2Store } from './workspace2';

type AccessUser = Parameters<typeof userHasAccess>[1];

export function canDisplayWorkspaceWindow(
  privileges: string | Array<string> | undefined,
  user: AccessUser | undefined,
) {
  const hasDeclaredPrivileges =
    typeof privileges === 'string' ? privileges.trim().length > 0 : Boolean(privileges?.length);
  return !hasDeclaredPrivileges || Boolean(user && privileges && userHasAccess(privileges, user));
}

export function canDisplayOpenedWorkspaceWindow(
  state: WorkspaceStoreState2,
  openedWindow: OpenedWindow,
  user: AccessUser | undefined,
) {
  return openedWindow.openedWorkspaces.every((workspace) => canLaunchWorkspace2(state, workspace.workspaceName, user));
}

export function renderWorkspaceWindowsAndMenu(target: HTMLElement | null) {
  if (target) {
    const root = createRoot(target);
    root.render(<WorkspaceWindowsAndMenu />);
  }
}

/**
 * This component renders the workspace action menu of a workspace group
 * and all the active workspace windows within that group.
 */
function WorkspaceWindowsAndMenu() {
  const workspaceState = useWorkspace2Store();
  const { openedGroup, openedWindows, registeredGroupsByName, registeredWindowsByName } = workspaceState;
  const { user } = useSession();

  useEffect(() => {
    const unsubscribe = subscribeOpenmrsEvent('before-page-changed', (pageChangedEvent) => {
      const { newPage, cancelNavigation, oldUrl, newUrl } = pageChangedEvent;

      if (!openedGroup) {
        return;
      }

      // Always close on app change - this takes precedence as a safety boundary
      if (newPage) {
        cancelNavigation(closeWorkspaceGroup2().then((isClosed) => !isClosed));
        return;
      }

      const group = registeredGroupsByName[openedGroup.groupName];
      const scopePattern = group?.scopePattern;

      // No scopePattern means no additional scope-based closing (original behavior)
      if (!scopePattern) {
        return;
      }

      if (process.env.NODE_ENV !== 'production' && !scopePattern.startsWith('^')) {
        console.warn(
          `Workspace group "${openedGroup.groupName}" has a scopePattern without a start anchor (^). ` +
            `This may cause unexpected behavior. Pattern: "${scopePattern}"`,
        );
      }

      if (shouldCloseOnUrlChange(scopePattern, oldUrl, newUrl)) {
        // Prompt to close the workspaces
        // should only cancel navigation if the user cancels the prompt
        cancelNavigation(closeWorkspaceGroup2().then((isClosed) => !isClosed));
      }
    });

    return unsubscribe;
  }, [openedGroup, registeredGroupsByName]);

  if (!openedGroup) {
    return null;
  }

  const group = registeredGroupsByName[openedGroup.groupName];
  const visibleOpenedWindows = openedWindows.filter((window) =>
    canDisplayOpenedWorkspaceWindow(workspaceState, window, user),
  );
  const hasMaximizedWindow = visibleOpenedWindows.some((window) => window.maximized);

  const { name: groupName } = group;
  const windowsWithIcons = Object.values(registeredWindowsByName)
    .filter(
      (window): window is Required<typeof window> =>
        window.group === groupName &&
        window.icon !== undefined &&
        canDisplayWorkspaceWindow((window as typeof window & { privileges?: string | Array<string> }).privileges, user),
    )
    .sort((a, b) => (a.order ?? Number.MAX_VALUE) - (b.order ?? Number.MAX_VALUE));
  const showActionMenu = windowsWithIcons.length > 0;

  return (
    <div
      className={classNames(styles.workspaceWindowsAndMenuContainer, {
        [styles.overlay]: group.overlay,
        [styles.hasMaximizedWindow]: hasMaximizedWindow,
      })}
    >
      <div className={styles.workspaceWindowsContainer}>
        {visibleOpenedWindows.map((openedWindow) => {
          return (
            <ActiveWorkspaceWindow
              key={openedWindow.windowName}
              openedWindow={openedWindow}
              showActionMenu={showActionMenu}
            />
          );
        })}
      </div>
      {showActionMenu && <ActionMenu workspaceGroup={group} groupProps={openedGroup.props} />}
    </div>
  );
}
