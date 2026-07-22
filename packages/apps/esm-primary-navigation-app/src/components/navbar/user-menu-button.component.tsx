import { HeaderGlobalAction } from '@carbon/react';
import {
  CloseIcon,
  UserAvatarIcon,
  useAssignedExtensions,
  useOnClickOutside,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import UserMenuPanel from '../navbar-header-panels/user-menu-panel.component';

import styles from './navbar.scss';
import { type MenuButtonProps } from './types';

/**
 * This component displays the user menu button and the menu itself (when toggled on)
 */
const UserMenuButton: React.FC<MenuButtonProps> = ({ isActivePanel, togglePanel, hidePanel }) => {
  const userMenuItems = useAssignedExtensions('user-panel-slot');
  const showUserMenu = useMemo(() => userMenuItems.length > 0, [userMenuItems.length]);
  const { t } = useTranslation();
  const session = useSession();
  const userDisplay = session?.user?.person?.display ?? session?.user?.display ?? '';
  const userMenuRef = useOnClickOutside<HTMLDivElement>(hidePanel('userMenu'), isActivePanel('userMenu'));

  return (
    showUserMenu && (
      <div ref={userMenuRef} className={styles.panelWrapper}>
        <HeaderGlobalAction
          aria-label={
            userDisplay
              ? t('userMenuFor', 'Mi cuenta: {{user}}', { user: userDisplay })
              : t('userMenuTooltip', 'My Account')
          }
          className={classNames({
            [styles.userMenuButton]: true,
            [styles.headerGlobalBarButton]: isActivePanel('userMenu'),
            [styles.activePanel]: !isActivePanel('userMenu'),
          })}
          data-tutorial-target="user-settings"
          isActive={isActivePanel('userMenu')}
          onClick={() => {
            togglePanel('userMenu');
          }}
        >
          {isActivePanel('userMenu') ? <CloseIcon size={20} /> : <UserAvatarIcon size={20} />}
          {userDisplay ? (
            <span className={styles.userDisplayName} title={userDisplay}>
              {userDisplay}
            </span>
          ) : null}
        </HeaderGlobalAction>
        <UserMenuPanel expanded={isActivePanel('userMenu')} hidePanel={hidePanel('userMenu')} />
      </div>
    )
  );
};

export default UserMenuButton;
