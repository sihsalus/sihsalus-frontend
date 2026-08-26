/** @module @category Workspace */

import { IconButton } from '@carbon/react';
import { type WorkspaceGroupDefinition2 } from '@openmrs/esm-globals';
import { ComponentContext, ExtensionSlot, isDesktop, useLayoutType } from '@openmrs/esm-react-utils';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../../icons';
import { closeWorkspaceGroup2 } from '../workspace2';
import styles from './action-menu2.module.scss';

export interface ActionMenuProps {
  workspaceGroup: WorkspaceGroupDefinition2 & { moduleName: string };
  groupProps: Record<string, any> | null;
  onVisibilityChange?: (visible: boolean) => void;
}

/**
 * This component renders the action menu (right nav on desktop, bottom on mobile)
 * for a workspace group. The action menu is only rendered when at least one
 * window in the workspace group has an icon defined.
 */
export function ActionMenu({ workspaceGroup, groupProps, onVisibilityChange }: ActionMenuProps) {
  const layout = useLayoutType();
  const { persistence } = workspaceGroup;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasRenderedActions, setHasRenderedActions] = useState(false);

  const isClosable = persistence === 'closable';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateVisibility = () => {
      const controls = container.querySelectorAll<HTMLElement>('button, a[href], [role="menuitem"]');
      const visible = Array.from(controls).some((control) => {
        let element: HTMLElement | null = control;
        while (element && element !== container) {
          const style = window.getComputedStyle(element);
          if (element.hidden || element.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          element = element.parentElement;
        }
        return true;
      });
      setHasRenderedActions(visible);
      onVisibilityChange?.(visible);
    };

    updateVisibility();
    const observer = new MutationObserver(updateVisibility);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      onVisibilityChange?.(false);
    };
  }, [onVisibilityChange]);

  return (
    <aside className={hasRenderedActions ? styles.sideRailVisible : styles.sideRailHidden}>
      <div className={styles.sideRail}>
        <div className={styles.container} ref={containerRef}>
          {isClosable && isDesktop(layout) && (
            <IconButton
              align="left"
              onClick={() => closeWorkspaceGroup2()}
              label={getCoreTranslation('close')}
              kind="ghost"
            >
              <CloseIcon />
            </IconButton>
          )}
          <ComponentContext.Provider
            value={{
              moduleName: workspaceGroup.moduleName,
              featureName: workspaceGroup.name,
            }}
          >
            <ExtensionSlot className={styles.container} name={workspaceGroup.name} state={{ groupProps }} />
          </ComponentContext.Provider>
        </div>
      </div>
    </aside>
  );
}

export default ActionMenu;
