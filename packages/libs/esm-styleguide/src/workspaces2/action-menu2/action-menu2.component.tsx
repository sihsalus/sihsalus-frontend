/** @module @category Workspace */

import { IconButton } from '@carbon/react';
import { type WorkspaceGroupDefinition2 } from '@openmrs/esm-globals';
import { ComponentContext, ExtensionSlot, isDesktop, useLayoutType } from '@openmrs/esm-react-utils';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { CloseIcon } from '../../icons';
import { closeWorkspaceGroup2 } from '../workspace2';
import styles from './action-menu2.module.scss';

export interface ActionMenuProps {
  workspaceGroup: WorkspaceGroupDefinition2 & { moduleName: string };
  groupProps: Record<string, any> | null;
}

/**
 * This component renders the action menu (right nav on desktop, bottom on mobile)
 * for a workspace group. The action menu is only rendered when at least one
 * window in the workspace group has an icon defined.
 */
export function ActionMenu({ workspaceGroup, groupProps }: ActionMenuProps) {
  const layout = useLayoutType();
  const { persistence } = workspaceGroup;

  const isClosable = persistence === 'closable';

  return (
    <aside className={styles.sideRail}>
      <div className={styles.container}>
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
    </aside>
  );
}

export default ActionMenu;
