import { subscribeOpenmrsEvent } from '@openmrs/esm-emr-api';
import { userHasAccess } from '@openmrs/esm-api';
import { useSession } from '@openmrs/esm-react-utils';
import classNames from 'classnames';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActionMenu } from './action-menu2/action-menu2.component';
import ActiveWorkspaceWindow from './active-workspace-window.component';
import { shouldCloseOnUrlChange } from './scope-utils';
import styles from './workspace-windows-and-menu.module.scss';
import { closeWorkspaceGroup2, useWorkspace2Store } from './workspace2';

type AccessUser = Parameters<typeof userHasAccess>[1];

export function canDisplayWorkspaceWindow(
  privileges: string | Array<string> | undefined,
  user: AccessUser | undefined,
) {
  return !privileges || Boolean(user && userHasAccess(privileges, user));
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
  const { openedGroup, openedWindows, registeredGroupsByName, registeredWindowsByName } = useWorkspace2Store();
  const { user } = useSession();
  const openedGroupName = openedGroup?.groupName;
  const [actionMenuVisibility, setActionMenuVisibility] = useState({ groupName: openedGroupName, visible: false });
  const onActionMenuVisibilityChange = useCallback(
    (visible: boolean) =>
      setActionMenuVisibility((current) =>
        current.groupName === openedGroupName && current.visible === visible
          ? current
          : { groupName: openedGroupName, visible },
      ),
    [openedGroupName],
  );
  const [actionMenuHeight, setActionMenuHeight] = useState({ groupName: openedGroupName, height: 0 });
  const onActionMenuHeightChange = useCallback(
    (height: number) =>
      setActionMenuHeight((current) =>
        current.groupName === openedGroupName && current.height === height
          ? current
          : { groupName: openedGroupName, height },
      ),
    [openedGroupName],
  );

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
  const hasMaximizedWindow = openedWindows.some((window) => window.maximized);

  const { name: groupName } = group;
  const windowsWithIcons = Object.values(registeredWindowsByName)
    .filter(
      (window): window is Required<typeof window> =>
        window.group === groupName &&
        window.icon !== undefined &&
        canDisplayWorkspaceWindow((window as typeof window & { privileges?: string | Array<string> }).privileges, user),
    )
    .sort((a, b) => (a.order ?? Number.MAX_VALUE) - (b.order ?? Number.MAX_VALUE));
  const hasActionMenuCandidates = windowsWithIcons.length > 0;
  const focusedWindow = openedWindows.at(-1);
  const focusedWindowDefinition = focusedWindow
    ? (registeredWindowsByName[focusedWindow.windowName] as
        | ((typeof registeredWindowsByName)[string] & { showActionMenu?: boolean })
        | undefined)
    : undefined;
  const focusedWindowAllowsActionMenu = focusedWindowDefinition?.showActionMenu !== false;
  const actionMenuCanRender = hasActionMenuCandidates && focusedWindowAllowsActionMenu;
  const showActionMenu =
    actionMenuCanRender && actionMenuVisibility.groupName === openedGroupName && actionMenuVisibility.visible;

  return (
    <div
      className={classNames(styles.workspaceWindowsAndMenuContainer, {
        [styles.overlay]: group.overlay,
        [styles.hasMaximizedWindow]: hasMaximizedWindow,
      })}
      style={
        {
          '--bottom-nav-height': `${actionMenuHeight.groupName === openedGroupName ? actionMenuHeight.height : 0}px`,
        } as CSSProperties
      }
    >
      <div className={styles.workspaceWindowsContainer}>
        {openedWindows.map((openedWindow) => {
          return (
            <ActiveWorkspaceWindow
              key={openedWindow.windowName}
              openedWindow={openedWindow}
              showActionMenu={showActionMenu}
            />
          );
        })}
      </div>
      {actionMenuCanRender && (
        <ActionMenu
          workspaceGroup={group}
          groupProps={openedGroup.props}
          onVisibilityChange={onActionMenuVisibilityChange}
          onHeightChange={onActionMenuHeightChange}
        />
      )}
    </div>
  );
}
